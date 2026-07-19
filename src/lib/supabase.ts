/**
 * Minimal Supabase client built on fetch — no npm package required.
 * Implements auth (email+password) and PostgREST database access.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SESSION_KEY = "sb.session";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupabaseUser {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupabaseUser;
}

type AuthListener = (session: SupabaseSession | null) => void;

// ── Session state ─────────────────────────────────────────────────────────────

interface StoredSession extends SupabaseSession {
  expires_at?: number; // ms since epoch
}

let _session: SupabaseSession | null = null;
let _isRecoverySession = false;
const _listeners = new Set<AuthListener>();

function _notify(s: SupabaseSession | null) {
  _listeners.forEach((fn) => fn(s));
}

function _isExpired(s: StoredSession | null): boolean {
  if (!s?.expires_at) return false;
  return Date.now() > s.expires_at - 60_000; // 60s buffer
}

function _save(s: SupabaseSession | null) {
  _session = s;
  if (typeof window !== "undefined") {
    if (s) {
      const stored: StoredSession = { ...s, expires_at: Date.now() + (s.expires_in ?? 3600) * 1000 };
      localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  _notify(s);
}

// Load persisted session on startup (skip if already expired)
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as StoredSession;
      if (!_isExpired(stored)) _session = stored;
      else localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

async function _refreshSession(): Promise<SupabaseSession | null> {
  const rt = (_session as StoredSession | null)?.refresh_token;
  if (!rt) return null;
  const { data, error } = await _authPost("/token?grant_type=refresh_token", { refresh_token: rt });
  if (error || !data) { _save(null); return null; }
  _save(data as SupabaseSession);
  return data as SupabaseSession;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _token() {
  return _session?.access_token ?? ANON_KEY;
}

function _headers(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${_token()}`,
    ...extra,
  };
}

async function _authPost(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/auth/v1${path}`, {
      method: "POST",
      headers: _headers(),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Network error" } };
  }
  const data = await res.json();
  if (!res.ok) return { data: null, error: { message: data.msg ?? data.error_description ?? data.message ?? "Auth error" } };
  return { data, error: null };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const supabase = {
  auth: {
    async getSession() {
      if (_isExpired(_session as StoredSession | null)) {
        await _refreshSession();
      }
      return { data: { session: _session }, error: null };
    },
    onAuthStateChange(fn: (event: string, session: SupabaseSession | null) => void) {
      const wrapped: AuthListener = (s) => fn(s ? "SIGNED_IN" : "SIGNED_OUT", s);
      _listeners.add(wrapped);
      return { data: { subscription: { unsubscribe: () => _listeners.delete(wrapped) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const { data, error } = await _authPost("/token?grant_type=password", { email, password });
      if (error) return { data: null, error };
      _save(data as SupabaseSession);
      return { data, error: null };
    },
    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) {
      const body: Record<string, unknown> = { email, password };
      if (options?.data) body.data = options.data; // stored as raw_user_meta_data
      const { data, error } = await _authPost("/signup", body);
      if (error) return { data: null, error };
      // If email confirmation is disabled, a session is returned immediately
      if ((data as SupabaseSession).access_token) _save(data as SupabaseSession);
      return { data, error: null };
    },
    async signOut() {
      if (_session) {
        await fetch(`${URL_BASE}/auth/v1/logout`, {
          method: "POST",
          headers: _headers(),
        }).catch(() => {});
      }
      _save(null);
      return { error: null };
    },

    async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }) {
      const body: Record<string, string> = { email };
      if (opts?.redirectTo) body.redirect_to = opts.redirectTo;
      const { error } = await _authPost("/recover", body);
      return { error };
    },

    async updateUser(attrs: { password?: string }) {
      let res: Response;
      try {
        res = await fetch(`${URL_BASE}/auth/v1/user`, {
          method: "PUT",
          headers: _headers(),
          body: JSON.stringify(attrs),
        });
      } catch (e) {
        return { error: { message: e instanceof Error ? e.message : "Network error" } };
      }
      const data = await res.json().catch(() => ({})) as { msg?: string; message?: string };
      if (!res.ok) return { error: { message: data.msg ?? data.message ?? "Update failed" } };
      return { error: null };
    },

    /** Returns true if the current session was established via a password-recovery link. */
    isRecoverySession(): boolean { return _isRecoverySession; },

    /**
     * Parse the URL hash for a Supabase recovery token and save it as the
     * active session. Returns true if a valid recovery token was found.
     */
    async setSessionFromHash(hash?: string): Promise<boolean> {
      if (typeof window === "undefined") return false;
      const params = new URLSearchParams((hash ?? window.location.hash).slice(1));
      if (params.get("type") !== "recovery") return false;
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token") ?? "";
      const expires_in = parseInt(params.get("expires_in") ?? "3600", 10);
      if (!access_token) return false;
      try {
        const parts = access_token.split(".");
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string };
        _save({ access_token, refresh_token, expires_in, user: { id: payload.sub ?? "", email: payload.email } });
        _isRecoverySession = true;
        return true;
      } catch {
        return false;
      }
    },
  },

  // ── PostgREST query builder ────────────────────────────────────────────────

  from(table: string) {
    return new QueryBuilder(table);
  },
};

