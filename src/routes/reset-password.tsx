import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Clem" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Supabase forwarded an error (e.g. expired link)
    if (params.get("error")) {
      const code = params.get("error_code") ?? "";
      setLinkError(
        code === "otp_expired"
          ? "This reset link has expired. Please request a new one."
          : params.get("error_description") ?? "This reset link is invalid.",
      );
      return;
    }
    void supabase.auth.setSessionFromHash().then(async (ok) => {
      if (ok || supabase.auth.isRecoverySession()) { setReady(true); return; }
      // window.location.replace caused a full reload — module state is gone but
      // setSessionFromHash() saved the token to localStorage before reloading.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => void navigate({ to: "/" }), 2000);
    }
  }

  if (linkError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-1 font-serif text-3xl tracking-tight text-foreground italic">Clem</h1>
          <p className="mt-6 mb-2 text-sm text-foreground">{linkError}</p>
          <p className="mb-8 text-xs text-muted-foreground">Reset links expire after 1 hour.</p>
          <Link
            to="/login"
            className="inline-block rounded-md bg-foreground px-6 py-2.5 text-xs font-medium uppercase tracking-widest text-background transition-opacity hover:opacity-90"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <p className="text-sm text-foreground">Password updated. Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-serif text-3xl tracking-tight text-foreground italic">Clem</h1>
        <p className="mb-8 text-sm text-muted-foreground">Set a new password</p>

        {!ready && (
          <p className="mb-4 text-xs text-muted-foreground">Verifying your reset link…</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-widest">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={!ready}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              disabled={!ready}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Updating…" : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
