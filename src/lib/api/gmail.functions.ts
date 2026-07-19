import type { Category, Season } from "@/lib/vesti/store";
import type { EmailMeta } from "@/lib/vesti/gmail-sync";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_MAX_CALLS = 30; // free-tier safety cap (30 req/min)

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_MAX_CALLS = 15; // free-tier safety cap (15 req/min)

interface VerifiedItem {
  isClothing: boolean;
  itemName: string;
  brand: string;
  color: string | null;
  category: Category;
  season: Season;
  price: string | null;
}

function buildVerificationPrompt(email: EmailMeta): string {
  const text = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Snippet: ${email.snippet}`,
    email.bodyText ? `Body: ${email.bodyText.slice(0, 400)}` : "",
  ].filter(Boolean).join("\n");

  return `You are a clothing receipt parser. Extract data from this email. If it is NOT a clothing purchase receipt, return {"isClothing":false}.\n\nReturn JSON: {"isClothing":boolean,"itemName":string,"brand":string,"color":string|null,"category":"Tops"|"Bottoms"|"Dresses"|"Outerwear"|"Sweaters"|"Shoes"|"Accessories","season":"Warm"|"Cold"|"Year-round","price":string|null}\n\n${text}`;
}

/**
 * Calls Groq to verify + extract clothing-receipt data for one email.
 * Retries a couple of times on transient failures (429/5xx/network) so a
 * blip doesn't get treated the same as Groq genuinely saying "not clothing".
 * Throws only when the call could not be completed at all after retrying;
 * returns null when Groq successfully responded that this isn't a clothing
 * purchase.
 */
async function groqParseEmail(email: EmailMeta): Promise<VerifiedItem | null> {
  if (!GROQ_API_KEY) throw new Error("VITE_GROQ_API_KEY is not configured");
  const body = JSON.stringify({
    model: GROQ_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildVerificationPrompt(email) }],
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body,
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Groq ${res.status}`);
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const d = await res.json() as { choices: [{ message: { content: string } }] };
      const parsed = JSON.parse(d.choices[0].message.content) as VerifiedItem;
      return parsed.isClothing ? parsed : null;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Groq call failed");
}

/**
 * Same contract as groqParseEmail, backed by Gemini instead — lets the queue
 * be split across two independent providers (and two independent per-minute
 * rate limits) so it drains roughly twice as fast when both keys are set.
 */
