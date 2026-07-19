import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { useCloset, closet, type Item, type Category } from "@/lib/vesti/store";
import { useProfile, type UserProfile } from "@/lib/vesti/profile";
import { FitModel, FitModelStage } from "@/components/vesti/FitModel";
import { matchOccasion, type OccasionMatch } from "@/lib/vesti/occasion";
import { buildOutfits, stylingRationale, type Outfit } from "@/lib/vesti/looks";
import { pickPairings } from "@/lib/vesti/suggestions";
import {
  ArrowUpRight,
  BookmarkPlus,
  Check,
  FolderPlus,
  Grid2x2,
  RefreshCw,
  Search,
  Shirt,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";

type AiOutfit = Outfit & { rationale?: string };

async function generateFollowUp(scenario: string): Promise<{ question: string; chips: string[] } | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) return null;
  const prompt = `The user wants to style an outfit for: "${scenario}". Ask one short, natural follow-up question to better understand what they need. Return ONLY valid JSON: {"question": "...", "chips": ["option1", "option2", "option3"]} — 2-4 chip options, each under 5 words.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 100, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as { question: string; chips: string[] };
  } catch { return null; }
}

function buildProfileContext(profile: UserProfile): string {
  const lines: string[] = [];
  if (profile.styleIdentities.length) lines.push(`Style: ${profile.styleIdentities.join(", ")}`);
  if (profile.colors.length) lines.push(`Preferred colors: ${profile.colors.join(", ")}`);
  if (profile.avoidColors) lines.push(`Avoid colors: ${profile.avoidColors}`);
  if (profile.budget.length) lines.push(`Budget sensibility: ${profile.budget.join(", ")}`);
  if (profile.bodyShape) lines.push(`Body shape: ${profile.bodyShape}`);
  if (profile.occasions.length) lines.push(`Typical occasions: ${profile.occasions.join(", ")}`);
  if (profile.brands.length) lines.push(`Loves these brands: ${profile.brands.join(", ")}`);
  if (profile.boldness) lines.push(`Style boldness: ${profile.boldness}/5`);
  if (profile.frustration) lines.push(`Styling frustration: ${profile.frustration}`);
  return lines.length ? `\nAbout this person:\n${lines.map((l) => `- ${l}`).join("\n")}` : "";
}

async function callGeminiStylist(
  scenario: string,
  followUpQ: string,
  followUpA: string,
  items: Item[],
  extraContext?: string,
  weather?: WeatherData | null,
  profile?: UserProfile | null,
  favorites?: Item[],
): Promise<{ answer: string; outfits: AiOutfit[] } | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) return null;
  const itemList = items.map((i) => ({
    id: i.id, name: i.name, brand: i.brand ?? null,
    color: i.color ?? null, category: i.category, season: i.season,
  }));
  const favoritesContext = favorites && favorites.length > 0
    ? `\nFavorite pieces the user loves (prioritize including these where they fit the occasion naturally):\n${favorites.map((i) => `- ${i.name}${i.brand ? ` by ${i.brand}` : ""} (${i.category}${i.color ? `, ${i.color}` : ""})`).join("\n")}`
    : "";
  const prompt = `You are Clem, an elegant personal wardrobe stylist with a quiet luxury aesthetic.

The user is styling for: "${scenario}"
Follow-up — question: "${followUpQ}", their answer: "${followUpA}"${weather ? `\nCurrent weather: ${weather.tempF}°F (${weather.tempC}°C), ${weather.condition}. Factor in the temperature and conditions when choosing pieces — suggest appropriate layering, fabrics, and footwear.` : ""}${profile ? buildProfileContext(profile) : ""}${favoritesContext}${extraContext ? `\nAdditional context from user: "${extraContext}"` : ""}

Their closet:
${JSON.stringify(itemList)}

Create up to 3 outfit combinations using items from their closet that suit this occasion.

Return ONLY valid JSON:
{
  "answer": "Clem's warm 1-2 sentence response about what you found in their closet for this occasion",
  "outfits": [
    {
      "title": "Evocative look name (2-4 words)",
      "vibe": "One-line aesthetic description",
      "rationale": "1-2 sentences on why these pieces work together for this occasion",
      "topId": "<item id or null>",
      "bottomId": "<item id or null>",
      "outerId": "<item id or null>",
      "shoesId": "<item id or null>",
      "accessoryId": "<item id or null>"
    }
  ]
}

