import type { Item } from "./store";

export interface Outfit {
  title: string;
  vibe: string;
  outer?: Item;
  top?: Item;
  bottom?: Item;
  shoes?: Item;
  accessory?: Item;
}

export const VIBES = [
  { title: "Morning Composition", vibe: "Polished, tailored, and ready for the day." },
  { title: "Evening in Paris", vibe: "Playful shine for dinner, dancing, or a gallery opening." },
  { title: "Sunday Bookshop", vibe: "Layered neutrals with a touch of warmth." },
  { title: "Coastal Lunch", vibe: "Breezy textures, sand-friendly footwear." },
  { title: "Studio Day", vibe: "Quiet polish, all-day comfortable." },
];

const STYLE_WORDS = {
  polished: /blazer|tailor|trouser|shirt|silk|satin|loafer|heel|pump|structured|leather|pearl/i,
  casual: /jean|denim|tee|t-shirt|sneaker|hoodie|sweat|cargo|canvas|baseball/i,
  sporty: /legging|running|trainer|athletic|sport|track|performance|gym/i,
  romantic: /lace|ruffle|floral|slip|satin|silk|sequin|sheer|chiffon|velvet/i,
  relaxed: /linen|crochet|flowy|relaxed|oversized|wide|slouch|sandal|espadrille|straw/i,
} as const;

type Style = keyof typeof STYLE_WORDS;

const VIBE_STYLES: Array<Partial<Record<Style, number>>> = [
  { polished: 3, casual: -1, sporty: -2 },
  { romantic: 3, polished: 1, sporty: -3 },
  { relaxed: 2, casual: 1, romantic: 1, sporty: -1 },
  { relaxed: 3, casual: 1, polished: -1, sporty: -1 },
  { polished: 2, relaxed: 1, casual: 1, sporty: -1 },
];

const COLOR_FAMILIES: Array<[string, RegExp]> = [
  ["white", /white|cream|ivory|ecru|bone|oat|vanilla/],
  ["black", /black|charcoal|graphite|onyx/],
  ["grey", /grey|gray|silver|pewter|slate/],
  ["brown", /brown|chocolate|espresso|cognac|camel|tan|beige|taupe|sand|nude/],
  ["blue", /blue|navy|cobalt|indigo|denim|azure|teal/],
  ["green", /green|sage|olive|khaki|emerald|mint/],
  ["red", /red|burgundy|wine|merlot|crimson|maroon/],
  ["pink", /pink|rose|blush|mauve|fuchsia/],
  ["purple", /purple|violet|lavender|lilac|plum/],
  ["yellow", /yellow|butter|mustard|gold|champagne/],
  ["orange", /orange|rust|terracotta|coral|peach/],
];

const NEUTRAL_FAMILIES = new Set(["white", "black", "grey", "brown"]);
const HARMONIOUS_ACCENTS = new Set([
  "blue:brown",
  "blue:orange",
  "blue:green",
  "brown:green",
  "brown:orange",
  "brown:red",
  "green:yellow",
  "pink:red",
  "pink:purple",
  "purple:yellow",
]);

function text(item: Item): string {
  return `${item.name} ${item.brand ?? ""} ${item.color ?? ""}`;
}

function styles(item: Item): Set<Style> {
  const value = text(item);
  return new Set(
    (Object.entries(STYLE_WORDS) as Array<[Style, RegExp]>)
      .filter(([, pattern]) => pattern.test(value))
      .map(([style]) => style),
  );
}

function colorFamily(color?: string): string | null {
  if (!color) return null;
  const normalized = color.toLowerCase();
  return COLOR_FAMILIES.find(([, pattern]) => pattern.test(normalized))?.[0] ?? normalized;
}