async function geminiParseEmail(email: EmailMeta): Promise<VerifiedItem | null> {
  if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not configured");
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildVerificationPrompt(email) }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 220, responseMimeType: "application/json" },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Gemini ${res.status}`);
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const d = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const raw = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = JSON.parse(
        raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(),
      ) as VerifiedItem;
      return parsed.isClothing ? parsed : null;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini call failed");
}

export interface ParsedReceipt {
  messageId: string;
  retailer: string;
  sender: string;
  subject: string;
  orderDate: string;
  price?: string;
  itemName: string;
  brand: string;
  color?: string;
  category: Category;
  season: Season;
  kind: "purchase" | "return";
  imageUrl?: string;
}

// ── Brand domain dictionary ──────────────────────────────────────────────────

const DOMAIN_TO_BRAND: Record<string, string> = {
  "nordstrom.com": "Nordstrom", "nordstromrack.com": "Nordstrom Rack",
  "asos.com": "ASOS", "zara.com": "Zara", "hm.com": "H&M",
  "lululemon.com": "Lululemon", "nike.com": "Nike", "adidas.com": "Adidas",
  "revolve.com": "Revolve", "freepeople.com": "Free People",
  "urbanoutfitters.com": "Urban Outfitters", "anthropologie.com": "Anthropologie",
  "bloomingdales.com": "Bloomingdale's", "saksfifthavenue.com": "Saks Fifth Avenue",
  "neimanmarcus.com": "Neiman Marcus", "saksoff5th.com": "Saks Off 5th",
  "shein.com": "Shein", "abercrombie.com": "Abercrombie & Fitch",
  "ae.com": "American Eagle", "forever21.com": "Forever 21",
  "macys.com": "Macy's", "jcrew.com": "J.Crew", "gap.com": "Gap",
  "bananarepublic.com": "Banana Republic", "uniqlo.com": "Uniqlo",
  "net-a-porter.com": "Net-A-Porter", "farfetch.com": "Farfetch",
  "ralphlauren.com": "Ralph Lauren", "toryburch.com": "Tory Burch",
  "katespade.com": "Kate Spade", "coach.com": "Coach",
  "michaelkors.com": "Michael Kors", "fashionnova.com": "Fashion Nova",
  "patagonia.com": "Patagonia", "columbiasportswear.com": "Columbia",
  "amazon.com": "Amazon", "target.com": "Target", "walmart.com": "Walmart",
  "ariat.com": "Ariat", "calvinklein.com": "Calvin Klein",
  "tommy.com": "Tommy Hilfiger", "levis.com": "Levi's",
  "jcpenney.com": "JCPenney", "kohls.com": "Kohl's", "oldnavy.com": "Old Navy",
  "victoriassecret.com": "Victoria's Secret", "athleta.com": "Athleta",
  "loft.com": "LOFT", "anntaylor.com": "Ann Taylor", "express.com": "Express",
  "torrid.com": "Torrid", "reiss.com": "Reiss", "arket.com": "Arket",
  "cosstores.com": "COS", "ganni.com": "Ganni", "acnestudios.com": "Acne Studios",
  "toteme.com": "Toteme", "sezane.com": "Sézane", "rag-bone.com": "Rag & Bone",
  "vince.com": "Vince", "theory.com": "Theory", "madewell.com": "Madewell",
};

const FASHION_DOMAINS = new Set(Object.keys(DOMAIN_TO_BRAND));

// General retailers that sell clothing among many other categories.
// These are NOT auto-trusted — they require clothing keyword verification via Groq.
const GENERAL_RETAILERS = new Set([
  "amazon.com", "target.com", "walmart.com", "kohls.com", "jcpenney.com",
  // Outdoor/lifestyle brands with heavy ad volume — require Groq purchase confirmation
  "patagonia.com", "columbiasportswear.com", "rei.com", "northface.com",
]);

const SKIP_DOMAINS = new Set([
  // Food & delivery
  "doordash.com", "ubereats.com", "grubhub.com", "postmates.com",
  "seamless.com", "caviar.com", "instacart.com", "opentable.com", "resy.com",
  // Entertainment & streaming
  "netflix.com", "spotify.com", "hulu.com", "disneyplus.com", "hbomax.com",
  "apple.com", "itunes.com", "youtube.com", "twitch.tv",
  // Travel
  "airbnb.com", "expedia.com", "united.com", "delta.com", "southwest.com",
  "booking.com", "hotels.com", "vrbo.com", "kayak.com", "aa.com",
  // Software & tech
  "github.com", "atlassian.com", "slack.com", "zoom.us", "dropbox.com",
  "adobe.com", "microsoft.com", "google.com", "aws.amazon.com",
  // Finance & payments
  "paypal.com", "venmo.com", "cashapp.com", "chase.com", "bankofamerica.com",
  // Home, pets, electronics
  "wayfair.com", "homedepot.com", "lowes.com", "ikea.com",
  "bestbuy.com", "chewy.com", "petsmart.com", "petco.com",
  // Tickets & events
  "stubhub.com", "ticketmaster.com", "eventbrite.com",
  // Food delivery / grocery
  "freshdirect.com", "hellofresh.com", "sunbasket.com",
]);

const CLOTHING_KEYWORDS = [
  "shirt", "dress", "pant", "jean", "jacket", "coat", "sweater", "knit",
  "blouse", "top", "skirt", "short", "shoe", "boot", "sneaker", "sandal",
  "heel", "flat", "loafer", "bag", "handbag", "scarf", "belt", "hat",
  "jewelry", "earring", "necklace", "clothing", "apparel", "fashion",
  "swimwear", "bikini", "lingerie", "hoodie", "cardigan", "blazer",
  "denim", "legging", "turtleneck", "sweatshirt", "activewear", "tank", "polo",
];

const NON_FASHION_KEYWORDS = [
  "food delivery", "pizza", "restaurant", "grocery", "flight", "hotel",
  "streaming", "electricity", "gas bill", "insurance", "aws", "software",
];

// ── Category + season heuristics ────────────────────────────────────────────

const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ["Shoes",       ["shoe", "boot", "sneaker", "sandal", "heel", "flat", "loafer", "mule", "pump", "wedge", "oxford", "espadrille"]],
  ["Accessories", ["bag", "handbag", "purse", "clutch", "tote", "scarf", "belt", "hat", "cap", "beanie", "jewelry", "earring", "necklace", "bracelet", "ring", "watch", "sunglasses", "wallet"]],
  ["Outerwear",   ["jacket", "coat", "blazer", "puffer", "trench", "windbreaker", "anorak", "raincoat", "parka"]],
  ["Sweaters",    ["sweater", "knit", "cardigan", "pullover", "hoodie", "sweatshirt", "fleece", "turtleneck", "crewneck"]],
  ["Dresses",     ["dress", "gown", "romper", "jumpsuit", "sundress"]],
  ["Bottoms",     ["pant", "jean", "trouser", "skirt", "short", "legging", "chino", "cargo", "jogger", "denim"]],
  ["Tops",        ["shirt", "blouse", "top", "tee", "tank", "camisole", "crop", "polo", "tunic", "bikini", "swimwear"]],
];

function guessCategory(text: string): Category {
  const lower = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_KEYWORDS) {
    if (kws.some((kw) => lower.includes(kw))) return cat;
  }
  return "Tops";
}

function guessSeason(text: string): Season {
  const lower = text.toLowerCase();
  if (/swimwear|bikini|linen|shorts|sandal|tank|summer|tropical/.test(lower)) return "Warm";
  if (/coat|puffer|wool|cashmere|boot|sweater|winter|fleece|thermal/.test(lower)) return "Cold";
  return "Year-round";
}

function extractPrice(text: string): string | undefined {
  const m = text.match(/[\$£€]\s*([\d,]+\.?\d{0,2})/);
  return m ? `$${m[1].replace(",", "")}` : undefined;
}

function parseOrderDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* ignore */ }
  const m = raw.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    try {
      const d = new Date(`${m[1]} ${m[2]} ${m[3]}`);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { /* ignore */ }
  }
  return new Date().toISOString().slice(0, 10);
}

function extractDomain(from: string): string {
  const m = from.match(/@([\w.-]+)/);
  if (!m) return "";
  const parts = m[1].toLowerCase().split(".");
  return parts.slice(-2).join(".");
}

function guessItemName(subject: string, brand: string): string {
  const cleaned = subject
    .replace(/^(your order|order confirmation|order confirmed|order receipt|thank you for your (order|purchase)|has shipped|your purchase|receipt|invoice|shipping confirmation|out for delivery|delivered)[:\s–-]*/i, "")
    .replace(/\s*(#|no\.?|order)\s*[\w-]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length >= 4 && cleaned.length <= 80 && !/^\d+$/.test(cleaned)) return cleaned;
  return `${brand} order`;
}

// ── Main parser — two-step: cheap pre-filter, then mandatory AI gate ────────
//
// Step 1 (below, in the collection loop): eliminate obvious non-candidates
// cheaply (skip-listed domains, returns, and — only for completely unknown
// domains — a keyword pre-filter) without spending an AI call on them.
//
// Step 2 (processVerificationQueue): every remaining candidate, regardless of
// domain reputation, must be individually confirmed as an actual clothing
// purchase by Groq or Gemini. There is no schema.org "trusted domain" bypass
// and no keyword-only fallback — a retailer selling clothing alongside home
// goods, beauty, or gift cards no longer gets every item auto-accepted just
// because the email carries structured order markup. Schema.org data is
// still used (for its richer multi-item detail) once verification has
// independently confirmed the email is a real clothing receipt. When a
// Gemini key is configured, the queue is split across both providers running
// concurrently — each paced against its own per-minute rate limit — so it
// drains roughly twice as fast as a single provider alone.

export interface GroqProgress {
  done: number;
  total: number;
  /** Set while at least one lane is paused, waiting out its free-tier per-minute rate limit. */
  waitingSeconds?: number;
  /** Present when Gemini is running as a second lane alongside Groq — per-provider counters for the status line. */
  byProvider?: { groq: number; gemini: number };
}

interface QueuedEmail {
  email: EmailMeta;
  domain: string;
  lower: string;
}

/** Builds the ParsedReceipt(s) for a single email once it's been confirmed as
 * a real clothing purchase (by either provider). A single email can yield
 * multiple receipts when Schema.org order markup lists several items. */
function toParsedReceipts(q: QueuedEmail, verified: VerifiedItem): ParsedReceipt[] {
  const { email, domain, lower } = q;
  const fallbackBrand = DOMAIN_TO_BRAND[domain] ?? domain.split(".")[0];
  const retailer = DOMAIN_TO_BRAND[domain] ?? fallbackBrand;
  const schema = email.orderSchema;

  // Confirmed as a real clothing receipt — if the email also has structured
  // Schema.org order data, prefer it (often multi-item and more precise) now
  // that the clothing check has independently passed.
  if (schema && schema.items.length > 0 && !schema.isReturn) {
    const schemaRetailer = schema.merchant ?? retailer;
    const orderDate = parseOrderDate(schema.orderDate ?? email.date);
    return schema.items.map((item) => {
      const sym = item.currency === "GBP" ? "£" : item.currency === "EUR" ? "€" : "$";
      return {
        messageId: email.messageId,
        retailer: schemaRetailer,
        sender: email.from,
        subject: email.subject,
        orderDate,
        price: item.price ? `${sym}${item.price}` : (verified.price ?? extractPrice(lower)),
        itemName: item.name,
        brand: item.brand ?? schemaRetailer,
        category: guessCategory(`${item.name} ${item.brand ?? ""}`),
        season: guessSeason(`${item.name} ${item.brand ?? ""}`),
        kind: "purchase" as const,
        imageUrl: email.imageUrl,
      };
    });
  }

  return [
    {
      messageId: email.messageId,
      retailer,
      sender: email.from,
      subject: email.subject,
      orderDate: parseOrderDate(email.date),
      price: verified.price ?? extractPrice(lower),
      itemName: verified.itemName,
      brand: verified.brand || fallbackBrand,
      color: verified.color ?? undefined,
      category: verified.category,
      season: verified.season,
      kind: "purchase" as const,
      imageUrl: email.imageUrl,
    },
  ];
}

interface LaneConfig {
  provider: "groq" | "gemini";
  call: (email: EmailMeta) => Promise<VerifiedItem | null>;
  maxCallsPerMinute: number;
  batchSize: number;
}

/** Runs one provider's slice of the queue, pacing calls to stay within that
 * provider's own free-tier per-minute limit. Rather than capping and
 * dropping or guessing at the rest, it waits out the remainder of the
 * rolling minute and keeps going until its slice is done. Each batch's
 * confirmed receipts are reported immediately via callbacks so two lanes
 * can stream results in interleaved, as soon as each is ready. */
async function runVerificationLane(
  items: QueuedEmail[],
  lane: LaneConfig,
  onBatchDone: (provider: "groq" | "gemini", batchSize: number, receipts: ParsedReceipt[]) => void,
  onWaiting: (provider: "groq" | "gemini", waitingSeconds: number | undefined) => void,
): Promise<void> {
  let windowStart = Date.now();
  let windowCalls = 0;

  for (let i = 0; i < items.length; i += lane.batchSize) {
    if (windowCalls + lane.batchSize > lane.maxCallsPerMinute) {
      const waitMs = Math.max(0, 60_000 - (Date.now() - windowStart));
      if (waitMs > 0) {
        onWaiting(lane.provider, Math.ceil(waitMs / 1000));
        await new Promise((r) => setTimeout(r, waitMs));
      }
      windowStart = Date.now();
      windowCalls = 0;
    }
    onWaiting(lane.provider, undefined);

    const batch = items.slice(i, i + lane.batchSize);
    const settled = await Promise.allSettled(batch.map((q) => lane.call(q.email)));
    windowCalls += batch.length;

    const batchReceipts: ParsedReceipt[] = [];
    settled.forEach((s, j) => {
      if (s.status === "fulfilled" && s.value) {
        batchReceipts.push(...toParsedReceipts(batch[j], s.value));
      }
      // rejected (call failed after retries) or fulfilled with null (provider
      // said not-clothing) both simply mean this email produces no result.
    });

    onBatchDone(lane.provider, batch.length, batchReceipts);
    if (i + lane.batchSize < items.length) await new Promise((r) => setTimeout(r, 1100));
  }
}

/** Verifies the entire queue. When a Gemini key is configured, the queue is
 * split (alternating) across two independent lanes — Groq and Gemini — that
 * run concurrently, each paced against its own per-minute rate limit. Since
 * the limits are independent, running both at once processes the combined
 * queue roughly twice as fast as a single provider. Falls back to a single
 * Groq lane when no Gemini key is set. */
async function processVerificationQueue(
  queue: QueuedEmail[],
  onProgress?: (p: GroqProgress) => void,
  onReceipts?: (newlyConfirmed: ParsedReceipt[]) => void,
): Promise<ParsedReceipt[]> {
  const dualThreaded = !!GEMINI_API_KEY;
  const groqItems: QueuedEmail[] = [];
  const geminiItems: QueuedEmail[] = [];
  queue.forEach((q, i) => {
    if (dualThreaded && i % 2 === 1) geminiItems.push(q);
    else groqItems.push(q);
  });

  const total = queue.length;
  const allResults: ParsedReceipt[] = [];
  const done = { groq: 0, gemini: 0 };
  const waiting: { groq?: number; gemini?: number } = {};

  function reportProgress() {
    const waitingSeconds = waiting.groq ?? waiting.gemini;
    onProgress?.({
      done: done.groq + done.gemini,
      total,
      waitingSeconds,
      byProvider: dualThreaded ? { ...done } : undefined,
    });
  }

  const lanes: Promise<void>[] = [
    runVerificationLane(
      groqItems,
      { provider: "groq", call: groqParseEmail, maxCallsPerMinute: GROQ_MAX_CALLS, batchSize: 5 },
      (_provider, batchSize, receipts) => {
        done.groq += batchSize;
        if (receipts.length > 0) { allResults.push(...receipts); onReceipts?.(receipts); }
        reportProgress();
      },
      (_provider, s) => { waiting.groq = s; reportProgress(); },
    ),
  ];

  if (dualThreaded) {
    lanes.push(
      runVerificationLane(
        geminiItems,
        { provider: "gemini", call: geminiParseEmail, maxCallsPerMinute: GEMINI_MAX_CALLS, batchSize: 3 },
        (_provider, batchSize, receipts) => {
          done.gemini += batchSize;
          if (receipts.length > 0) { allResults.push(...receipts); onReceipts?.(receipts); }
          reportProgress();
        },
        (_provider, s) => { waiting.gemini = s; reportProgress(); },
      ),
    );
  }

  await Promise.all(lanes);
  return allResults;
}

export async function parseReceiptEmails(
  emails: EmailMeta[],
  onProgress?: (p: GroqProgress) => void,
  onReceipts?: (newlyConfirmed: ParsedReceipt[]) => void,
): Promise<ParsedReceipt[]> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "Clothing verification requires a Groq API key (VITE_GROQ_API_KEY) — every scanned email is checked against it before anything is added.",
    );
  }

  // ── Step 1: cheap pre-filter — reduce the queue without an AI call ──
  const groqQueue: QueuedEmail[] = [];

  for (const email of emails) {
    const domain = extractDomain(email.from);
    if (SKIP_DOMAINS.has(domain)) continue;

    const combinedText = `${email.subject} ${email.snippet} ${email.bodyText ?? ""}`;
    const lower = combinedText.toLowerCase();

    const isPureFashionDomain = FASHION_DOMAINS.has(domain) && !GENERAL_RETAILERS.has(domain);
    const isGeneralRetailer = GENERAL_RETAILERS.has(domain);

    // Only unknown domains get pre-filtered by keyword — known fashion
    // domains and general retailers always go on to the mandatory Groq check.
    if (!isPureFashionDomain && !isGeneralRetailer) {
      const hasClothing = CLOTHING_KEYWORDS.some((kw) => lower.includes(kw));
      const hasNonFashion = NON_FASHION_KEYWORDS.some((kw) => lower.includes(kw));
      if (!hasClothing || hasNonFashion) continue;
    }

    const isReturn = /\b(return|refund|exchange|credit)\b/i.test(email.subject);
    if (isReturn) continue;

    groqQueue.push({ email, domain, lower });
  }

  // ── Step 2: every candidate must pass verification — paced, not capped,
  // dual-threaded across Groq + Gemini when both keys are configured, and
  // streamed back via onReceipts as each batch is confirmed ──
  return processVerificationQueue(groqQueue, onProgress, onReceipts);
}
