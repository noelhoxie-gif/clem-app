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
  { title: "Morning Composition", vibe: "Soft, easy, beautifully understated." },
  { title: "Evening in Paris", vibe: "A cohesive look for a gallery opening." },
  { title: "Sunday Bookshop", vibe: "Layered neutrals with a touch of warmth." },
  { title: "Coastal Lunch", vibe: "Breezy textures, sand-friendly footwear." },
  { title: "Studio Day", vibe: "Quiet luxury, all-day comfortable." },
];

export function buildOutfits(items: Item[], seedNum = 0): Outfit[] {
  if (items.length === 0) return [];
  // Favorites appear 3x in the pool — increases their probability of selection
  const by = (cat: Item["category"]) => {
    const base = items.filter((i) => i.category === cat);
    return base.flatMap((i) => i.favorite ? [i, i, i] : [i]);
  };
  const tops = by("Tops");
  const bottoms = by("Bottoms");
  const shoes = by("Shoes");
  const outer = by("Outerwear");
  const accs = by("Accessories");
  const pick = (arr: Item[], off: number) =>
    arr.length ? arr[(off + seedNum) % arr.length] : undefined;

  return VIBES.map((v, i) => ({
    ...v,
    top: pick(tops, i),
    bottom: pick(bottoms, i + 1),
    outer: pick(outer, i),
    shoes: pick(shoes, i + 2),
    accessory: pick(accs, i + 1),
  })).filter((o) => Boolean(o.top || o.bottom));
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
    case "Bottoms": return "bottom";
  }
}

export function stylingRationale(o: Outfit): string {
  const pieces = [o.outer, o.top, o.bottom, o.shoes, o.accessory].filter(Boolean) as Item[];
  if (pieces.length < 2) return "Add a piece or two — the look isn't complete yet.";

  const accents = pieces.filter((p) => p.color && !isNeutral(p.color));
  const uniqueAccentColors = new Set(accents.map((a) => a.color!.toLowerCase()));

  // Conflict: too many competing colors
  if (uniqueAccentColors.size >= 3) {
    return "Three colors are pulling in different directions — try swapping one piece for a neutral to let the others breathe.";
  }

  // Conflict: two statement accents
  if (uniqueAccentColors.size === 2) {
    const [a, b] = accents.slice(0, 2);
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

