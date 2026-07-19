import type { Category, Season } from "@/lib/vesti/store";
import type { EmailMeta } from "@/lib/vesti/gmail-sync";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_MAX_CALLS = 30; // free-tier safety cap (30 req/min)

interface GroqItem {
  isClothing: boolean;
  itemName: string;
  brand: string;
  color: string | null;
  category: Category;
  season: Season;
  price: string | null;
}

async function groqParseEmail(email: EmailMeta): Promise<GroqItem | null> {
  if (!GROQ_API_KEY) return null;
  const text = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Snippet: ${email.snippet}`,
    email.bodyText ? `Body: ${email.bodyText.slice(0, 400)}` : "",
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: `You are a clothing receipt parser. Extract data from this email. If it is NOT a clothing purchase receipt, return {"isClothing":false}.\n\nReturn JSON: {"isClothing":boolean,"itemName":string,"brand":string,"color":string|null,"category":"Tops"|"Bottoms"|"Dresses"|"Outerwear"|"Sweaters"|"Shoes"|"Accessories","season":"Warm"|"Cold"|"Year-round","price":string|null}\n\n${text}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const d = await res.json() as { choices: [{ message: { content: string } }] };
    const parsed = JSON.parse(d.choices[0].message.content) as GroqItem;
    return parsed.isClothing ? parsed : null;
  } catch {
    return null;
  }
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

// ── Main parser (no AI — JSON-LD schema first, regex fallback) ───────────────

export async function parseReceiptEmails(emails: EmailMeta[]): Promise<ParsedReceipt[]> {
  const results: ParsedReceipt[] = [];
  // Queue for Groq verification + extraction
  const groqQueue: { email: EmailMeta; domain: string; lower: string }[] = [];

  for (const email of emails) {
    const domain = extractDomain(email.from);
    if (SKIP_DOMAINS.has(domain)) continue;

    const combinedText = `${email.subject} ${email.snippet} ${email.bodyText ?? ""}`;
    const lower = combinedText.toLowerCase();

    const isPureFashionDomain = FASHION_DOMAINS.has(domain) && !GENERAL_RETAILERS.has(domain);
    const isGeneralRetailer = GENERAL_RETAILERS.has(domain);

    // Unknown domains: must pass clothing keyword pre-filter
    if (!isPureFashionDomain && !isGeneralRetailer) {
      const hasClothing = CLOTHING_KEYWORDS.some((kw) => lower.includes(kw));
      const hasNonFashion = NON_FASHION_KEYWORDS.some((kw) => lower.includes(kw));
      if (!hasClothing || hasNonFashion) continue;
    }

    const isReturn = /\b(return|refund|exchange|credit)\b/i.test(email.subject);
    if (isReturn) continue;
    const fallbackBrand = DOMAIN_TO_BRAND[domain] ?? domain.split(".")[0];

    // ── Path 1: Schema.org JSON-LD — only for pure fashion domains (trusted) ──
    const schema = email.orderSchema;
    if (isPureFashionDomain && schema && (schema.items.length > 0 || schema.merchant)) {
      if (schema.isReturn) continue;
      const retailer = schema.merchant ?? DOMAIN_TO_BRAND[domain] ?? fallbackBrand;
      const orderDate = parseOrderDate(schema.orderDate ?? email.date);

      if (schema.items.length > 0) {
        for (const item of schema.items) {
          const sym = item.currency === "GBP" ? "£" : item.currency === "EUR" ? "€" : "$";
          results.push({
            messageId: email.messageId,
            retailer,
            sender: email.from,
            subject: email.subject,
            orderDate,
            price: item.price ? `${sym}${item.price}` : extractPrice(lower),
            itemName: item.name,
            brand: item.brand ?? retailer,
            category: guessCategory(`${item.name} ${item.brand ?? ""}`),
            season: guessSeason(`${item.name} ${item.brand ?? ""}`),
            kind: "purchase",
            imageUrl: email.imageUrl,
          });
        }
        continue;
      }
    }

    // ── Everything else → Groq queue (verify clothing + extract) ──
    groqQueue.push({ email, domain, lower });
  }

  // ── Path 2: Groq AI (capped at GROQ_MAX_CALLS) then regex fallback ──
  // Groq both verifies the email is a clothing receipt AND extracts item data.
  // General retailers must pass Groq — no regex bypass.
  const groqSlots = GROQ_API_KEY ? Math.min(groqQueue.length, GROQ_MAX_CALLS) : 0;
  const groqResults = new Map<string, GroqItem>();
  const groqAttempted = new Set<string>(); // tracks which emails Groq actually ran on

  if (groqSlots > 0) {
    const toGroq = groqQueue.slice(0, groqSlots);
    for (let i = 0; i < toGroq.length; i += 5) {
      const batch = toGroq.slice(i, i + 5);
      const items = await Promise.all(batch.map((q) => groqParseEmail(q.email)));
      batch.forEach((q, j) => {
        groqAttempted.add(q.email.messageId);
        if (items[j]) groqResults.set(q.email.messageId, items[j]!);
      });
      if (i + 5 < toGroq.length) await new Promise((r) => setTimeout(r, 1100));
    }
  }

  for (const { email, domain, lower } of groqQueue) {
    const fallbackBrand = DOMAIN_TO_BRAND[domain] ?? domain.split(".")[0];
    const groq = groqResults.get(email.messageId);
    const wasAttempted = groqAttempted.has(email.messageId);
    const isGeneralRetailer = GENERAL_RETAILERS.has(domain);

    if (groq) {
      // Groq confirmed it's a clothing purchase
      results.push({
        messageId: email.messageId,
        retailer: DOMAIN_TO_BRAND[domain] ?? fallbackBrand,
        sender: email.from,
        subject: email.subject,
        orderDate: parseOrderDate(email.date),
        price: groq.price ?? extractPrice(lower),
        itemName: groq.itemName,
        brand: groq.brand || fallbackBrand,
        color: groq.color ?? undefined,
        category: groq.category,
        season: groq.season,
        kind: "purchase",
        imageUrl: email.imageUrl,
      });
    } else if (!wasAttempted && !isGeneralRetailer) {
      // Groq cap reached before this email — regex fallback only for pure fashion/clothing domains
      results.push({
        messageId: email.messageId,
        retailer: DOMAIN_TO_BRAND[domain] ?? fallbackBrand,
        sender: email.from,
        subject: email.subject,
        orderDate: parseOrderDate(email.date),
        price: extractPrice(lower),
        itemName: guessItemName(email.subject, fallbackBrand),
        brand: fallbackBrand,
        category: guessCategory(lower),
        season: guessSeason(lower),
        kind: "purchase",
        imageUrl: email.imageUrl,
      });
    }
    // wasAttempted && !groq → Groq rejected it (ad / non-clothing) → drop silently
    // isGeneralRetailer && !groq → always drop
  }

  return results;
}