// ── QueryBuilder ──────────────────────────────────────────────────────────────

class QueryBuilder {
  private _table: string;
  private _filters: string[] = [];
  private _orderBy: string | null = null;
  private _selectCols = "*";

  constructor(table: string) {
    this._table = table;
  }

  select(cols = "*") {
    this._selectCols = cols;
    return this;
  }

  eq(col: string, val: unknown) {
    this._filters.push(`${col}=eq.${val}`);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderBy = `${col}.${opts?.ascending === false ? "desc" : "asc"}`;
    return this;
  }

  private _url(extra?: string) {
    const params = new URLSearchParams();
    if (this._selectCols !== "*") params.set("select", this._selectCols);
    this._filters.forEach((f) => {
      const [k, v] = f.split("=");
      params.set(k, v);
    });
    if (this._orderBy) params.set("order", this._orderBy);
    if (extra) {
      const extraParams = new URLSearchParams(extra);
      extraParams.forEach((v, k) => params.set(k, v));
    }
    const qs = params.toString();
    return `${URL_BASE}/rest/v1/${this._table}${qs ? `?${qs}` : ""}`;
  }

  async select_all() {
    return this._get();
  }

  /** Triggers the GET when the builder has a .select() and you await it */
  then<R>(
    resolve: (val: { data: unknown[] | null; error: { message: string } | null }) => R,
  ) {
    return this._get().then(resolve);
  }

  private async _get() {
    let res = await fetch(this._url(), {
      headers: { ..._headers(), "Accept": "application/json" },
    });
    // On 401, try refreshing the session once and retry
    if (res.status === 401) {
      await _refreshSession();
      res = await fetch(this._url(), {
        headers: { ..._headers(), "Accept": "application/json" },
      });
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: { message: err.message ?? "Query failed" } };
    }
    const data = await res.json();
    return { data: Array.isArray(data) ? data : [data], error: null };
  }

  async insert(row: unknown) {
    const res = await fetch(`${URL_BASE}/rest/v1/${this._table}`, {
      method: "POST",
      headers: { ..._headers(), "Prefer": "return=representation" },
      body: JSON.stringify(row),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: { message: (data as { message?: string })?.message ?? "Insert failed" } };
    return { data, error: null };
  }

  async upsert(row: unknown) {
    const res = await fetch(`${URL_BASE}/rest/v1/${this._table}`, {
      method: "POST",
      headers: { ..._headers(), "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: { message: (data as { message?: string })?.message ?? "Upsert failed" } };
    }
    return { data: null, error: null };
  }

  async update(patch: unknown) {
    const url = this._url();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ..._headers(), "Prefer": "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: { message: (data as { message?: string })?.message ?? "Update failed" } };
    }
    return { data: null, error: null };
  }

  async delete() {
    const url = this._url();
    const res = await fetch(url, {
      method: "DELETE",
      headers: _headers(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: { message: (data as { message?: string })?.message ?? "Delete failed" } };
    }
    return { data: null, error: null };
  }
}
