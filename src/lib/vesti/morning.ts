import type { Item, Season } from "./store";
import type { UserProfile } from "./profile";
import { buildOutfits } from "./looks";

export interface MorningWeather {
  tempC: number;
  tempF: number;
  label: string; // e.g. "62° · clear"
  pack: Season;
  place?: string;
}

export type OccasionTag = "Work" | "Weekend" | "Event";
export type MomentTag = "Morning" | "Midday" | "After work" | "Tonight";

export function momentFor(hour = new Date().getHours()): MomentTag {
  if (hour < 11) return "Morning";
  if (hour < 16) return "Midday";
  if (hour < 20) return "After work";
  return "Tonight";
}

export function greetingFor(
  name: string | undefined,
  hour = new Date().getHours(),
  rushed = false,
): string {
  const n = (name ?? "").trim();
  const who = n.length > 0 ? n : "love";
  if (rushed) return `Quick, ${who} — here's your move.`;
  const moment = momentFor(hour);
  switch (moment) {
    case "Morning":
      return hour < 8
        ? `Good morning, ${who}. Let's get you dressed.`
        : `Morning, ${who}. You've got this.`;
    case "Midday":
      return `Hey ${who} — what's the next thing?`;
    case "After work":
      return `Evening, ${who}. Reset and re-style.`;
    case "Tonight":
      return `Tonight, ${who} — make it count.`;
  }
}

export function momentBlurb(moment: MomentTag, rushed: boolean): string {
  if (rushed) return "One look. Grab and go.";
  switch (moment) {
    case "Morning": return "One considered look to start the day.";
    case "Midday": return "A pivot piece for the rest of the day.";
    case "After work": return "Happy hour, dinner, drop-in plans.";
    case "Tonight": return "Something memorable for the evening.";
  }
}

export function isMorningHour(hour = new Date().getHours()): boolean {
  return hour < 10;
}

export function dayOfWeekLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

export function occasionForToday(
  profile: UserProfile,
  date = new Date(),
  moment: MomentTag = momentFor(date.getHours()),
): OccasionTag {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  const occ = profile.occasions ?? [];
  if (moment === "Tonight") return "Event";
  if (moment === "After work" && !isWeekend) return "Event";
  if (isWeekend) return "Weekend";
  if (day === 5 && occ.some((o) => /event/i.test(o))) return "Event";
  if (occ.some((o) => /work/i.test(o))) return "Work";
  if (occ.some((o) => /event/i.test(o))) return "Event";
  return "Weekend";
}

// Rotating reassurance line — deterministic per local date.
const TAGLINES = [
  "Dressed with intention.",
  "Your wardrobe, working for you.",
  "Looking like yourself — always the right choice.",
  "One less thing to think about.",
  "Quiet confidence, in pieces you love.",
  "Today, you wore something you chose on purpose.",
  "Showing up — beautifully.",
];

export function taglineForToday(date = new Date()): string {
  const epochDay = Math.floor(date.getTime() / 86_400_000);
  return TAGLINES[((epochDay % TAGLINES.length) + TAGLINES.length) % TAGLINES.length];
}

// Daily inspirational quote — warm, motivating, personal.
const QUOTES = [
  "You are capable of amazing things.",
  "Small steps every day lead to extraordinary places.",
  "Let your light shine today.",
  "You don't have to be perfect to be amazing.",
  "The best way to predict the future is to create it.",
  "You are stronger than you know.",
  "Believe you can and you're halfway there.",
  "Your only limit is your mind.",
  "Start where you are. Use what you have. Do what you can.",
  "Every day is a fresh start.",
  "Progress, not perfection.",
  "You are exactly where you need to be.",
  "The sun is a daily reminder that we too can rise again.",
  "Be gentle with yourself. You're doing the best you can.",
  "You are enough, just as you are.",
  "Courage starts with showing up.",
  "Turn your wounds into wisdom.",
  "Nothing is impossible. The word itself says I'm possible.",
  "You have the power to create change.",
  "Don't wait for opportunity. Create it.",
  "Storms make trees take deeper roots.",
  "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
  "Breathe. It's just a bad day, not a bad life.",
  "Do something today that your future self will thank you for.",
  "You are the author of your own story.",
  "Even the darkest night will end and the sun will rise.",
  "Comparison is the thief of joy. Run your own race.",
  "You don't fail, you learn.",
  "Your potential is endless.",
  "Kindness is always a good idea.",
];

