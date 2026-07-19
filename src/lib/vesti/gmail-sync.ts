/**
 * Gmail OAuth + API client (browser-side only).
 * Uses Google Identity Services to get a short-lived access token,
 * then calls the Gmail REST API to fetch recent receipt emails.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken(): void };
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const SESSION_KEY = "clem.gmail.token";

// ── Token storage ──────────────────────────────────────────────────────────

interface StoredToken {
  access_token: string;
  expires_at: number; // ms since epoch
  email?: string;
}

export function getStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (Date.now() > t.expires_at) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

function saveToken(access_token: string, email?: string) {
  const stored: StoredToken = { access_token, expires_at: Date.now() + 55 * 60 * 1000, email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
}

export function clearToken() {
  localStorage.removeItem(SESSION_KEY);
}

// ── GIS script loader ──────────────────────────────────────────────────────

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export async function connectGmail(): Promise<string> {
  if (!CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID is not set");

  // Return cached token if still valid
  const cached = getStoredToken();
  if (cached) return cached.access_token;

  await loadGis();

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "OAuth failed"));
          return;
        }
        // Fetch user email for display
        const email = await fetchUserEmail(resp.access_token).catch(() => undefined);
        saveToken(resp.access_token, email);
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

async function fetchUserEmail(token: string): Promise<string> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return "";
  const d = (await res.json()) as { emailAddress?: string };
  return d.emailAddress ?? "";
}

// ── Gmail API ──────────────────────────────────────────────────────────────

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

function header(msg: GmailMessageDetail, name: string) {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function collectTextParts(part: GmailPart, out: string[] = []): string[] {
  if (part.mimeType === "text/plain" && part.body.data) out.push(part.body.data);
  for (const child of part.parts ?? []) collectTextParts(child, out);
  return out;
}

function extractBodyText(payload: GmailMessageDetail["payload"]): string {
  const parts = collectTextParts(payload as GmailPart);
  if (parts.length === 0) return "";
  const decoded = parts.map(decodeGmailBase64).join(" ");
  // Trim to 800 chars to keep AI prompt small
  return decoded.replace(/\s+/g, " ").trim().slice(0, 800);
}

interface GmailPart {
  mimeType: string;
  body: { data?: string; size?: number };
  parts?: GmailPart[];
}

function collectHtmlParts(part: GmailPart, out: string[] = []): string[] {
  if (part.mimeType === "text/html" && part.body.data) out.push(part.body.data);
  for (const child of part.parts ?? []) collectHtmlParts(child, out);
  return out;
}

function decodeGmailBase64(data: string): string {
  return atob(data.replace(/-/g, "+").replace(/_/g, "/"));
}

function extractProductImage(html: string): string | null {
  const urls: string[] = [];
  let m;

  // <img src="...">
  const imgRx = /\bsrc=["'](https?:\/\/[^"'\s>]+)["']/gi;
  while ((m = imgRx.exec(html)) !== null) urls.push(m[1]);

  // background-image: url(...) and <td background="...">
  const bgRx = /(?:background(?:-image)?:\s*url\(["']?|background=["'])(https?:\/\/[^"')>\s]+)/gi;
  while ((m = bgRx.exec(html)) !== null) urls.push(m[1]);

  const SKIP = /(tracking|\/track\b|\bopen\b|pixel|beacon|spacer|transparent|1x1|icon\.|logo\.|footer|header|social|twitter|facebook|instagram|youtube|pinterest|\.gif(\?|$))/i;

  const scored = urls
    .filter((url) => {
      if (SKIP.test(url)) return false;
      try {
        return new URL(url).pathname.length >= 10;
      } catch { return false; }
    })
    .map((url) => {
      let score = 0;
      if (/\/(product|item|catalog|shop|goods|p\/|pd\/|images\/)/i.test(url)) score += 3;
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) score += 2;
      if (/cdn\.|img\.|images\.|media\./i.test(url)) score += 1;
      return { url, score };
    })
    .sort((a, b) => b.score - a.score);

  const result = scored[0]?.url ?? null;
  console.log(`[gmail-img] ${urls.length} candidates → ${result ? result.slice(0, 80) : "none"}`);
  return result;
}

export async function fetchEmailProductImage(messageId: string, accessToken: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${GMAIL}/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!r.ok) {
      console.warn(`[gmail-img] fetch failed ${r.status}`);
      return null;
    }
    const msg = await r.json() as { payload?: GmailPart };
    if (!msg.payload) { console.warn("[gmail-img] no payload"); return null; }
    const parts = collectHtmlParts(msg.payload);
    if (parts.length === 0) { console.warn("[gmail-img] no html parts"); return null; }
    const html = parts.map(decodeGmailBase64).join("");
    return extractProductImage(html);
  } catch (e) {
    console.warn("[gmail-img] error", e);
    return null;
  }
}

// ── Schema.org JSON-LD order extraction ────────────────────────────────────

export interface OrderSchemaItem {
  name: string;
  brand?: string;
  price?: string;
  currency?: string;
}

export interface OrderSchema {
  merchant?: string;
  orderDate?: string;
  isReturn?: boolean;
  items: OrderSchemaItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOrderObject(obj: any): OrderSchema | null {
  const schema: OrderSchema = { items: [] };

  const merchant = obj.merchant ?? obj.seller ?? obj.vendor;
  if (merchant?.name) schema.merchant = String(merchant.name);
  else if (typeof merchant === "string") schema.merchant = merchant;

  schema.orderDate = obj.orderDate ?? obj.orderDeliveryDate ?? undefined;

  const status = String(obj.orderStatus ?? "").toLowerCase();
  schema.isReturn = status.includes("return") || status.includes("refund");

  const itemSources = [
    ...(Array.isArray(obj.orderedItem) ? obj.orderedItem : obj.orderedItem ? [obj.orderedItem] : []),
    ...(Array.isArray(obj.acceptedOffer) ? obj.acceptedOffer : obj.acceptedOffer ? [obj.acceptedOffer] : []),
  ];

  for (const item of itemSources) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product: any = item.orderedItem ?? item.itemOffered ?? item;
    if (!product?.name) continue;
    const priceSpec = item.orderItemPrice ?? item.priceSpecification ?? item;
    const price = priceSpec?.price ?? priceSpec?.["schema:price"];
    const currency = priceSpec?.priceCurrency ?? priceSpec?.["schema:priceCurrency"];
    const brand = product.brand?.name ?? (typeof product.brand === "string" ? product.brand : undefined);
    schema.items.push({
      name: String(product.name),
      brand: brand ? String(brand) : undefined,
      price: price != null ? String(price) : undefined,
      currency: currency ? String(currency) : undefined,
    });
  }

  return schema.items.length > 0 || schema.merchant ? schema : null;
}

export function extractOrderSchema(html: string): OrderSchema | null {
  const scriptRx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRx.exec(html)) !== null) {
    try {
      const raw: unknown = JSON.parse(m[1]);
      const objects = Array.isArray(raw) ? raw : [raw];
      for (const obj of objects) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((obj as any)["@type"] === "Order") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = parseOrderObject(obj as any);
          if (result) return result;
        }
      }
    } catch { /* malformed JSON — skip */ }
  }
  return null;
}