function pairCompatibility(a: Item, b: Item): number {
  let score = 0;

  // A wardrobe marked for opposite seasons can still layer, but is less likely
  // to form a coherent head-to-toe look.
  if (a.season === b.season) score += 2;
  else if (a.season === "Year-round" || b.season === "Year-round") score += 1;
  else score -= 2;

  const aColor = colorFamily(a.color);
  const bColor = colorFamily(b.color);
  if (aColor && bColor) {
    if (aColor === bColor) score += 4;
    else if (NEUTRAL_FAMILIES.has(aColor) || NEUTRAL_FAMILIES.has(bColor)) score += 2;
    else {
      const key = [aColor, bColor].sort().join(":");
      score += HARMONIOUS_ACCENTS.has(key) ? 2 : -3;
    }
  }

  const aStyles = styles(a);
  const bStyles = styles(b);
  if ([...aStyles].some((style) => bStyles.has(style))) score += 2;
  if (
    (aStyles.has("sporty") && (bStyles.has("polished") || bStyles.has("romantic"))) ||
    (bStyles.has("sporty") && (aStyles.has("polished") || aStyles.has("romantic")))
  ) {
    score -= 4;
  }

  return score;
}

function silhouetteCompatibility(a: Item, b: Item): number {
  const combined = `${a.name} ${b.name}`.toLowerCase();
  const looseCount = [a, b].filter((item) =>
    /oversized|wide|relaxed|slouch|boxy|maxi/.test(item.name.toLowerCase()),
  ).length;
  const fittedCount = [a, b].filter((item) =>
    /slim|fitted|skinny|mini|tailored|straight|crop/.test(item.name.toLowerCase()),
  ).length;
  if (looseCount === 1 && fittedCount === 1) return 3;
  if (looseCount === 2 && !/belt|waist/.test(combined)) return -2;
  return 0;
}

function layeringCompatibility(outer: Item, top: Item): number {
  const outerText = outer.name.toLowerCase();
  const topText = top.name.toLowerCase();
  const bulkyOuter = /puffer|shearling|oversized|faux fur|teddy/.test(outerText);
  const bulkyTop = /chunky|cable|oversized|hoodie|heavy/.test(topText);
  if (bulkyOuter && bulkyTop) return -3;
  if (/blazer|trench|coat|jacket/.test(outerText) && /shirt|blouse|tee|turtleneck|tank|camisole/.test(topText)) {
    return 3;
  }
  return 0;
}

function vibeScore(item: Item, vibeIndex: number): number {
  const weights = VIBE_STYLES[vibeIndex] ?? {};
  return [...styles(item)].reduce((sum, style) => sum + (weights[style] ?? 0), 0);
}

export function outfitCompatibilityScore(outfit: Outfit, vibeIndex = 0): number {
  const pieces = [outfit.outer, outfit.top, outfit.bottom, outfit.shoes, outfit.accessory].filter(Boolean) as Item[];
  let score = pieces.reduce(
    (sum, item) => sum + vibeScore(item, vibeIndex) + (item.favorite ? 1.5 : 0),
    0,
  );

  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      score += pairCompatibility(pieces[i], pieces[j]);
    }
  }

  if (outfit.top && outfit.bottom) {
    score += silhouetteCompatibility(outfit.top, outfit.bottom);
  }
  if (outfit.outer && outfit.top) {
    score += layeringCompatibility(outfit.outer, outfit.top);
  }

  const accentFamilies = new Set(
    pieces
      .map((item) => colorFamily(item.color))
      .filter((family): family is string => Boolean(family) && !NEUTRAL_FAMILIES.has(family!)),
  );
  if (accentFamilies.size > 2) score -= (accentFamilies.size - 2) * 5;

  return score;
}

function chooseCompatible(
  candidates: Item[],
  partial: Outfit,
  slot: keyof Pick<Outfit, "outer" | "top" | "bottom" | "shoes" | "accessory">,
  vibeIndex: number,
  seed: number,
  offset: number,
): Item | undefined {
  if (candidates.length === 0) return undefined;
  const ranked = candidates
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      score: outfitCompatibilityScore({ ...partial, [slot]: item }, vibeIndex),
    }))
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);

  // Reshuffle rotates through the best compatible options instead of blindly
  // advancing through the category list.
  const qualityWindow = Math.min(4, ranked.length);
  return ranked[(seed + offset) % qualityWindow].item;
}