export function quoteForToday(date = new Date()): string {
  const epochDay = Math.floor(date.getTime() / 86_400_000);
  return QUOTES[((epochDay % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

const WEATHER_CODE_LABEL: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "fog",
  51: "drizzle", 53: "drizzle", 55: "drizzle",
  61: "rain", 63: "rain", 65: "heavy rain",
  71: "snow", 73: "snow", 75: "snow",
  80: "showers", 81: "showers", 82: "showers",
  95: "storms", 96: "storms", 99: "storms",
};

function packFor(tempC: number): Season {
  if (tempC >= 22) return "Warm";
  if (tempC <= 12) return "Cold";
  return "Year-round";
}

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`,
    );
    if (!r.ok) return;
    const j = await r.json();
    return j?.results?.[0]?.name;
  } catch {
    return;
  }
}

async function fetchAt(lat: number, lon: number): Promise<MorningWeather | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const tempC = Math.round(j?.current?.temperature_2m ?? NaN);
  const code = j?.current?.weather_code ?? 0;
  if (Number.isNaN(tempC)) return null;
  const tempF = Math.round((tempC * 9) / 5 + 32);
  const desc = WEATHER_CODE_LABEL[code] ?? "fair";
  const place = await reverseGeocode(lat, lon);
  return { tempC, tempF, label: `${tempF}° · ${desc}`, pack: packFor(tempC), place };
}

export async function getMorningWeather(city?: string): Promise<MorningWeather | null> {
  // Prefer browser geolocation; fall back to city; final fallback handled by caller.
  if (typeof window !== "undefined" && "geolocation" in navigator) {
    const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 4000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); resolve(p.coords); },
        () => { clearTimeout(timer); resolve(null); },
        { maximumAge: 60 * 60 * 1000, timeout: 4000 },
      );
    });
    if (coords) return fetchAt(coords.latitude, coords.longitude);
  }
  if (city && city.trim()) {
    try {
      const g = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      );
      const gj = await g.json();
      const r = gj?.results?.[0];
      if (r) return fetchAt(r.latitude, r.longitude);
    } catch {
      /* ignore */
    }
  }
  return null;
}

export interface TodayLook {
  outer?: Item;
  top?: Item;
  bottom?: Item;
  shoes?: Item;
  accessory?: Item;
  note: string;
}

const FORMAL_NOTES = [
  "Layered for ease — slip the outer off the moment the room warms.",
  "Anchored in neutrals so the shoes can do the talking.",
  "Soft volume on top, clean line down — your most flattering proportion.",
  "Tonal head-to-toe, then one piece of metal to lift it.",
  "Quiet polish: nothing competing, everything intentional.",
  "Texture over color today — let the fabrics carry the look.",
  "A classic foundation with one piece that makes it feel like yours.",
];

const FUN_NOTES = [
  "A playful statement piece, grounded by just enough polish.",
  "Let the texture and shine do the talking tonight.",
  "A little more color, a little more movement — made for going out.",
  "The fun is in the finish: bold shoes and jewelry pull it together.",
];

type StyleMood = "Formal" | "Fun";

function moodFor(moment: MomentTag): StyleMood {
  return moment === "Morning" || moment === "Midday" ? "Formal" : "Fun";
}

function noteFor(mood: StyleMood, seed: number): string {
  const notes = mood === "Formal" ? FORMAL_NOTES : FUN_NOTES;
  return notes[((seed % notes.length) + notes.length) % notes.length];
}

export function buildTodayLook(
  items: Item[],
  pack: Season | undefined,
  occasion: OccasionTag,
  seed: number,
  moment: MomentTag = momentFor(),
): TodayLook | null {
  if (items.length === 0) return null;
  const mood = moodFor(moment);

  // Season filter — keep "Year-round" plus matching pack
  const seasonOk = (it: Item) =>
    !pack || pack === "Year-round" || it.season === pack || it.season === "Year-round";

  // Occasion and time-of-day bias: rough keyword scoring on name/brand/color
  const bias = (it: Item): number => {
    const t = `${it.name} ${it.brand ?? ""} ${it.color ?? ""}`.toLowerCase();
    let score = 0;
    if (mood === "Formal") {
      if (/(blazer|trouser|tailored|button|poplin|blouse|topcoat|trench|structured|pointed|midi|loafer|flat)/.test(t)) score += 4;
      if (/(sequin|halter|crop|mini|stiletto)/.test(t)) score -= 4;
    } else {
      if (/(sequin|satin|silk|slip|halter|crop|mini|leather|heel|stiletto|gold|chain|hoop)/.test(t)) score += 4;
      if (/(button|poplin|trouser|topcoat)/.test(t)) score -= 2;
    }
    if (occasion === "Work") {
      if (/(blazer|trouser|button|poplin|tailored|knit|topcoat|sneaker|loafer|flat)/.test(t)) score += 2;
      if (/(sequin|crochet|halter|mini)/.test(t)) score -= 2;
    } else if (occasion === "Event") {
      if (/(sequin|silk|slip|heel|stiletto|mini|sandal|necklace|pearl|gold)/.test(t)) score += 2;
      if (/(sneaker|denim|jean)/.test(t)) score -= 1;
    } else {
      // Weekend
      if (/(denim|jean|sneaker|knit|sweater|cashmere|skirt|trench|hat|scarf)/.test(t)) score += 2;
      if (/(stiletto|sequin)/.test(t)) score -= 1;
    }
    return score;
  };

  const pickOne = (cat: Item["category"], salt: number): Item | undefined => {
    const pool = items.filter((i) => i.category === cat && seasonOk(i));
    if (pool.length === 0) return undefined;
    const scored = pool
      .map((it) => ({ it, score: bias(it) + (Math.abs((it.id.charCodeAt(1) || 0) + seed + salt) % 5) * 0.1 }))
      .sort((a, b) => b.score - a.score);
    // Rotate among top candidates
    const top = scored.slice(0, Math.min(scored.length, 4));
    return top[(seed + salt) % top.length].it;
  };

  const wantsOuter = pack !== "Warm";
  const look: TodayLook = {
    top: pickOne("Tops", 0),
    bottom: pickOne("Bottoms", 1),
    shoes: pickOne("Shoes", 2),
    accessory: pickOne("Accessories", 3),
    outer: wantsOuter ? pickOne("Outerwear", 4) : undefined,
    note: noteFor(mood, seed),
  };
  if (!look.top && !look.bottom) return null;
  return look;
}

/**
 * Pull a TodayLook from the shared Lookbook (`buildOutfits`) so Morning/Right-Now
 * and the Collections tab share a single source of truth. Falls back to the
 * heuristic `buildTodayLook` when the lookbook can't produce a match.
 */
export function pickLookFromLookbook(
  items: Item[],
  pack: Season | undefined,
  occasion: OccasionTag,
  seed: number,
  moment: MomentTag = momentFor(),
): TodayLook | null {
  const looks = buildOutfits(items, seed);
  if (looks.length === 0) return buildTodayLook(items, pack, occasion, seed, moment);
  const mood = moodFor(moment);

  // Score both the lookbook vibe and its actual pieces so time of day changes the recommendation.
  const scored = looks.map((o) => {
    const pieces = [o.outer, o.top, o.bottom, o.shoes, o.accessory]
      .filter(Boolean)
      .map((it) => `${it!.name} ${it!.brand ?? ""} ${it!.color ?? ""}`)
      .join(" ");
    const t = `${o.title} ${o.vibe} ${pieces}`.toLowerCase();
    let s = 0;
    if (occasion === "Event" && /(evening|paris|gallery|cocktail|night)/.test(t)) s += 3;
    if (occasion === "Work" && /(studio|composition|quiet|tailored)/.test(t)) s += 3;
    if (occasion === "Weekend" && /(sunday|coastal|lunch|bookshop)/.test(t)) s += 3;
    if (mood === "Formal") {
      if (/(polished|studio|composition|quiet|blazer|trouser|tailored|button|poplin|blouse|topcoat|trench|structured|pointed|midi|loafer|flat)/.test(t)) s += 5;
      if (/(playful|sequin|halter|crop|mini|stiletto)/.test(t)) s -= 5;
    } else {
      if (/(playful|evening|paris|gallery|night|sequin|satin|silk|slip|halter|crop|mini|leather|heel|stiletto|gold|chain|hoop)/.test(t)) s += 5;
      if (/(button|poplin|trouser|topcoat)/.test(t)) s -= 2;
    }
    return { o, s };
  }).sort((a, b) => b.s - a.s);

  const bestScore = scored[0].s;
  const best = scored.filter(({ s }) => s === bestScore);
  const chosen = best[((seed % best.length) + best.length) % best.length].o;
  const wantsOuter = pack !== "Warm";
  return {
    top: chosen.top,
    bottom: chosen.bottom,
    shoes: chosen.shoes,
    accessory: chosen.accessory,
    outer: wantsOuter ? chosen.outer : undefined,
    note: noteFor(mood, seed),
  };
}

const SEEN_KEY = "clem.morning.seen";
export function markMorningSeenToday() {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch { /* */ }
}
export function shouldAutoOpenMorning(): boolean {
  if (typeof window === "undefined") return false;
  if (!isMorningHour()) return false;
  try {
    const today = new Date().toISOString().slice(0, 10);
    return sessionStorage.getItem(SEEN_KEY) !== today;
  } catch {
    return true;
  }
}