// ── EmailMeta ───────────────────────────────────────────────────────────────

export interface EmailMeta {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  bodyText?: string;
  orderSchema?: OrderSchema;
  imageUrl?: string;
}

export async function fetchReceiptEmails(accessToken: string): Promise<EmailMeta[]> {
  // Two parallel searches:
  // 1. Subject-line receipt keywords — catches confirmations regardless of Gmail tab
  // 2. Known fashion brand senders — catches receipts that land in Primary/Updates
  const SHOPPING_QUERY = "subject:(confirmation OR confirmed OR \"order #\" OR receipt OR invoice OR shipped OR \"out for delivery\" OR delivered OR \"thank you for your order\" OR \"payment received\" OR \"your purchase\" OR \"purchase confirmation\" OR \"order receipt\") newer_than:5y";
  const FASHION_SENDERS = [
    "nordstrom.com", "nordstromrack.com", "asos.com", "zara.com", "hm.com",
    "lululemon.com", "nike.com", "adidas.com", "revolve.com", "freepeople.com",
    "urbanoutfitters.com", "anthropologie.com", "bloomingdales.com",
    "saksfifthavenue.com", "neimanmarcus.com", "saksoff5th.com",
    "shein.com", "abercrombie.com", "ae.com", "forever21.com",
    "macys.com", "jcrew.com", "gap.com", "bananarepublic.com",
    "uniqlo.com", "net-a-porter.com", "farfetch.com", "ralphlauren.com",
    "toryburch.com", "katespade.com", "coach.com", "michaelkors.com",
    "fashionnova.com", "patagonia.com", "columbiasportswear.com",
  ];
  const FASHION_SENDER_QUERY = `from:(${FASHION_SENDERS.join(" OR ")}) newer_than:5y`;

  async function listPage(query: string, pageToken?: string): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ q: query, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${GMAIL}/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text) as { messages?: GmailMessage[]; nextPageToken?: string };
    return { messages: json.messages ?? [], nextPageToken: json.nextPageToken };
  }

  // Run both queries in parallel, then union + deduplicate by message ID
  const [shoppingResults, fashionResults] = await Promise.all([
    listPage(SHOPPING_QUERY),
    listPage(FASHION_SENDER_QUERY),
  ]);
  const seen = new Set<string>();
  const messages: GmailMessage[] = [];
  for (const m of [...shoppingResults.messages, ...fashionResults.messages]) {
    if (!seen.has(m.id)) { seen.add(m.id); messages.push(m); }
  }
  console.log(`[gmail] subject-keywords:${shoppingResults.messages.length} fashion-senders:${fashionResults.messages.length} → ${messages.length} unique`);
  if (messages.length === 0) {
    throw new Error(`No shopping or fashion emails found. Make sure Gmail is connected and try again.`);
  }

  // Fetch details in batches of 5 with retry on 429 to stay within rate limits
  let firstFetchError = "";
  async function fetchDetail(id: string): Promise<GmailMessageDetail | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(
        `${GMAIL}/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, (attempt + 1) * 1000));
        continue;
      }
      if (!r.ok) {
        const body = await r.text();
        const msg = `HTTP ${r.status}: ${body.slice(0, 120)}`;
        console.warn(`[gmail] message ${id} failed — ${msg}`);
        if (!firstFetchError) firstFetchError = msg;
        return null;
      }
      try {
        const json = await r.json() as GmailMessageDetail;
        return json;
      } catch {
        return null;
      }
    }
    return null;
  }

  const details: (GmailMessageDetail | null)[] = [];
  for (let i = 0; i < messages.length; i += 5) {
    const batch = messages.slice(i, i + 5);
    const results = await Promise.all(batch.map((m) => fetchDetail(m.id)));
    details.push(...results);
    if (i + 5 < messages.length) await new Promise((r) => setTimeout(r, 150));
  }

  // Accept any non-null response — handle missing headers gracefully
  const valid = details.filter((msg): msg is GmailMessageDetail => msg != null);
  console.log(`[gmail] ${valid.length}/${messages.length} messages loaded`);

  if (valid.length === 0) {
    throw new Error(
      firstFetchError
        ? `Gmail message fetch failed — ${firstFetchError}. Try disconnecting and reconnecting Gmail.`
        : `Gmail returned ${messages.length} email IDs but all detail fetches failed. Try disconnecting and reconnecting Gmail.`,
    );
  }

  return valid.map((msg) => {
    const htmlParts = collectHtmlParts(msg.payload as GmailPart);
    const html = htmlParts.map(decodeGmailBase64).join("");
    const orderSchema = html ? (extractOrderSchema(html) ?? undefined) : undefined;
    const imageUrl = html ? (extractProductImage(html) ?? undefined) : undefined;
    return {
      messageId: msg.id,
      subject: header(msg, "subject"),
      from: header(msg, "from"),
      date: header(msg, "date"),
      snippet: msg.snippet ?? "",
      bodyText: extractBodyText(msg.payload),
      orderSchema,
      imageUrl,
    };
  });
}