Only use IDs from the closet list. Use null if no suitable item exists for that slot.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as {
      answer?: string;
      outfits?: Array<{
        title: string; vibe: string; rationale?: string;
        topId?: string | null; bottomId?: string | null;
        outerId?: string | null; shoesId?: string | null; accessoryId?: string | null;
      }>;
    };
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const outfits: AiOutfit[] = (parsed.outfits ?? [])
      .map((o) => ({
        title: o.title, vibe: o.vibe, rationale: o.rationale,
        top: o.topId ? itemMap.get(o.topId) : undefined,
        bottom: o.bottomId ? itemMap.get(o.bottomId) : undefined,
        outer: o.outerId ? itemMap.get(o.outerId) : undefined,
        shoes: o.shoesId ? itemMap.get(o.shoesId) : undefined,
        accessory: o.accessoryId ? itemMap.get(o.accessoryId) : undefined,
      }))
      .filter((o) => Boolean(o.top ?? o.bottom));
    return { answer: parsed.answer ?? "", outfits };
  } catch {
    return null;
  }
}

interface ShopRec {
  name: string;
  brand: string;
  category: string;
  priceRange: string;
  why: string;
}

async function callGeminiRecos(profile: UserProfile, items: Item[]): Promise<ShopRec[] | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) return null;
  const categoryCounts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {});
  const prompt = `You are Clem, a personal wardrobe stylist. Based on this user's style profile and current closet, recommend exactly 3 specific pieces they should add next.

Style profile:
- Style identity: ${profile.styleIdentities.join(", ") || "not specified"}
- Preferred colors: ${profile.colors.join(", ") || "not specified"}
- Budget: ${profile.budget.join(", ") || "not specified"}
- Occasions they dress for: ${profile.occasions.join(", ") || "not specified"}
- Brands they love: ${profile.brands.join(", ") || "not specified"}
- Colors to avoid: ${profile.avoidColors || "none"}

Current closet by category: ${JSON.stringify(categoryCounts)}

Recommend pieces that fill real gaps or elevate what they already own. Stay within their budget. Match their aesthetic and palette.

Return ONLY valid JSON:
{"recs":[{"name":"specific item name","brand":"real brand name","category":"Tops|Bottoms|Dresses|Shoes|Accessories|Outerwear|Sweaters","priceRange":"$X–$Y","why":"one sentence on why this piece belongs in their wardrobe"}]}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as { recs?: ShopRec[] };
    return parsed.recs ?? null;
  } catch {
    return null;
  }
}

function shopUrl(brand: string, name: string): string {
  const q = encodeURIComponent(`${brand} ${name}`);
  const b = brand.toLowerCase();
  const netaporter = ["the row", "celine", "loewe", "bottega veneta", "jacquemus", "khaite", "toteme", "max mara", "acne studios", "prada", "gucci", "miu miu", "valentino", "dior", "saint laurent", "givenchy", "isabel marant", "officine générale", "nanushka", "nili lotan", "equipment", "a.p.c."];
  const ssense = ["ganni", "rag & bone", "theory", "tibi", "ba&sh", "rotate", "sea new york", "sandy liang", "frame", "doên", "faithfull the brand", "réalisation par", "cos", "arket", "by malene birger"];
  if (netaporter.some((x) => b.includes(x))) return `https://www.net-a-porter.com/en-us/shop/search?q=${q}`;
  if (ssense.some((x) => b.includes(x))) return `https://www.ssense.com/en-us/search?q=${q}`;
  return `https://www.nordstrom.com/sr?keyword=${q}`;
}

const EXAMPLE_PROMPTS = [
  "Lisbon in July",
  "October wedding",
  "Fall capsule",
  "Weekend in Paris",
];

interface WeatherData {
  tempC: number;
  tempF: number;
  condition: string;
}

const WMO: Record<number, string> = {
  0: "clear skies", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "foggy",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow",
  80: "rain showers", 81: "rain showers", 82: "heavy showers",
  95: "thunderstorms",
};

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 }),
    );
    const { latitude: lat, longitude: lon } = pos.coords;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const tempC = json.current?.temperature_2m;
    const code = json.current?.weather_code ?? 0;
    if (tempC === undefined) return null;
    return {
      tempC: Math.round(tempC),
      tempF: Math.round(tempC * 9 / 5 + 32),
      condition: WMO[code] ?? "variable conditions",
    };
  } catch {
    return null;
  }
}

type Slot = "outer" | "top" | "bottom" | "shoes" | "accessory";
const SLOT_TO_CATEGORY: Record<Slot, Category> = {
  outer: "Outerwear",
  top: "Tops",
  bottom: "Bottoms",
  shoes: "Shoes",
  accessory: "Accessories",
};