export function buildOutfits(items: Item[], seedNum = 0): Outfit[] {
  if (items.length === 0) return [];
  const by = (...categories: Item["category"][]) =>
    items.filter((item) => categories.includes(item.category));
  const tops = by("Tops", "Sweaters");
  const bottoms = by("Bottoms");
  const shoes = by("Shoes");
  const outers = by("Outerwear");
  const accessories = by("Accessories");

  return VIBES.map((vibe, vibeIndex) => {
    let outfit: Outfit = { ...vibe };
    outfit.top = chooseCompatible(tops, outfit, "top", vibeIndex, seedNum, vibeIndex);
    outfit.bottom = chooseCompatible(bottoms, outfit, "bottom", vibeIndex, seedNum, vibeIndex + 1);
    outfit.outer = chooseCompatible(outers, outfit, "outer", vibeIndex, seedNum, vibeIndex + 2);
    outfit.shoes = chooseCompatible(shoes, outfit, "shoes", vibeIndex, seedNum, vibeIndex + 3);
    outfit.accessory = chooseCompatible(accessories, outfit, "accessory", vibeIndex, seedNum, vibeIndex + 4);
    return outfit;
  }).filter((outfit) => Boolean(outfit.top || outfit.bottom));
}

const NEUTRALS = [
  "white", "cream", "ivory", "ecru", "off-white", "bone",
  "black", "charcoal", "grey", "gray", "graphite",
  "beige", "tan", "camel", "sand", "stone", "taupe", "nude", "butter",
  "brown", "chocolate", "cognac", "espresso", "mocha",
  "navy", "denim", "indigo",
  "sage", "olive", "khaki",
];

function isNeutral(color?: string): boolean {
  if (!color) return true;
  const c = color.toLowerCase();
  return NEUTRALS.some((n) => c.includes(n));
}

function dominantAccent(items: Item[]): { color: string; item: Item } | null {
  for (const it of items) {
    if (it.color && !isNeutral(it.color)) {
      return { color: it.color.toLowerCase(), item: it };
    }
  }
  return null;
}

function roleLabel(item: Item): string {
  switch (item.category) {
    case "Accessories": return item.name.toLowerCase().includes("bag") ? "bag"
      : item.name.toLowerCase().includes("hat") ? "hat"
      : "accessory";
    case "Shoes": return "shoe";
    case "Outerwear": return "layer";
    case "Tops": return "top";
    case "Sweaters": return "knit";
    case "Bottoms": return "bottom";
    case "Dresses": return "dress";
  }
}

export function stylingRationale(o: Outfit): string {
  const pieces = [o.outer, o.top, o.bottom, o.shoes, o.accessory].filter(Boolean) as Item[];
  if (pieces.length < 2) return "Add a piece or two — the look isn't complete yet.";

  const accents = pieces.filter((p) => p.color && !isNeutral(p.color));
  const uniqueAccentColors = new Set(
    accents.map((item) => colorFamily(item.color)).filter(Boolean),
  );

  // Conflict: too many competing colors
  if (uniqueAccentColors.size >= 3) {
    return "Three colors are pulling in different directions — try swapping one piece for a neutral to let the others breathe.";
  }

  // Conflict: two statement accents
  if (uniqueAccentColors.size === 2) {
    const [a, b] = accents.slice(0, 2);
    const harmonyKey = [colorFamily(a.color), colorFamily(b.color)]
      .filter(Boolean)
      .sort()
      .join(":");
    if (HARMONIOUS_ACCENTS.has(harmonyKey)) {
      return `The ${a.color?.toLowerCase()} ${roleLabel(a)} and ${b.color?.toLowerCase()} ${roleLabel(b)} give the look a deliberate color conversation, while the quieter pieces hold it together.`;
    }
    return `The ${a.color?.toLowerCase()} ${roleLabel(a)} and the ${b.color?.toLowerCase()} ${roleLabel(b)} are fighting for attention — consider swapping one for something quieter.`;
  }

  // One accent — the hero move
  if (uniqueAccentColors.size === 1) {
    const hero = dominantAccent(pieces)!;
    return `Neutrals doing the structural work, with the ${hero.color} ${roleLabel(hero.item)} as the single point of interest. That's why it reads intentional.`;
  }

  // All neutrals — proportion / texture story
  const names = pieces.map((p) => p.name.toLowerCase()).join(" ");
  const hasOversized = /oversized|wide|maxi|relaxed|slouch/.test(names);
  const hasSlim = /slim|fitted|skinny|mini|tailored|straight/.test(names);
  if (hasOversized && hasSlim) {
    return "The oversized silhouette earns the slimmer counterpoint. Proportion is doing all the work here.";
  }
  return `${pieces.length} pieces, one quiet color story — texture and proportion carry the look.`;
}

