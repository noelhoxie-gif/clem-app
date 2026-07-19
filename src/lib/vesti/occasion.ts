import type { Category, Item, Season } from "./store";

export interface OccasionMatch {
  query: string;
  intent: string;
  season: Season | null;
  preferredCategories: Category[];
  preferredColors: string[];
  avoidColors: string[];
  results: Item[];
  answer: string;
}

interface Rule {
  keywords: string[];
  intent: string;
  season?: Season;
  prefer?: Category[];
  colors?: string[];
  avoid?: string[];
}

// Light-weight keyword rules — no LLM needed.
const RULES: Rule[] = [
  {
    keywords: ["beach", "pool", "swim", "seaside", "coast", "tropical", "vacation", "resort", "cabo", "tulum", "ibiza"],
    intent: "Beach / resort",
    season: "Warm",
    prefer: ["Tops", "Bottoms", "Accessories", "Shoes"],
    colors: ["cream", "ivory", "butter", "sage", "champagne", "tan", "camel", "white"],
  },
  {
    keywords: ["wedding", "bridal", "ceremony", "reception", "black tie", "gala", "formal"],
    intent: "Wedding / formal evening",
    prefer: ["Tops", "Bottoms", "Shoes", "Accessories"],
    colors: ["black", "champagne", "ivory", "gold", "espresso"],
    avoid: ["white"],
  },
  {
    keywords: ["work", "office", "meeting", "interview", "presentation", "boardroom"],
    intent: "Work / office",
    prefer: ["Outerwear", "Tops", "Bottoms", "Shoes"],
    colors: ["black", "charcoal", "camel", "ivory", "sage", "espresso", "chocolate"],
  },
  {
    keywords: ["date", "dinner", "drinks", "cocktail", "evening", "night out"],
    intent: "Date night",
    prefer: ["Tops", "Bottoms", "Shoes", "Accessories"],
    colors: ["black", "butter", "champagne", "espresso", "chocolate", "gold"],
  },
  {
    keywords: ["brunch", "lunch", "coffee", "weekend", "casual", "errand"],
    intent: "Easy weekend",
    prefer: ["Tops", "Bottoms", "Shoes"],
    colors: ["cream", "ivory", "sage", "camel", "indigo"],
  },
  {
    keywords: ["ski", "snow", "winter", "cold", "alps", "aspen"],
    intent: "Cold weather",
    season: "Cold",
    prefer: ["Outerwear", "Tops", "Bottoms", "Shoes"],
  },
  {
    keywords: ["bachelorette", "girls trip", "vegas", "miami", "party"],
    intent: "Bachelorette / party",
    season: "Warm",
    prefer: ["Tops", "Bottoms", "Shoes", "Accessories"],
    colors: ["butter", "champagne", "gold", "black", "ivory"],
  },
  {
    keywords: ["travel", "trip", "flight", "airport", "plane"],
    intent: "Travel day",
    prefer: ["Outerwear", "Tops", "Bottoms", "Shoes"],
    colors: ["cream", "camel", "black", "charcoal", "sage"],
  },
];

const SEASON_HINTS: Array<{ words: string[]; season: Season }> = [
  { words: ["warm", "hot", "summer", "spring", "tropical", "beach"], season: "Warm" },
  { words: ["cold", "winter", "snow", "chilly", "freezing"], season: "Cold" },
];

export function matchOccasion(query: string, items: Item[]): OccasionMatch {
  const q = query.toLowerCase();
  const matchedRules = RULES.filter((r) => r.keywords.some((k) => q.includes(k)));

  // Always reflect the user's exact words back as the intent label.
  const intent = query.trim() || "From your closet";
  let season: Season | null = matchedRules.find((r) => r.season)?.season ?? null;

  if (!season) {
    const hint = SEASON_HINTS.find((h) => h.words.some((w) => q.includes(w)));
    if (hint) season = hint.season;
  }

  const preferredCategories = Array.from(
    new Set(matchedRules.flatMap((r) => r.prefer ?? [])),
  ) as Category[];
  const preferredColors = Array.from(
    new Set(matchedRules.flatMap((r) => r.colors ?? []).map((c) => c.toLowerCase())),
  );
  const avoidColors = Array.from(
    new Set(matchedRules.flatMap((r) => r.avoid ?? []).map((c) => c.toLowerCase())),
  );

  const scored = items
    .map((item) => {
      let score = 0;
      const color = (item.color ?? "").toLowerCase();
      const name = item.name.toLowerCase();
      const brand = (item.brand ?? "").toLowerCase();

      // Direct keyword in name/brand
      if (q.split(/\s+/).some((w) => w.length > 2 && (name.includes(w) || brand.includes(w)))) {
        score += 4;
      }
      if (season && (item.season === season || item.season === "Year-round")) score += 2;
      if (season && item.season !== season && item.season !== "Year-round") score -= 3;
      if (preferredCategories.includes(item.category)) score += 2;
      if (color && preferredColors.includes(color)) score += 3;
      if (color && avoidColors.includes(color)) score -= 5;
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Take top results, diversified by category (max 2 per category, 8 total)
  const results: Item[] = [];
  const perCat = new Map<Category, number>();
  for (const { item } of scored) {
    if (results.length >= 8) break;
    const n = perCat.get(item.category) ?? 0;
    if (n >= 2) continue;
    results.push(item);
    perCat.set(item.category, n + 1);
  }

  const answer = buildAnswer(intent, season, results);

  return {
    query,
    intent,
    season,
    preferredCategories,
    preferredColors,
    avoidColors,
    results,
    answer,
  };
}

function buildAnswer(intent: string, season: Season | null, results: Item[]): string {
  if (results.length === 0) {
    return "Nothing in your closet feels quite right for this. A new piece might be worth considering.";
  }
  const cats = new Set(results.map((r) => r.category));
  const hasTop = cats.has("Tops");
  const hasBottom = cats.has("Bottoms");
  const hasShoes = cats.has("Shoes");
  const missing: string[] = [];
  if (!hasTop) missing.push("a top");
  if (!hasBottom) missing.push("a bottom");
  if (!hasShoes) missing.push("shoes");

  const seasonNote = season === "Warm" ? "warm-weather" : season === "Cold" ? "cool-weather" : "";
  const opener = `Yes — ${results.length} ${seasonNote ? seasonNote + " " : ""}piece${results.length === 1 ? "" : "s"} from your closet feel right for ${intent.toLowerCase()}.`;
  const gap = missing.length > 0 ? ` You're light on ${missing.join(" and ")}.` : "";
  return opener + gap;
}