export const Route = createFileRoute("/outfits")({
  head: () => ({
    meta: [
      { title: "Looks — Clem" },
      {
        name: "description",
        content:
          "A sandbox for styling outfits from your closet — mix, remix, and save looks for trips, events, and ideas.",
      },
    ],
  }),
  component: OutfitsPage,
});

function MannequinLook({
  o,
  onSlotClick,
}: {
  o: Outfit;
  onSlotClick?: (slot: Slot) => void;
}) {
  const slotClass =
    "absolute object-contain mix-blend-multiply cursor-pointer transition hover:scale-[1.03]";
  return (
    <div className="relative w-full aspect-[4/5] rounded-2xl bg-white overflow-hidden border border-border/30">
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[60%] h-px bg-foreground/10" />
      {o.outer && (
        <img
          src={o.outer.image}
          alt={o.outer.name}
          loading="lazy"
          onClick={() => onSlotClick?.("outer")}
          className={`${slotClass} top-[4%] left-1/2 -translate-x-1/2 w-[70%] aspect-[3/4] object-top rotate-[-1deg] opacity-95`}
        />
      )}
      {o.top && (
        <img
          src={o.top.image}
          alt={o.top.name}
          loading="lazy"
          onClick={() => onSlotClick?.("top")}
          className={`${slotClass} top-[10%] left-1/2 -translate-x-1/2 w-[44%] aspect-[3/4] rotate-[1deg] shadow-lg`}
        />
      )}
      {o.bottom && (
        <img
          src={o.bottom.image}
          alt={o.bottom.name}
          loading="lazy"
          onClick={() => onSlotClick?.("bottom")}
          className={`${slotClass} top-[44%] left-1/2 -translate-x-[52%] w-[42%] aspect-[3/4] rotate-[-1deg]`}
        />
      )}
      {o.shoes && (
        <img
          src={o.shoes.image}
          alt={o.shoes.name}
          loading="lazy"
          onClick={() => onSlotClick?.("shoes")}
          className={`${slotClass} bottom-[6%] right-[6%] w-[34%] aspect-square rotate-[4deg]`}
        />
      )}
      {o.accessory && (
        <img
          src={o.accessory.image}
          alt={o.accessory.name}
          loading="lazy"
          onClick={() => onSlotClick?.("accessory")}
          className={`${slotClass} top-[10%] right-[6%] w-[24%] aspect-square rounded-full rotate-[-6deg] border-2 border-background`}
        />
      )}
    </div>
  );
}

type ChatStep = 0 | 1 | 2;

function OutfitsPage() {
  const { items: allItems, folders } = useCloset();
  const { profile } = useProfile();
  const items = useMemo(() => allItems.filter((i) => (i.status ?? "active") === "active"), [allItems]);
  const [seed, setSeed] = useState(0);
  const [savePick, setSavePick] = useState<{ pieces: Item[]; title: string } | null>(null);
  const [savedToFolderId, setSavedToFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [view, setView] = useState<"grid" | "fit">("grid");
  const [tryOn, setTryOn] = useState<{ outfit: Outfit; sponsored: { name: string; brand: string; image: string; category: Category } } | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Partial<Record<Slot, Item>>>>({});
  const [picker, setPicker] = useState<{ lookIndex: number; slot: Slot } | null>(null);
  const [shopRecs, setShopRecs] = useState<ShopRec[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiOutfits, setAiOutfits] = useState<AiOutfit[]>([]);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "clem"; text: string }>>([]);
  const [refineDraft, setRefineDraft] = useState("");

  // Conversational styling state
  const [chatStep, setChatStep] = useState<ChatStep>(0);
  const [draft, setDraft] = useState("");
  const [scenarioAns, setScenarioAns] = useState("");
  const [followUpAns, setFollowUpAns] = useState("");
  const [aiFollowUp, setAiFollowUp] = useState<{ question: string; chips: string[] } | null>(null);
  const [aiFollowUpLoading, setAiFollowUpLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Fetch weather on mount (quietly no-ops if geolocation is denied)
  useEffect(() => {
    fetchWeather().then((w) => { if (w) setWeather(w); }).catch(() => {});
  }, []);

  // Fetch profile-based shop recs once when items are loaded
  useEffect(() => {
    if (items.length === 0) return;
    const hasProfile = profile.styleIdentities.length > 0 || profile.colors.length > 0 || profile.budget.length > 0;
    if (!hasProfile) return;
    setRecsLoading(true);
    callGeminiRecos(profile, items)
      .then((recs) => { setShopRecs(recs); setRecsLoading(false); })
      .catch(() => setRecsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitted = chatStep === 2 ? scenarioAns : "";

  const resetChat = () => {
    setChatStep(0);
    setDraft("");
    setScenarioAns("");
    setFollowUpAns("");
    setAiFollowUp(null);
    setAiFollowUpLoading(false);
    setAiAnswer(null);
    setAiOutfits([]);
    setAiLoading(false);
    setChatHistory([]);
    setRefineDraft("");
  };
  const answerQ1 = (val: string) => {
    const v = val.trim();
    if (!v) return;
    setScenarioAns(v);
    setDraft("");
    setChatStep(1);
    setAiFollowUpLoading(true);
    setAiFollowUp(null);
    generateFollowUp(v)
      .then((result) => { setAiFollowUp(result); setAiFollowUpLoading(false); })
      .catch(() => setAiFollowUpLoading(false));
  };
  const answerQ2 = (val: string) => {
    setFollowUpAns(val);
    setDraft("");
    setChatStep(2);
    setAiLoading(true);
    setAiAnswer(null);
    setAiOutfits([]);
    callGeminiStylist(scenarioAns, aiFollowUp?.question ?? "", val, items, undefined, weather, profile, items.filter((i) => i.favorite))
      .then((result) => {
        if (result) {
          setAiAnswer(result.answer);
          setAiOutfits(result.outfits);
          setChatHistory([{ role: "clem", text: result.answer }]);
        }
        setAiLoading(false);
      })
      .catch(() => setAiLoading(false));
  };

  const refine = (text: string) => {
    const t = text.trim();
    if (!t || aiLoading) return;
    setRefineDraft("");
    setChatHistory((prev) => [...prev, { role: "user", text: t }]);
    setAiLoading(true);
    setAiOutfits([]);
    const extraContext = chatHistory
      .map((m) => `${m.role === "user" ? "User" : "Clem"}: ${m.text}`)
      .concat(`User: ${t}`)
      .join("\n");
    callGeminiStylist(scenarioAns, aiFollowUp?.question ?? "", followUpAns, items, extraContext, weather, profile, items.filter((i) => i.favorite))
      .then((result) => {
        if (result) {
          setAiAnswer(result.answer);
          setAiOutfits(result.outfits);
          setChatHistory((prev) => [...prev, { role: "clem", text: result.answer }]);
        }
        setAiLoading(false);
      })
      .catch(() => setAiLoading(false));
  };

  const baseOutfits = useMemo(() => buildOutfits(items, seed), [items, seed]);
  const outfits = useMemo(
    () =>
      baseOutfits.map((o, i) => {
        const ov = overrides[i];
        if (!ov) return o;
        return { ...o, ...ov };
      }),
    [baseOutfits, overrides],
  );
  const occasion: OccasionMatch | null = useMemo(
    () => (submitted.trim() ? matchOccasion(submitted, items) : null),
    [submitted, items],
  );

  const swapSlot = (lookIndex: number, slot: Slot, item: Item) => {
    setOverrides((prev) => ({
      ...prev,
      [lookIndex]: { ...prev[lookIndex], [slot]: item },
    }));
    setPicker(null);
  };

  const reshuffle = () => {
    setOverrides({});
    setSeed((s) => s + 1);
  };

  const saveLookToFolder = (folderId: string) => {
    if (!savePick) return;
    closet.addItemsToFolder(folderId, savePick.pieces.map((p) => p.id));
    setSavedToFolderId(folderId);
    setTimeout(() => {
      setSavePick(null);
      setSavedToFolderId(null);
    }, 900);
  };

  const createAndSave = () => {
    const name = newFolderName.trim();
    if (!name || !savePick) return;
    const folder = closet.createFolder(name);
    closet.addItemsToFolder(folder.id, savePick.pieces.map((p) => p.id));
    setNewFolderName("");
    setSavedToFolderId(folder.id);
    setTimeout(() => {
      setSavePick(null);
      setSavedToFolderId(null);
    }, 900);
  };

  const pickerOptions = useMemo(() => {
    if (!picker) return [];
    return items.filter((i) => i.category === SLOT_TO_CATEGORY[picker.slot]);
  }, [picker, items]);

  return (
    <PageShell title="Looks">
      <section className="px-6 pt-6">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">Sandbox</p>
            <h1 className="font-serif text-3xl leading-none tracking-[0.06em] uppercase">
              Play with looks
            </h1>
          </div>
          <button
            type="button"
            onClick={reshuffle}
            className="text-xs border border-border px-3 py-1.5 rounded-full bg-card flex items-center gap-1.5 active:scale-95 transition"
          >
            <RefreshCw className="size-3" strokeWidth={1.75} /> Reshuffle
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4 max-w-[32ch]">
          Mix, remix, and save outfits for what&rsquo;s next — a trip, an event, an idea. Tap any
          piece to swap it.
        </p>

        {/* View toggle */}
        <div className="inline-flex items-center gap-1 p-1 mb-5 rounded-full bg-card border border-border">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition ${view === "grid" ? "bg-mauve text-cream" : "text-ink/60"}`}
          >
            <Grid2x2 className="size-3" strokeWidth={1.5} /> Grid view
          </button>
          <button
            type="button"
            onClick={() => setView("fit")}
            className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition ${view === "fit" ? "bg-mauve text-cream" : "text-ink/60"}`}
          >
            <Shirt className="size-3" strokeWidth={1.5} /> Fit model view
          </button>
        </div>

        {/* Conversational styling — iMessage-style thread with Clem */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          {weather && (
            <div className="mb-3 text-[10px] text-muted-foreground">
              {weather.tempF}°F · {weather.condition}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex justify-start">
              <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-mint-soft/50 text-foreground px-3.5 py-2 text-sm leading-snug">
                What are you styling for?
              </div>
            </div>

            {chatStep >= 1 && (
              <div className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl rounded-br-md bg-mauve text-cream px-3.5 py-2 text-sm leading-snug">
                  {scenarioAns}
                </div>
              </div>
            )}

            {chatStep >= 1 && aiFollowUpLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-mint-soft/50 px-4 py-3 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {chatStep >= 1 && aiFollowUp && !aiFollowUpLoading && (
              <div className="flex justify-start">
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-mint-soft/50 text-foreground px-3.5 py-2 text-sm leading-snug">
                  {aiFollowUp.question}
                </div>
              </div>
            )}

            {chatStep >= 2 && (
              <div className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl rounded-br-md bg-mauve text-cream px-3.5 py-2 text-sm leading-snug">
                  {followUpAns}
                </div>
              </div>
            )}

            {chatStep >= 2 && chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${msg.role === "user" ? "rounded-br-md bg-mauve text-cream" : "rounded-bl-md bg-mint-soft/50 text-foreground"}`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {chatStep >= 2 && aiLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-mint-soft/50 px-4 py-3 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border/60">
            {chatStep === 0 && (
              <>
                <form onSubmit={(e) => { e.preventDefault(); answerQ1(draft); }} className="relative">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="iMessage Clem…"
                    className="w-full bg-background border border-border rounded-full pl-4 pr-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/30"
                  />
                </form>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button key={p} type="button" onClick={() => answerQ1(p)}
                      className="text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition">
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}

            {chatStep === 1 && (aiFollowUp || !aiFollowUpLoading) && (
              <>
                <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) answerQ2(draft.trim()); }} className="relative mb-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply to Clem…"
                    className="w-full bg-background border border-border rounded-full pl-4 pr-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/30"
                  />
                </form>
                {aiFollowUp && (
                  <div className="flex flex-wrap gap-1.5">
                    {aiFollowUp.chips.map((c) => (
                      <button key={c} type="button" onClick={() => answerQ2(c)}
                        className="text-[11px] tracking-[0.04em] px-3 py-1.5 rounded-full border border-mauve/40 text-foreground bg-mauve/5 hover:bg-mauve/15 transition">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {chatStep === 2 && (
              <>
                <form onSubmit={(e) => { e.preventDefault(); refine(refineDraft); }} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={refineDraft}
                    onChange={(e) => setRefineDraft(e.target.value)}
                    disabled={aiLoading}
                    placeholder="Add more context…"
                    className="flex-1 bg-background border border-border rounded-full pl-4 pr-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
                  />
                  <button type="submit" disabled={!refineDraft.trim() || aiLoading}
                    className="rounded-full bg-foreground text-background px-4 text-xs font-medium active:scale-95 transition disabled:opacity-30">
                    Send
                  </button>
                </form>
                <button type="button" onClick={resetChat}
                  className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition">
                  <X className="size-3" strokeWidth={1.5} /> Start over
                </button>
              </>
            )}
          </div>
        </div>




        {/* Profile-based purchase recommendations */}
        {(recsLoading || (shopRecs && shopRecs.length > 0)) && (
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.28em] text-mint mb-1">Clem recommends</p>
            <p className="text-[10px] text-muted-foreground mb-3">
              {recsLoading ? "Curating for your wardrobe…" : `Picked for your style · ${profile.styleIdentities[0] ?? "your closet"}`}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 snap-x snap-mandatory">
              {recsLoading
                ? [0, 1, 2].map((i) => (
                    <div key={i} className="flex-none w-44 h-48 rounded-2xl bg-card border border-border animate-pulse snap-start" />
                  ))
                : shopRecs!.map((rec, i) => (
                    <a
                      key={i}
                      href={shopUrl(rec.brand, rec.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none w-44 snap-start rounded-2xl border border-border bg-card p-4 flex flex-col gap-2 active:scale-95 transition"
                    >
                      <span className="text-[9px] uppercase tracking-[0.2em] text-mint">{rec.category}</span>
                      <div>
                        <p className="text-xs font-medium text-foreground leading-snug">{rec.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{rec.brand}</p>
                      </div>
                      <p className="text-[10px] font-serif italic text-ink/70 leading-snug flex-1">{rec.why}</p>
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/40">
                        <span className="text-[10px] text-foreground/70">{rec.priceRange}</span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-[0.18em] text-mint">
                          Shop <ArrowUpRight className="size-3" strokeWidth={1.5} />
                        </span>
                      </div>
                    </a>
                  ))}
            </div>
          </div>
        )}

        {occasion && chatHistory.length === 0 && !aiLoading && (
          <div className="mb-8 animate-rise border border-mint-soft/60 bg-mint-soft/20 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-2">
              {occasion.intent}
            </p>
            <p className="font-serif text-lg leading-snug mb-4 tracking-[0.02em]">
              {occasion.answer}
            </p>
            {occasion.results.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {occasion.results.map((it) => (
                  <div key={it.id}>
                    <div className="aspect-[4/5] bg-card overflow-hidden rounded-sm">
                      <img
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-[10px] mt-1 truncate text-foreground/80">{it.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aiOutfits.length > 0 && (
          <div className="mb-8 animate-rise">
            <p className="text-[10px] uppercase tracking-[0.28em] text-mint mb-1">Styled for you</p>
            <p className="text-[10px] text-muted-foreground mb-4">Picked by Clem · {scenarioAns}</p>
            <div className="space-y-8">
              {aiOutfits.map((o, i) => {
                const pieces = [o.outer, o.top, o.bottom, o.shoes, o.accessory].filter(Boolean) as Item[];
                return (
                  <article key={`ai-${i}`} className="animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
                    {view === "fit" ? (
                      <FitModelStage className="py-4">
                        <FitModel
                          className="max-w-[260px]"
                          height={profile.height}
                          weight={profile.weight}
                          shape={profile.bodyShape}
                          skinTone={(profile.skinTone || "light") as never}
                          outfit={{
                            outer: o.outer ?? undefined, top: o.top ?? undefined,
                            bottom: o.bottom ?? undefined, shoes: o.shoes ?? undefined,
                            accessory: o.accessory ?? undefined,
                          }}
                          onSlotClick={(slot) => setPicker({ lookIndex: -(i + 1), slot })}
                        />
                      </FitModelStage>
                    ) : (
                      <MannequinLook o={o} onSlotClick={(slot) => setPicker({ lookIndex: -(i + 1), slot })} />
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.22em] text-mint">Look {String(i + 1).padStart(2, "0")} · AI styled</p>
                        <p className="font-serif text-base leading-tight tracking-[0.04em] uppercase truncate">{o.title}</p>
                        {o.rationale && <p className="text-[10px] font-serif italic text-ink/60 mt-0.5 leading-snug">{o.rationale}</p>}
                      </div>
                      {pieces.length > 0 && (
                        <button type="button" onClick={() => setSavePick({ pieces, title: o.title })}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] border border-ink/25 text-ink/70 px-3 py-2 hover:bg-ink hover:text-cream transition active:scale-95">
                          <BookmarkPlus className="size-3" strokeWidth={1.5} /> Save
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-6 mb-2 border-t border-border/40 pt-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-1">All looks</p>
            </div>
          </div>
        )}

        {outfits.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="size-7 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="font-serif text-xl mb-1 tracking-[0.04em] uppercase">
              Add some pieces first
            </p>
            <p className="text-xs">Looks appear once your closet has a few items.</p>
          </div>
        ) : (
          <div className="space-y-8 pb-10">
            {outfits.map((o, i) => {
              const pieces = [o.outer, o.top, o.bottom, o.shoes, o.accessory].filter(
                Boolean,
              ) as Item[];
              const remixed = Boolean(overrides[i]);
              return (
                <article
                  key={`${o.title}-${seed}-${i}`}
                  className="animate-rise"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {view === "fit" ? (
                    <FitModelStage className="py-4">
                      <FitModel
                        className="max-w-[260px]"
                        height={profile.height}
                        weight={profile.weight}
                        shape={profile.bodyShape}
                        skinTone={(profile.skinTone || "light") as never}
                        outfit={{
                          outer: o.outer ?? undefined,
                          top: o.top ?? undefined,
                          bottom: o.bottom ?? undefined,
                          shoes: o.shoes ?? undefined,
                          accessory: o.accessory ?? undefined,
                        }}
                        onSlotClick={(slot) => setPicker({ lookIndex: i, slot })}
                      />
                    </FitModelStage>
                  ) : (
                    <MannequinLook
                      o={o}
                      onSlotClick={(slot) => setPicker({ lookIndex: i, slot })}
                    />
                  )}

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-[0.22em] text-mint">
                        Look {String(i + 1).padStart(2, "0")}{remixed ? " · remixed" : ""}
                      </p>
                      <p className="font-serif text-base leading-tight tracking-[0.04em] uppercase truncate">{o.title}</p>
                    </div>
                    {pieces.length > 0 && (
                      <div className="flex gap-2 shrink-0">
                        <button type="button" onClick={() => setSavePick({ pieces, title: o.title })}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] border border-ink/25 text-ink/70 px-3 py-2 hover:bg-ink hover:text-cream transition active:scale-95">
                          <BookmarkPlus className="size-3" strokeWidth={1.5} /> Save
                        </button>
                        <button type="button" onClick={() => setPicker({ lookIndex: i, slot: "top" })}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] border border-ink/25 text-ink/70 px-3 py-2 hover:bg-ink hover:text-cream transition active:scale-95">
                          <Shuffle className="size-3" strokeWidth={1.5} /> Remix
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Suggested pairings from retailers */}
                  {(() => {
                    const suggestions = pickPairings(o, 2);
                    if (suggestions.length === 0) return null;
                    return (
                      <div className="mt-5 pt-4 border-t border-border/60">
                        <div className="flex items-baseline justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-sage">
                            Pairs well · Sponsored
                          </p>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground italic">
                            Hand-picked
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {suggestions.map((s) => (
                            <div key={s.id}>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer sponsored"
                                className="group block"
                              >
                                <div className="relative aspect-[4/5] bg-card overflow-hidden mb-2 rounded-sm">
                                  <img
                                    src={s.image}
                                    alt={s.name}
                                    loading="lazy"
                                    width={1024}
                                    height={1024}
                                    className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.03]"
                                  />
                                  <span className="absolute top-2 left-2 text-[8px] uppercase tracking-[0.22em] bg-background/85 backdrop-blur px-1.5 py-0.5 text-foreground/80">
                                    {s.retailer}
                                  </span>
                                </div>
                                <p className="text-[10px] uppercase tracking-[0.14em] text-foreground leading-tight">
                                  {s.brand}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                  {s.name}
                                </p>
                                <p className="flex items-center gap-1 text-[10px] mt-1 text-foreground/80 tracking-wide">
                                  {s.price}
                                  <ArrowUpRight className="size-3 opacity-60" strokeWidth={1.5} />
                                </p>
                              </a>
                              <button
                                type="button"
                                onClick={() => setTryOn({ outfit: o, sponsored: { name: s.name, brand: s.brand, image: s.image, category: s.category } })}
                                className="mt-1.5 w-full text-[10px] uppercase tracking-[0.2em] border border-ink/25 text-ink/80 py-1.5 hover:bg-ink hover:text-cream transition"
                              >
                                Try on
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        )}

      </section>


      {/* Slot picker — swap a single piece */}
      {picker && (
        <div
          className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-end justify-center animate-rise"
          onClick={() => setPicker(null)}
        >
          <div
            className="w-full max-w-md bg-cream rounded-t-2xl pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)] px-6 shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-mauve mb-1">Swap</p>
            <h3 className="font-serif text-xl tracking-[0.04em] uppercase text-ink mb-4">
              Pick a {SLOT_TO_CATEGORY[picker.slot].toLowerCase().replace(/s$/, "")}
            </h3>
            {pickerOptions.length === 0 ? (
              <p className="text-xs text-ink/50 italic py-6 text-center">
                No {SLOT_TO_CATEGORY[picker.slot].toLowerCase()} in your closet yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto -mx-2 px-2">
                {pickerOptions.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => swapSlot(picker.lookIndex, picker.slot, it)}
                    className="text-left active:scale-95 transition"
                  >
                    <div className="aspect-[4/5] bg-card overflow-hidden rounded-sm">
                      <img
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-[10px] mt-1 truncate text-ink/80">{it.name}</p>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPicker(null)}
              className="mt-4 w-full text-[10px] uppercase tracking-[0.22em] text-ink/45 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {savePick && (
        <div
          className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-end justify-center animate-rise"
          onClick={() => setSavePick(null)}
        >
          <div
            className="w-full max-w-md bg-cream rounded-t-2xl pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)] px-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-mauve mb-1">Save look</p>
            <h3 className="font-serif text-xl tracking-[0.04em] uppercase text-ink mb-1">
              {savePick.title}
            </h3>
            <p className="text-xs text-ink/60 mb-5">
              Add all {savePick.pieces.length} pieces to a collection folder.
            </p>

            <div className="max-h-[40vh] overflow-y-auto -mx-2 px-2">
              {folders.length === 0 ? (
                <p className="text-xs text-ink/50 italic py-2">
                  No folders yet — create one below.
                </p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {folders.map((f) => {
                    const justSaved = savedToFolderId === f.id;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => saveLookToFolder(f.id)}
                          className="w-full flex items-center justify-between py-3 text-left hover:text-mauve transition"
                        >
                          <span className="flex items-center gap-3">
                            <span className="size-9 rounded bg-mint-soft/40 overflow-hidden grid place-items-center text-ink/40 text-[10px]">
                              {f.cover ? (
                                <img
                                  src={f.cover}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                f.name.slice(0, 1).toUpperCase()
                              )}
                            </span>
                            <span>
                              <span className="block text-sm text-ink">{f.name}</span>
                              <span className="block text-[10px] uppercase tracking-[0.18em] text-ink/45">
                                {f.itemIds.length} pieces
                              </span>
                            </span>
                          </span>
                          {justSaved ? (
                            <Check className="size-4 text-mauve" strokeWidth={2} />
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.2em] text-ink/50">
                              Add
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAndSave();
              }}
              className="mt-4 pt-4 border-t border-ink/10 flex items-center gap-2"
            >
              <FolderPlus className="size-4 text-ink/50" strokeWidth={1.5} />
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                className="flex-1 bg-transparent border-b border-ink/20 py-1.5 text-sm placeholder:text-ink/40 focus:outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="text-[10px] uppercase tracking-[0.2em] text-ink/70 disabled:opacity-30"
              >
                Create & save
              </button>
            </form>

            <button
              type="button"
              onClick={() => setSavePick(null)}
              className="mt-3 w-full text-[10px] uppercase tracking-[0.22em] text-ink/45 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Try-on sheet for sponsored items */}
      {tryOn && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end justify-center animate-rise"
          onClick={() => setTryOn(null)}
        >
          <div
            className="w-full max-w-md bg-cream rounded-t-2xl pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)] px-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-mauve mb-1">Virtual try-on</p>
            <h3 className="font-serif text-xl tracking-[0.04em] uppercase text-ink mb-1">
              {tryOn.sponsored.brand}
            </h3>
            <p className="text-xs text-ink/60 mb-4">{tryOn.sponsored.name}</p>
            <FitModelStage className="py-3">
              <FitModel
                className="max-w-[220px]"
                height={profile.height}
                weight={profile.weight}
                shape={profile.bodyShape}
                skinTone={(profile.skinTone || "light") as never}
                outfit={(() => {
                  const cat = tryOn.sponsored.category;
                  const swap: Partial<Record<Slot, Item>> = {};
                  const fake = { id: "try-on", name: tryOn.sponsored.name, image: tryOn.sponsored.image } as unknown as Item;
                  if (cat === "Outerwear") swap.outer = fake;
                  else if (cat === "Tops") swap.top = fake;
                  else if (cat === "Bottoms") swap.bottom = fake;
                  else if (cat === "Shoes") swap.shoes = fake;
                  else swap.accessory = fake;
                  return {
                    outer: tryOn.outfit.outer ?? undefined,
                    top: tryOn.outfit.top ?? undefined,
                    bottom: tryOn.outfit.bottom ?? undefined,
                    shoes: tryOn.outfit.shoes ?? undefined,
                    accessory: tryOn.outfit.accessory ?? undefined,
                    ...swap,
                  };
                })()}
              />
            </FitModelStage>
            <p className="text-[11px] text-ink/55 text-center mt-3 italic">
              On your fit model, with the rest of {tryOn.outfit.title}.
            </p>
            <button
              type="button"
              onClick={() => setTryOn(null)}
              className="mt-4 w-full text-[10px] uppercase tracking-[0.22em] text-ink/45 py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
