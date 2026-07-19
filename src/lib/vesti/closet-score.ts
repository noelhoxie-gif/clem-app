/**
 * Closet Completeness Score
 *
 * Produces a 0-100 score across six weighted dimensions by cross-referencing
 * the user's active items against their full style profile. Each dimension
 * returns specific, actionable gaps so the UI can surface concrete next steps.
 *
 * Dimensions (100 pts total):
 *  1. Category Coverage      20 pts — right item types for your life
 *  2. Occasions Alignment    20 pts — closet matches your calendar
 *  3. Colour Palette Health  15 pts — colours are intentional and cohesive
 *  4. Style Identity         20 pts — pieces reflect who you say you are
 *  5. Outfit Buildability    15 pts — complete looks can actually be assembled
 *  6. Versatility            10 pts — items work across seasons & boldness level
 */

import type { Item, Category } from "./store";
import { itemStatus } from "./store";
import type { UserProfile, SkinTone } from "./profile";

// ─── Public Types ─────────────────────────────────────────────────────────────

export type GapSeverity = "critical" | "moderate" | "minor";

export interface ClosetGap {
  id: string;
  severity: GapSeverity;
  label: string;
  description: string;
  category?: Category;
  action: string;
}

export type DimensionStatus = "strong" | "good" | "fair" | "weak";

export interface ScoreDimension {
  id: string;
  label: string;
  score: number;     // raw earned points, 0..maxScore
  maxScore: number;
  pct: number;       // 0–100, integer
  status: DimensionStatus;
  insight: string;   // single-line human summary
  gaps: ClosetGap[];
}

export interface CompletenessReport {
  overall: number;          // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  headline: string;         // short bold label
  subline: string;          // one sentence of context
  dimensions: ScoreDimension[];
  topGaps: ClosetGap[];     // top 3 severity-ordered gaps
  strengths: string[];      // insights from strong dimensions
  activeItemCount: number;
  profileComplete: boolean;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

const NEUTRAL_WORDS = [
  "white", "cream", "ivory", "ecru", "off-white", "bone", "oatmeal", "chalk",
  "black", "charcoal", "grey", "gray", "graphite", "onyx", "slate",
  "beige", "tan", "camel", "sand", "stone", "taupe", "nude", "butter", "natural", "linen",
  "brown", "chocolate", "cognac", "espresso", "mocha", "toffee",
  "navy", "denim", "indigo",
  "sage", "olive", "khaki", "army", "forest", "moss",
];

function isNeutral(color?: string): boolean {
  if (!color) return true;
  const c = color.toLowerCase();
  return NEUTRAL_WORDS.some((n) => c.includes(n));
}

function txt(i: Item): string {
  return `${i.name} ${i.brand ?? ""} ${i.color ?? ""} ${i.category}`.toLowerCase();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function statusFrom(pct: number): DimensionStatus {
  if (pct >= 80) return "strong";
  if (pct >= 60) return "good";
  if (pct >= 35) return "fair";
  return "weak";
}

function makeDim(
  id: string,
  label: string,
  raw: number,
  max: number,
  insight: string,
  gaps: ClosetGap[],
): ScoreDimension {
  const score = clamp(raw, 0, max);
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return { id, label, score, maxScore: max, pct, status: statusFrom(pct), insight, gaps };
}

function warmCoverage(items: Item[]): boolean {
  return items.some((i) => i.season === "Warm" || i.season === "Year-round");
}
function coldCoverage(items: Item[]): boolean {
  return items.some((i) => i.season === "Cold" || i.season === "Year-round");
}

// Preferred colour group → item colour keywords
const COLOR_PREF_MAP: Record<string, string[]> = {
  "Neutrals":          ["white", "cream", "ivory", "black", "grey", "gray", "beige", "tan", "camel", "sand", "nude", "butter"],
  "Earth tones":       ["brown", "rust", "terracotta", "olive", "moss", "khaki", "camel", "cognac", "toffee", "clay", "sienna"],
  "Black & white":     ["black", "white", "cream", "ivory", "off-white", "charcoal"],
  "Blush & rose":      ["blush", "rose", "pink", "dusty pink", "mauve", "petal", "powder"],
  "Deep jewel tones":  ["burgundy", "wine", "merlot", "plum", "emerald", "sapphire", "royal", "cobalt", "amethyst", "forest"],
  "Navy & cobalt":     ["navy", "cobalt", "royal blue", "indigo", "midnight", "steel blue"],
  "Warm reds":         ["red", "rust", "coral", "tomato", "crimson", "scarlet", "cherry", "poppy"],
  "Olive & sage":      ["olive", "sage", "moss", "forest", "hunter", "khaki", "army"],
  "I avoid colour":    ["white", "cream", "black", "grey", "beige", "tan"],
};

// Skin-tone → flattering colour families
const SKIN_TONE_FLATTERING: Partial<Record<SkinTone, string[]>> = {
  porcelain: ["navy", "burgundy", "emerald", "cobalt", "ruby", "charcoal", "royal"],
  fair:      ["camel", "lavender", "rose", "mauve", "dusty pink", "warm beige", "soft green"],
  light:     ["coral", "peach", "tan", "gold", "terracotta", "sage", "warm brown"],
  medium:    ["olive", "terracotta", "rust", "emerald", "gold", "camel", "warm brown"],
  tan:       ["rust", "gold", "turquoise", "cobalt", "warm brown", "orange", "teal"],
  deep:      ["cobalt", "fuchsia", "emerald", "gold", "red", "ivory", "white", "bright"],
  rich:      ["royal purple", "cobalt", "fuchsia", "emerald", "gold", "orange", "white"],
};


// ─── Dimension 1: Category Coverage (20 pts) ─────────────────────────────────

function scoreCategoryBalance(active: Item[], profile: UserProfile): ScoreDimension {
  const MAX = 20;
  const gaps: ClosetGap[] = [];
  let pts = 0;

  const by = (cat: Category) => active.filter((i) => i.category === cat);
  const occ = profile.occasions ?? [];
  const hasWork   = occ.some((o) => /work/i.test(o));
  const hasEvent  = occ.some((o) => /event|going out/i.test(o));
  const hasTravel = occ.some((o) => /travel/i.test(o));

  // ── Core trifecta (9 pts max) ──
  // Tops group: Tops + Dresses
  // Bottoms group: Bottoms + Dresses
  // Shoes group: Shoes
  // Each worth 3 pts: 1 for any, 1 for warm coverage, 1 for cold coverage
  type CoreGroup = { label: string; cats: Category[]; id: string };
  const coreGroups: CoreGroup[] = [
    { label: "tops",    cats: ["Tops", "Dresses"],             id: "tops"    },
    { label: "bottoms", cats: ["Bottoms", "Dresses"],          id: "bottoms" },
    { label: "shoes",   cats: ["Shoes"],                       id: "shoes"   },
  ];

  for (const grp of coreGroups) {
    const pool = grp.cats.flatMap((c) => by(c));
    if (pool.length === 0) {
      gaps.push({
        id: `core-missing-${grp.id}`,
        severity: "critical",
        label: `No ${grp.label} in your closet`,
        description: `You have no ${grp.label} yet — this blocks building any complete outfit.`,
        category: grp.cats[0],
        action: `Add 2–3 ${grp.label} to unlock complete looks.`,
      });
    } else {
      pts += 1;
      if (!warmCoverage(pool)) {
        gaps.push({ id: `warm-${grp.id}`, severity: "moderate", label: `No warm-weather ${grp.label}`, description: `All your ${grp.label} are cold-season pieces.`, category: grp.cats[0], action: `Add at least one warm-season ${grp.label} for summer.` });
      } else { pts += 1; }
      if (!coldCoverage(pool)) {
        gaps.push({ id: `cold-${grp.id}`, severity: "moderate", label: `No cold-weather ${grp.label}`, description: `All your ${grp.label} are warm-season pieces.`, category: grp.cats[0], action: `Add at least one cold-weather ${grp.label} for winter.` });
      } else { pts += 1; }
    }
  }

  // ── Outerwear (3 pts max) ──
  const outer = by("Outerwear");
  const hasHeavyOuter = outer.some((i) => /(coat|parka|puffer|down|wool|overcoat|topcoat|mac)/.test(txt(i)));
  const hasLightLayer  = outer.some((i) => /(blazer|trench|denim|jacket|cardigan|cape|vest)/.test(txt(i)));

  if (!hasHeavyOuter) {
    gaps.push({ id: "outerwear-heavy", severity: "moderate", label: "No heavy coat for cold months", description: "No coat or parka for winter — a key coverage gap.", category: "Outerwear", action: "Add a wool coat or puffer for cold-weather dressing." });
  } else { pts += 1.5; }
  if (!hasLightLayer) {
    gaps.push({ id: "outerwear-light", severity: "minor", label: "No light layer for transitional weather", description: "No blazer, trench, or denim jacket to bridge seasons.", category: "Outerwear", action: "Add a blazer or trench coat for layering in-between seasons." });
  } else { pts += 1.5; }

  // ── Accessories (3 pts max) ──
  const accs = by("Accessories");
  const hasBag      = accs.some((i) => /bag|purse|tote|clutch|satchel|pouch/.test(txt(i)));
  const hasJewelry  = accs.some((i) => /earring|necklace|ring|bracelet|pendant|chain|stud/.test(txt(i)));
  const hasFinisher = accs.some((i) => /scarf|hat|belt|sunglass|glasses|watch|headband/.test(txt(i)));

  if (!hasBag)      { gaps.push({ id: "acc-bag",      severity: "moderate", label: "No bag in closet",                     description: "A bag completes nearly every outfit.",                           category: "Accessories", action: "Add at least one everyday bag." }); }
  else              { pts += 1; }
  if (!hasJewelry)  { gaps.push({ id: "acc-jewelry",  severity: "minor",    label: "No jewellery",                         description: "Even a single necklace or earring elevates looks instantly.",   category: "Accessories", action: "Add a simple pair of earrings or a delicate necklace." }); }
  else              { pts += 1; }
  if (!hasFinisher) { gaps.push({ id: "acc-finisher", severity: "minor",    label: "No scarves, belts, or hats",           description: "Finishing accessories multiply what you can do with your pieces.", category: "Accessories", action: "A scarf or belt can create entirely new looks from the same wardrobe." }); }
  else              { pts += 0.5; }

  // ── Occasion-driven category bonus (3 pts max) ──
  if (hasWork) {
    const hasWorkPiece = active.some((i) => /(blazer|button|poplin|trouser|tailored|loafer|oxford|blouse|pencil|structured)/.test(txt(i)));
    if (!hasWorkPiece) { gaps.push({ id: "occ-work-cat", severity: "moderate", label: "Work listed but no workwear", description: "Your profile says Work but your closet has no work-appropriate pieces.", action: "Add a blazer, tailored trouser, or clean button-down." }); }
    else { pts += 1; }
  } else { pts += 0.5; }

  if (hasEvent) {
    const hasEventPiece = active.some((i) => /(sequin|silk|slip|heel|stiletto|gown|cocktail|satin|velvet|lace|evening|dressy)/.test(txt(i)));
    if (!hasEventPiece) { gaps.push({ id: "occ-event-cat", severity: "moderate", label: "Events listed but no occasion wear", description: "No evening or dressy pieces for the events on your calendar.", action: "Add a silk top, heels, or an evening dress." }); }
    else { pts += 1; }
  } else { pts += 0.5; }

  if (hasTravel) {
    const neutralCount = active.filter((i) => isNeutral(i.color)).length;
    if (neutralCount < 4) { gaps.push({ id: "occ-travel-cat", severity: "minor", label: "Travel listed but few mix-and-match pieces", description: "Travel capsules rely on neutrals that pair with everything.", action: "Add neutral-coloured versatile pieces for easy packing." }); }
    else { pts += 1; }
  } else { pts += 0.5; }

  // ── Balance bonus (2 pts max) ──
  const allCats = (["Tops", "Bottoms", "Shoes", "Accessories", "Outerwear", "Dresses", "Sweaters"] as Category[]);
  const catCounts = allCats.map((c) => by(c).length);
  const maxCatCount = Math.max(...catCounts);
  if (active.length > 5 && maxCatCount / active.length < 0.45) pts += 1;
  const topCount    = by("Tops").length + by("Dresses").length;
  const bottomCount = by("Bottoms").length + by("Dresses").length;
  if (topCount > 0 && bottomCount > 0) {
    const ratio = topCount / bottomCount;
    if (ratio >= 0.75 && ratio <= 3.0) pts += 1;
    else gaps.push({ id: "cat-ratio", severity: "minor", label: `Tops and bottoms out of balance (${topCount}:${bottomCount})`, description: `A large top-to-bottom gap limits your outfit combinations.`, action: "Add more bottoms to match the variety in your tops." });
  }

  const p = pts / MAX;
  const insight = p >= 0.8 ? "Excellent range across categories and seasons."
    : p >= 0.6 ? "Good base with a few seasonal or category gaps."
    : p >= 0.35 ? "Key categories present but significant gaps remain."
    : "Several essential categories are missing.";

  return makeDim("category", "Category Coverage", pts, MAX, insight, gaps);
}


// ─── Dimension 2: Occasions Alignment (20 pts) ───────────────────────────────

function scoreOccasions(active: Item[], profile: UserProfile): ScoreDimension {
  const MAX = 20;
  const gaps: ClosetGap[] = [];
  let pts = 0;

  const occ = profile.occasions ?? [];
  if (occ.length === 0) {
    return makeDim("occasions", "Occasions Alignment", 10, MAX,
      "Complete your style profile for occasion-specific scoring.", gaps);
  }

  const ptsPerOcc = MAX / occ.length; // proportional to how many occasions listed

  for (const o of occ) {
    let occPts = 0;
    const occMax = 5;

    // ── Work ──
    if (/work/i.test(o)) {
      const formalTop    = active.some((i) => i.category === "Tops"     && /(button|poplin|blouse|structured|oxford|silk|tailored|knit)/.test(txt(i)));
      const formalBottom = active.some((i) => i.category === "Bottoms"  && /(trouser|tailored|pencil|chino|slack|midi|straight)/.test(txt(i)));
      const workShoes    = active.some((i) => i.category === "Shoes"    && /(loafer|flat|block|pump|kitten|heel|oxford|mule|ballet|ankle)/.test(txt(i)));
      const workOuter    = active.some((i) => i.category === "Outerwear"&& /(blazer|jacket|coat|structured|tailored)/.test(txt(i)));

      if (formalTop)    { occPts += 1.3; } else gaps.push({ id: "work-top",    severity: "moderate", label: "No formal top for Work",    description: "No button-down, blouse, or structured top for work.",    action: "Add a clean button-down, silk blouse, or quality knit." });
      if (formalBottom) { occPts += 1.3; } else gaps.push({ id: "work-bottom", severity: "moderate", label: "No tailored bottom for Work", description: "No tailored trouser, pencil skirt, or formal bottom.",     action: "Add a tailored trouser or midi skirt." });
      if (workShoes)    { occPts += 1.3; } else gaps.push({ id: "work-shoes",  severity: "moderate", label: "No professional shoes",       description: "No loafers, block heels, or clean flats for work.",      action: "Add a clean pump, loafer, or block-heel shoe." });
      if (workOuter)    { occPts += 0.5; }
      if (formalTop && formalBottom && workShoes) occPts += 0.6; // complete-look bonus
    }

    // ── Weekends ──
    else if (/weekend/i.test(o)) {
      const casualTop    = active.some((i) => i.category === "Tops"     && /(knit|sweater|tee|casual|relaxed|crochet|ribbed|jersey|linen|cotton)/.test(txt(i)));
      const casualBottom = active.some((i) => i.category === "Bottoms"  && /(denim|jean|casual|relaxed|wide|drawstring|linen|chino)/.test(txt(i)));
      const casualShoes  = active.some((i) => i.category === "Shoes"    && /(sneaker|sandal|flat|mule|loafer|espadrille|boot|clog)/.test(txt(i)));
      const casualLayer  = active.some((i) => i.category === "Outerwear"&& /(denim|blazer|trench|cardigan|jacket|vest|overshirt)/.test(txt(i)));
      const casualVariety = active.filter((i) => ["Tops","Bottoms"].includes(i.category)).length;

      if (casualTop)    { occPts += 1; } else gaps.push({ id: "weekend-top",    severity: "minor",    label: "No relaxed tops for Weekends",    description: "No knits or casual shirts for laid-back days.",    action: "Add a relaxed knit or linen shirt." });
      if (casualBottom) { occPts += 1; } else gaps.push({ id: "weekend-bottom", severity: "minor",    label: "No casual bottoms for Weekends",  description: "No denim or relaxed trousers for everyday wear.", action: "Add a good pair of jeans or wide-leg trousers." });
      if (casualShoes)  { occPts += 1; } else gaps.push({ id: "weekend-shoes",  severity: "moderate", label: "No casual shoes",                 description: "No sneakers or flats for everyday wear.",         action: "Add a versatile sneaker or simple flat." });
      if (casualLayer)  occPts += 0.5;
      occPts += casualVariety >= 6 ? 1.5 : casualVariety >= 3 ? 0.75 : 0;
    }

    // ── Events & going out ──
    else if (/event|going out/i.test(o)) {
      const eventClothing = active.some((i) => ["Dresses","Tops"].includes(i.category) && /(sequin|silk|satin|velvet|slip|evening|cocktail|gown|lace|metallic|sheer)/.test(txt(i)));
      const eventShoes    = active.some((i) => i.category === "Shoes"    && /(heel|stiletto|pump|strappy|mule|sandal|evening|platform)/.test(txt(i)));
      const eveningBag    = active.some((i) => i.category === "Accessories" && /(clutch|evening|mini bag|crossbody|chain)/.test(txt(i)));
      const jewelry       = active.some((i) => i.category === "Accessories" && /(earring|necklace|ring|bracelet|pendant|pearl|gold|silver)/.test(txt(i)));
      const hasDress      = active.some((i) => i.category === "Dresses");

      if (eventClothing || hasDress) { occPts += 1.5; } else gaps.push({ id: "event-clothing", severity: "moderate", label: "No event-ready clothing",  description: "No silk, sequin, satin, or dressy pieces for evenings out.", action: "Add a silk slip dress, sequin piece, or elegant evening top." });
      if (eventShoes)                { occPts += 1.5; } else gaps.push({ id: "event-shoes",    severity: "moderate", label: "No dressy shoes for Events", description: "No heels or strappy sandals for going out.",                 action: "Add a pair of heels or strappy evening sandals." });
      if (eveningBag)   occPts += 0.5;
      if (jewelry)      occPts += 0.5;
      if ((eventClothing || hasDress) && eventShoes) occPts += 1;
    }

    // ── Travel ──
    else if (/travel/i.test(o)) {
      const neutralCount    = active.filter((i) => isNeutral(i.color)).length;
      const yearRoundCount  = active.filter((i) => i.season === "Year-round").length;
      const hasWalkShoes    = active.some((i) => i.category === "Shoes" && /(sneaker|flat|loafer|espadrille|ankle|boot|walking)/.test(txt(i)));
      const hasLayer        = active.some((i) => i.category === "Outerwear");
      const hasVersatilePiece = active.some((i) => i.category === "Dresses" && i.season === "Year-round");

      occPts += neutralCount >= 6 ? 1.5 : neutralCount >= 3 ? 0.75 : 0;
      if (neutralCount < 3) gaps.push({ id: "travel-neutrals", severity: "moderate", label: "Too few mix-and-match neutrals for Travel", description: `Only ${neutralCount} neutrals — travel capsules depend on cross-dressing pieces.`, action: "Build a 5-piece neutral core that all pair together." });
      occPts += yearRoundCount >= 4 ? 1 : yearRoundCount >= 2 ? 0.5 : 0;
      if (hasWalkShoes)      { occPts += 1; } else gaps.push({ id: "travel-shoes", severity: "moderate", label: "No comfortable walking shoes for Travel", description: "No sneakers or loafers for active travel days.", action: "Add a versatile sneaker or loafer for travel." });
      if (hasLayer)          occPts += 0.75;
      if (hasVersatilePiece) occPts += 0.75;
    }

    pts += (clamp(occPts, 0, occMax) / occMax) * ptsPerOcc;
  }

  const p = pts / MAX;
  const insight = p >= 0.8 ? "Your closet is well-equipped for everything on your calendar."
    : p >= 0.6 ? "Good occasion coverage with a few targeted gaps."
    : p >= 0.35 ? "Some occasions well-covered; others are missing key pieces."
    : "Your closet doesn't yet match your stated lifestyle.";

  return makeDim("occasions", "Occasions Alignment", pts, MAX, insight, gaps);
}


// ─── Dimension 3: Colour Palette Health (15 pts) ─────────────────────────────

function scoreColourPalette(active: Item[], profile: UserProfile): ScoreDimension {
  const MAX = 15;
  const gaps: ClosetGap[] = [];
  let pts = 0;

  // ── Preferred colour representation (5 pts) ──
  const prefGroups = profile.colors ?? [];
  if (prefGroups.length === 0) {
    pts += 2.5; // neutral when no preference set
  } else if (prefGroups.includes("All of the above")) {
    pts += Math.min(5, (active.length / 8) * 5); // score by sheer variety
  } else {
    const prefKeywords = prefGroups.flatMap((p) => COLOR_PREF_MAP[p] ?? []);
    const matches = active.filter((i) => {
      const c = (i.color ?? "").toLowerCase();
      return prefKeywords.some((kw) => c.includes(kw));
    });
    const ratio = active.length > 0 ? matches.length / active.length : 0;
    pts += ratio >= 0.5 ? 5 : ratio >= 0.3 ? 3.5 : ratio >= 0.15 ? 2 : 0.5;
    if (ratio < 0.15 && prefGroups.length > 0) {
      const missing = prefGroups.filter((p) => {
        const kws = COLOR_PREF_MAP[p] ?? [];
        return !active.some((i) => kws.some((kw) => (i.color ?? "").toLowerCase().includes(kw)));
      });
      if (missing.length > 0) {
        gaps.push({
          id: "color-prefs-missing",
          severity: "moderate",
          label: "Closet doesn't reflect your colour preferences",
          description: `You love ${missing.slice(0, 2).join(" and ")} but your closet barely shows it.`,
          action: `Add pieces in ${missing.slice(0, 2).join(" or ")} to match your stated palette.`,
        });
      }
    }
  }

  // ── Neutral foundation (3 pts) ──
  // Neutrals are the glue — they make everything else wearable
  const neutralItems = active.filter((i) => isNeutral(i.color));
  pts += neutralItems.length >= 6 ? 3 : neutralItems.length >= 4 ? 2.5 : neutralItems.length >= 2 ? 1.5 : neutralItems.length >= 1 ? 0.75 : 0;
  if (neutralItems.length < 2) {
    gaps.push({
      id: "color-neutrals",
      severity: "moderate",
      label: "Too few neutral anchor pieces",
      description: "Neutrals act as the glue of a wardrobe — they make accent pieces easy to wear.",
      action: "Add 3–4 neutral pieces (cream, black, camel, navy) as your anchoring basics.",
    });
  }

  // ── Avoided colour penalty (3 pts base) ──
  const avoidRaw = (profile.avoidColors ?? "").toLowerCase().trim();
  if (!avoidRaw) {
    pts += 3;
  } else {
    const avoidWords = avoidRaw.split(/[\s,;]+/).filter((w) => w.length > 2);
    const offenders = active.filter((i) => {
      const c = (i.color ?? "").toLowerCase();
      return avoidWords.some((w) => c.includes(w));
    });
    pts += Math.max(0, 3 - offenders.length * 0.6);
    if (offenders.length > 0) {
      gaps.push({
        id: "color-avoidance",
        severity: "minor",
        label: `${offenders.length} item${offenders.length > 1 ? "s" : ""} in colours you said to avoid`,
        description: `${offenders.map((i) => i.name).slice(0, 2).join(", ")} match${offenders.length === 1 ? "es" : ""} colours on your avoid list.`,
        action: "Consider moving those pieces to Departing if they don't feel like you.",
      });
    }
  }

  // ── Skin-tone harmony (2 pts) ──
  const flattering = profile.skinTone ? (SKIN_TONE_FLATTERING[profile.skinTone] ?? []) : [];
  if (flattering.length === 0) {
    pts += 1; // neutral if skin tone not set
  } else {
    const harmonious = active.filter((i) => {
      const c = (i.color ?? "").toLowerCase();
      return flattering.some((f) => c.includes(f));
    });
    pts += harmonious.length >= 4 ? 2 : harmonious.length >= 2 ? 1.5 : harmonious.length >= 1 ? 1 : 0;
    if (harmonious.length === 0) {
      gaps.push({
        id: "color-skintone",
        severity: "minor",
        label: "Few colours that flatter your skin tone",
        description: `For your skin tone, ${flattering.slice(0, 3).join(", ")} are especially flattering.`,
        action: `Add a piece in ${flattering[0]} or ${flattering[1]} — it will be an instant confidence piece.`,
      });
    }
  }

  // ── Colour cohesion (2 pts) ──
  // Best closets have both neutral anchors AND at least one accent colour group
  const hasAccents = active.some((i) => !isNeutral(i.color) && (i.color ?? "").trim() !== "");
  const hasNeutralBase = neutralItems.length >= 2;
  pts += hasNeutralBase && hasAccents ? 2 : hasNeutralBase || hasAccents ? 1 : 0;
  if (!hasNeutralBase && !hasAccents) {
    gaps.push({ id: "color-cohesion", severity: "minor", label: "Closet lacks colour balance", description: "Strong wardrobes combine neutral anchors with intentional accent colours.", action: "Add both neutral basics and one or two accent colour pieces." });
  }

  const p = pts / MAX;
  const insight = p >= 0.8 ? "Palette is well-balanced, intentional, and personally aligned."
    : p >= 0.6 ? "Good colour foundation — some refinement possible."
    : p >= 0.35 ? "Colour choices are present but not yet cohesive."
    : "Your colour palette needs significant attention.";

  return makeDim("color", "Colour Palette Health", pts, MAX, insight, gaps);
}


// ─── Dimension 4: Style Identity Alignment (20 pts) ──────────────────────────

function scoreStyleIdentity(active: Item[], profile: UserProfile): ScoreDimension {
  const MAX = 20;
  const gaps: ClosetGap[] = [];

  const identities = profile.styleIdentities ?? [];
  if (identities.length === 0) {
    return makeDim("style", "Style Identity", 10, MAX,
      "Complete your style profile for identity-specific scoring.", gaps);
  }

  // Each identity is scored 0–10; average of all identities then scaled to MAX
  const identityScores: number[] = [];

  for (const identity of identities) {
    let iPts = 0;

    // ── Classic & timeless ──
    if (/classic|timeless/i.test(identity)) {
      const hasBlazerOrTrench = active.some((i) => /(blazer|trench|topcoat|structured coat|overcoat)/.test(txt(i)));
      const hasButtonDown     = active.some((i) => i.category === "Tops" && /(button|poplin|oxford|classic shirt|crisp)/.test(txt(i)));
      const hasTailored       = active.some((i) => i.category === "Bottoms" && /(trouser|tailored|pleated|chino|slack)/.test(txt(i)));
      const neutralRatio      = active.length > 0 ? active.filter((i) => isNeutral(i.color)).length / active.length : 0;
      const hasCleanShoes     = active.some((i) => i.category === "Shoes" && /(loafer|flat|ballet|oxford|pump|kitten|mule)/.test(txt(i)));
      const extremeItemCount  = active.filter((i) => /(sequin|rhinestone|neon|extreme crop|mini skirt)/.test(txt(i))).length;

      if (hasBlazerOrTrench) iPts += 2.5; else gaps.push({ id: "classic-coat",   severity: "moderate", label: "No blazer or trench for Classic style",   description: "Classic dressing centres on great tailored outerwear.",        action: "Add a double-breasted blazer or structured trench coat." });
      if (hasButtonDown)     iPts += 2;   else gaps.push({ id: "classic-shirt",  severity: "moderate", label: "No button-down for Classic style",         description: "A crisp button-down is a classic wardrobe cornerstone.",       action: "Add a poplin or oxford button-down in white or light blue." });
      if (hasTailored)       iPts += 2;   else gaps.push({ id: "classic-bottom", severity: "minor",    label: "No tailored bottom for Classic style",     description: "Tailored trousers anchor the Classic aesthetic.",              action: "Add a well-cut trouser in camel, cream, or charcoal." });
      iPts += neutralRatio >= 0.6 ? 2 : neutralRatio >= 0.4 ? 1.5 : neutralRatio >= 0.2 ? 0.75 : 0;
      if (hasCleanShoes) iPts += 1.5;
      iPts -= Math.min(2, extremeItemCount * 0.6);
    }

    // ── Romantic & feminine ──
    else if (/romantic|feminine/i.test(identity)) {
      const hasSoftFabric   = active.some((i) => /(silk|satin|chiffon|lace|velvet|slip|delicate|sheer|organza)/.test(txt(i)));
      const hasFemSilhouette = active.some((i) => /(wrap|flowy|pleated|midi skirt|dress|tiered|ruffle)/.test(txt(i)));
      const hasSoftColor    = active.some((i) => /(blush|rose|pink|ivory|cream|dusty|lavender|mauve|peach|champagne)/.test((i.color ?? "").toLowerCase()));
      const hasDelicateAcc  = active.some((i) => i.category === "Accessories" && /(pearl|delicate|chain|dainty|pendant|earring|choker)/.test(txt(i)));
      const hasHeels        = active.some((i) => i.category === "Shoes" && /(heel|kitten|mule|strappy|ballet|slingback|platform)/.test(txt(i)));

      if (hasSoftFabric)    iPts += 3;   else gaps.push({ id: "romantic-fabric",    severity: "moderate", label: "No soft fabrics for Romantic style",  description: "Romantic dressing relies on silk, lace, chiffon, or satin.", action: "Add a silk slip, lace blouse, or chiffon piece." });
      if (hasFemSilhouette) iPts += 2.5;
      if (hasSoftColor)     iPts += 2;   else gaps.push({ id: "romantic-color",     severity: "minor",    label: "No soft feminine colours",             description: "Blush, rose, ivory, and lavender define the Romantic palette.", action: "Add a piece in blush, dusty rose, or lavender." });
      if (hasDelicateAcc)   iPts += 1.5;
      if (hasHeels)         iPts += 1;
    }

    // ── Minimalist ──
    else if (/minimalist/i.test(identity)) {
      const neutralRatio    = active.length > 0 ? active.filter((i) => isNeutral(i.color)).length / active.length : 0;
      const cleanBasics     = active.filter((i) => isNeutral(i.color) && ["Tops","Bottoms"].includes(i.category)).length;
      const tooManyItems    = active.length > 55;
      const statementCount  = active.filter((i) => /(sequin|rhinestone|bold print|graphic|neon|embellished)/.test(txt(i))).length;
      const tooManyAccs     = active.filter((i) => i.category === "Accessories").length > 12;

      iPts += neutralRatio >= 0.65 ? 3 : neutralRatio >= 0.45 ? 2 : neutralRatio >= 0.25 ? 1 : 0;
      if (neutralRatio < 0.45) gaps.push({ id: "minimal-neutrals", severity: "moderate", label: "Too few neutrals for a Minimalist wardrobe", description: "Minimalism is built on a restrained, near-neutral palette.", action: "Shift toward cream, black, grey, and camel as your base." });
      iPts += cleanBasics >= 5 ? 2.5 : cleanBasics >= 3 ? 1.5 : cleanBasics >= 1 ? 0.75 : 0;
      if (!tooManyItems)  iPts += 1.5; else gaps.push({ id: "minimal-quantity", severity: "minor", label: "Closet size conflicts with Minimalist values", description: "A Minimalist wardrobe is intentionally small — quality over quantity.", action: "Move 10–15 items to Departing or the Vault to match your Minimalist ethos." });
      iPts -= Math.min(2, statementCount * 0.6);
      if (!tooManyAccs)   iPts += 1;
      if (statementCount === 0) iPts += 1;
    }

    // ── Bohemian ──
    else if (/bohemian/i.test(identity)) {
      const hasEarthTones = active.some((i) => /(rust|terracotta|olive|camel|cognac|tan|sand|clay|mustard|burnt orange|ochre)/.test((i.color ?? "").toLowerCase()));
      const hasTexture    = active.some((i) => /(crochet|linen|suede|woven|embroidered|fringe|knit|macramé|tapestry)/.test(txt(i)));
      const hasFlowy      = active.some((i) => /(maxi|flowy|wide.leg|wrap|tiered|prairie|peasant|relaxed|oversized)/.test(txt(i)));
      const layerCount    = active.filter((i) => ["Outerwear","Accessories"].includes(i.category)).length;
      const hasBohoAcc    = active.some((i) => i.category === "Accessories" && /(scarf|hat|sash|bandana|earring|stack|tassel|fringe|wrap)/.test(txt(i)));
      const tooFormal     = active.filter((i) => /(pencil skirt|structured blazer|formal trouser|suit)/.test(txt(i))).length;

      if (hasEarthTones) iPts += 2.5; else gaps.push({ id: "boho-earth",   severity: "moderate", label: "No earth tones for Bohemian style",  description: "Bohemian style lives in rust, terracotta, olive, and cognac.", action: "Add a piece in terracotta, rust, or warm brown." });
      if (hasTexture)    iPts += 2.5; else gaps.push({ id: "boho-texture", severity: "moderate", label: "Missing textures for Bohemian style", description: "Crochet, linen, woven fabrics, and embroidery define this aesthetic.", action: "Add a crochet top, linen blouse, or woven bag." });
      if (hasFlowy)      iPts += 2;
      iPts += layerCount >= 4 ? 1.5 : layerCount >= 2 ? 0.75 : 0;
      if (hasBohoAcc)    iPts += 1.5;
      iPts -= Math.min(1.5, tooFormal * 0.5);
    }

    // ── Editorial & bold ──
    else if (/editorial|bold/i.test(identity)) {
      const hasStatement    = active.some((i) => /(sequin|bold print|graphic|metallic|sculptural|oversized|statement|neon|unexpected)/.test(txt(i)));
      const accentCount     = active.filter((i) => !isNeutral(i.color) && (i.color ?? "").trim() !== "").length;
      const hasMixedTexture = active.some((i) => ["Tops","Bottoms","Dresses"].includes(i.category) && /(leather|silk|velvet|sequin|metallic|sheer|patent)/.test(txt(i)));
      const overlyNeutral   = active.length > 0 && active.filter((i) => isNeutral(i.color)).length / active.length > 0.82;
      const boldness        = profile.boldness ?? 3;

      if (hasStatement) iPts += 3; else gaps.push({ id: "editorial-statement", severity: "critical", label: "No statement pieces for Editorial style", description: "Editorial dressing requires at least one bold, memorable piece.", action: "Add a sequin piece, bold print, or unexpected silhouette." });
      iPts += accentCount >= 5 ? 2.5 : accentCount >= 3 ? 1.75 : accentCount >= 1 ? 0.75 : 0;
      if (accentCount < 2) gaps.push({ id: "editorial-color", severity: "moderate", label: "Too few accent colours for Editorial style", description: "Editorial wardrobes are built on confident colour choices.", action: "Add 3+ pieces in bold or unexpected colours." });
      if (hasMixedTexture) iPts += 2;
      iPts += boldness >= 4 ? 1.5 : boldness >= 3 ? 0.75 : 0;
      if (overlyNeutral) { iPts -= 1; gaps.push({ id: "editorial-boring", severity: "minor", label: "Closet skews too neutral for Editorial style", description: "80%+ neutral pieces conflicts with your Editorial identity.", action: "Introduce bold accent pieces to match your Editorial spirit." }); }
    }

    // ── Casual chic ──
    else if (/casual chic/i.test(identity)) {
      const hasQualityDenim = active.some((i) => i.category === "Bottoms" && /(denim|jean|straight|wide.leg|slim)/.test(txt(i)));
      const hasElevatedTop  = active.some((i) => i.category === "Tops"    && /(silk|satin|cashmere|fine.gauge|ribbed|merino|quality|luxe)/.test(txt(i)));
      const hasCleanSneaker = active.some((i) => i.category === "Shoes"   && /(sneaker|leather sneaker|white|minimal|clean|canvas)/.test(txt(i)));
      const hasVLayer       = active.some((i) => i.category === "Outerwear"&& /(blazer|trench|denim jacket|leather|moto|utility)/.test(txt(i)));
      const hasSimpleAcc    = active.some((i) => i.category === "Accessories" && /(minimal|simple|tote|crossbody|hoops|studs|everyday)/.test(txt(i)));

      if (hasQualityDenim) iPts += 2.5; else gaps.push({ id: "chic-denim",   severity: "moderate", label: "No quality denim for Casual Chic style", description: "Great-fitting denim is the backbone of Casual Chic.",           action: "Add a well-cut pair of straight-leg or wide-leg jeans." });
      if (hasElevatedTop)  iPts += 2.5; else gaps.push({ id: "chic-basics",  severity: "moderate", label: "No elevated basics for Casual Chic",     description: "Silks, cashmere, and fine-gauge knits elevate denim to Chic.", action: "Add a silk top or cashmere knit to pair with your denim." });
      if (hasCleanSneaker) iPts += 2;   else gaps.push({ id: "chic-sneaker", severity: "minor",    label: "No clean sneaker for Casual Chic",        description: "A minimal leather sneaker is essential for Casual Chic.",    action: "Add a simple white or leather sneaker." });
      if (hasVLayer)       iPts += 1.5;
      if (hasSimpleAcc)    iPts += 1.5;
    }

    identityScores.push(clamp(iPts, 0, 10));
  }

  // Average identity scores → scale to MAX
  const avgScore = identityScores.reduce((a, b) => a + b, 0) / identityScores.length;
  const scaledPts = (avgScore / 10) * MAX;

  // Boldness alignment modifier (±2 pts)
  const boldness = profile.boldness ?? 3;
  const statementCount = active.filter((i) => /(sequin|rhinestone|bold|neon|print|graphic|metallic|velvet|leather)/.test(txt(i))).length;
  const neutralPct = active.length > 0 ? active.filter((i) => isNeutral(i.color)).length / active.length : 0.5;
  // Estimate "actual boldness" from closet composition (1–5 scale)
  const actualBoldness = clamp(Math.round(1 + (statementCount / Math.max(active.length, 1)) * 4 * 2 + (1 - neutralPct) * 2), 1, 5);
  const boldDiff = Math.abs(boldness - actualBoldness);
  const boldMod = boldDiff === 0 ? 2 : boldDiff === 1 ? 1 : boldDiff === 2 ? 0 : -1;
  if (boldDiff >= 2 && boldness >= 4) {
    gaps.push({ id: "boldness-gap", severity: "minor", label: `Closet feels less bold than your style profile`, description: `You rated boldness ${boldness}/5 but your closet reads more conservatively.`, action: "Add 2–3 statement pieces that match your confidence level." });
  } else if (boldDiff >= 2 && boldness <= 2) {
    gaps.push({ id: "boldness-gap", severity: "minor", label: `Closet is bolder than your style preference`, description: `You prefer a classic style but your closet has several statement pieces.`, action: "Consider whether those bold pieces still feel like you." });
  }

  const finalPts = clamp(scaledPts + boldMod, 0, MAX);
  const p = finalPts / MAX;
  const insight = p >= 0.8 ? "Your closet strongly reflects your personal style identity."
    : p >= 0.6 ? "Your style is showing through — room to sharpen it further."
    : p >= 0.35 ? "Some alignment, but key signature pieces are missing."
    : "Your closet doesn't yet feel like your stated style identity.";

  return makeDim("style", "Style Identity", finalPts, MAX, insight, gaps);
}


// ─── Dimension 5: Outfit Buildability (15 pts) ───────────────────────────────

function scoreOutfitBuildability(active: Item[], profile: UserProfile): ScoreDimension {
  const MAX = 15;
  const gaps: ClosetGap[] = [];
  let pts = 0;

  const topOnly    = active.filter((i) => ["Tops","Sweaters"].includes(i.category));
  const bottomOnly = active.filter((i) => i.category === "Bottoms");
  const dresses    = active.filter((i) => i.category === "Dresses");
  const shoes      = active.filter((i) => i.category === "Shoes");
  const accs       = active.filter((i) => i.category === "Accessories");

  // ── Complete outfit count (7 pts) ──
  // (tops × bottoms + dresses) × shoes — simple O(1) proxy
  const combinationCount = ((topOnly.length * bottomOnly.length) + dresses.length) * shoes.length;

  if (combinationCount === 0) {
    gaps.push({ id: "build-zero", severity: "critical", label: "No complete outfits can be built", description: "You need tops (or dresses), bottoms, and shoes to build any look.", action: "Add the missing category to unlock complete outfits." });
  } else {
    pts += combinationCount >= 40 ? 7 : combinationCount >= 20 ? 5.5 : combinationCount >= 10 ? 4 : combinationCount >= 4 ? 2.5 : 1.5;
    if (combinationCount < 6) {
      gaps.push({ id: "build-low", severity: "moderate", label: "Very few complete outfit combinations", description: `Only ~${combinationCount} full looks possible right now.`, action: "Adding one more bottom or shoe pair multiplies your combinations immediately." });
    }
  }

  // ── Seasonal completeness (4 pts) ──
  const warmTops    = [...topOnly, ...dresses].filter((i) => i.season === "Warm" || i.season === "Year-round");
  const warmBottoms = [...bottomOnly, ...dresses].filter((i) => i.season === "Warm" || i.season === "Year-round");
  const warmShoes   = shoes.filter((i) => i.season === "Warm" || i.season === "Year-round");
  const coldTops    = [...topOnly, ...dresses].filter((i) => i.season === "Cold" || i.season === "Year-round");
  const coldBottoms = [...bottomOnly, ...dresses].filter((i) => i.season === "Cold" || i.season === "Year-round");
  const coldShoes   = shoes.filter((i) => i.season === "Cold" || i.season === "Year-round");

  const canBuildWarm = warmTops.length > 0 && warmBottoms.length > 0 && warmShoes.length > 0;
  const canBuildCold = coldTops.length > 0 && coldBottoms.length > 0 && coldShoes.length > 0;

  if (canBuildWarm) pts += 2; else gaps.push({ id: "build-warm", severity: "moderate", label: "Can't build a complete warm-weather outfit", description: "Missing tops, bottoms, or shoes for warm weather.", action: "Ensure you have tops, bottoms, and shoes that all work in summer." });
  if (canBuildCold) pts += 2; else gaps.push({ id: "build-cold", severity: "moderate", label: "Can't build a complete cold-weather outfit", description: "Missing tops, bottoms, or shoes for cold weather.", action: "Ensure you have tops, bottoms, and shoes that all work in winter." });

  // ── Accessory finish rate (2 pts) ──
  pts += accs.length >= 5 ? 2 : accs.length >= 3 ? 1.5 : accs.length >= 1 ? 1 : 0;
  if (accs.length === 0) {
    gaps.push({ id: "build-acc", severity: "moderate", label: "No accessories to finish any look", description: "Accessories turn a collection of clothes into an outfit.", action: "Add a bag, earrings, or a scarf to elevate every look instantly." });
  }

  // ── Occasion-specific look availability (2 pts) ──
  const occ = profile.occasions ?? [];
  let occBuildable = 0;
  if (occ.some((o) => /work/i.test(o))) {
    const workLook = active.filter((i) => /(blazer|button|poplin|trouser|tailored|loafer|pump|flat)/.test(txt(i)));
    if (workLook.length >= 2) occBuildable++;
  }
  if (occ.some((o) => /event|going out/i.test(o))) {
    const eventLook = active.filter((i) => /(sequin|silk|satin|heel|stiletto|slip|dress|velvet)/.test(txt(i)));
    if (eventLook.length >= 2) occBuildable++;
  }
  pts += occBuildable >= 2 ? 2 : occBuildable >= 1 ? 1 : 0;

  const p = pts / MAX;
  const lookLabel = combinationCount > 0 ? `~${Math.min(combinationCount, 99)}+ complete looks available.` : "";
  const insight = p >= 0.8 ? `${lookLabel} Excellent outfit range.`
    : p >= 0.6 ? `${lookLabel} Good variety of complete looks.`
    : p >= 0.35 ? "Limited combinations — add shoes or bottoms to multiply options."
    : "Very few complete outfits can be assembled right now.";

  return makeDim("buildability", "Outfit Buildability", pts, MAX, insight, gaps);
}


// ─── Dimension 6: Versatility (10 pts) ───────────────────────────────────────

function scoreVersatility(active: Item[], profile: UserProfile): ScoreDimension {
  const MAX = 10;
  const gaps: ClosetGap[] = [];
  let pts = 0;

  if (active.length === 0) {
    return makeDim("versatility", "Versatility", 0, MAX, "Add items to get a versatility score.", gaps);
  }

  // ── Year-round item ratio (3 pts) ──
  const yrPct = active.filter((i) => i.season === "Year-round").length / active.length;
  pts += yrPct >= 0.5 ? 3 : yrPct >= 0.35 ? 2 : yrPct >= 0.2 ? 1 : 0.5;
  if (yrPct < 0.2) {
    gaps.push({ id: "vers-yearround", severity: "minor", label: "Few year-round items", description: `Only ${Math.round(yrPct * 100)}% of your closet works across all seasons.`, action: "Invest in more year-round pieces — denim, cotton basics, neutral shoes." });
  }

  // ── Neutral anchor ratio vs expected ratio by boldness level (3 pts) ──
  // Ideal neutral % by boldness 1–5: conservative→bold
  const idealNeutralPct = [0.70, 0.60, 0.50, 0.40, 0.30][(profile.boldness ?? 3) - 1];
  const neutralPct = active.filter((i) => isNeutral(i.color)).length / active.length;
  const neutralDiff = Math.abs(neutralPct - idealNeutralPct);
  pts += neutralDiff <= 0.10 ? 3 : neutralDiff <= 0.20 ? 2 : neutralDiff <= 0.35 ? 1 : 0;
  if (neutralDiff > 0.35) {
    gaps.push({
      id: "vers-neutral-ratio",
      severity: "minor",
      label: neutralPct > idealNeutralPct ? "Closet may be too neutral for your boldness level" : "Closet may need more neutral anchors",
      description: `You have ${Math.round(neutralPct * 100)}% neutral items — ideal for your boldness preference is ~${Math.round(idealNeutralPct * 100)}%.`,
      action: neutralPct > idealNeutralPct ? "Introduce 2–3 accent colour pieces to match your personality." : "Add 2–3 neutral basics to ground your bolder pieces.",
    });
  }

  // ── Multi-use items (2 pts) ──
  // Year-round + neutral = maximum versatility; shoes/accessories always versatile
  const multiUse = active.filter((i) =>
    (i.season === "Year-round" && isNeutral(i.color)) ||
    ["Shoes", "Accessories"].includes(i.category)
  );
  const multiPct = multiUse.length / active.length;
  pts += multiPct >= 0.40 ? 2 : multiPct >= 0.25 ? 1.5 : multiPct >= 0.12 ? 1 : 0.5;
  if (multiPct < 0.12) {
    gaps.push({ id: "vers-multiuse", severity: "minor", label: "Few items work across multiple occasions", description: "Neutral, year-round pieces create the most outfit combinations for the space they take.", action: "Add neutral shoes or accessories — they multiply outfit options instantly." });
  }

  // ── Category depth / resilience (2 pts) ──
  // Each core category should have ≥2 items
  const coreCats: Category[] = ["Tops", "Bottoms", "Shoes", "Accessories"];
  const thinCats = coreCats.filter((c) => active.filter((i) => i.category === c).length < 2);
  pts += thinCats.length === 0 ? 2 : thinCats.length === 1 ? 1.25 : thinCats.length === 2 ? 0.5 : 0;
  if (thinCats.length >= 2) {
    gaps.push({
      id: "vers-depth",
      severity: "minor",
      label: `Thin coverage in ${thinCats.join(" and ")}`,
      description: `Only one item in ${thinCats.length} categories — you're one laundry day from having nothing to wear.`,
      action: `Add a second option in ${thinCats[0]} as a backup.`,
    });
  }

  const p = pts / MAX;
  const insight = p >= 0.8 ? "Excellent versatility — most pieces work across seasons and occasions."
    : p >= 0.6 ? "Good versatility with room to add more year-round staples."
    : p >= 0.35 ? "Limited versatility — many items are narrow in their use."
    : "Most items serve a single purpose — add more adaptable pieces.";

  return makeDim("versatility", "Versatility", pts, MAX, insight, gaps);
}


// ─── Main Export ──────────────────────────────────────────────────────────────

export function computeClosetScore(items: Item[], profile: UserProfile): CompletenessReport {
  const active = items.filter((i) => itemStatus(i) === "active");

  const dims: ScoreDimension[] = [
    scoreCategoryBalance(active, profile),
    scoreOccasions(active, profile),
    scoreColourPalette(active, profile),
    scoreStyleIdentity(active, profile),
    scoreOutfitBuildability(active, profile),
    scoreVersatility(active, profile),
  ];

  const totalMax    = dims.reduce((s, d) => s + d.maxScore, 0); // = 100
  const totalEarned = dims.reduce((s, d) => s + d.score, 0);
  const overall     = Math.round(clamp((totalEarned / totalMax) * 100, 0, 100));

  const grade: CompletenessReport["grade"] =
    overall >= 90 ? "A" : overall >= 78 ? "B" : overall >= 63 ? "C" : overall >= 48 ? "D" : "F";

  // Top gaps: sort by severity then by dimension weight (category first)
  const SEVERITY_ORDER: Record<GapSeverity, number> = { critical: 0, moderate: 1, minor: 2 };
  const allGaps = dims.flatMap((d) => d.gaps).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const topGaps = allGaps.slice(0, 3);

  // Strengths: insights from "strong" dimensions
  const strengths = dims.filter((d) => d.status === "strong").map((d) => d.insight);

  // Headline & subline
  const weakest = [...dims].sort((a, b) => a.pct - b.pct)[0];
  const profileComplete = (profile.completedAt ?? 0) > 0;

  const headline =
    overall >= 92 ? "Exceptionally well-curated" :
    overall >= 82 ? "A strong, thoughtful wardrobe" :
    overall >= 70 ? "Solid foundation with clear next steps" :
    overall >= 58 ? "Good bones — a few gaps to close" :
    overall >= 44 ? "Work in progress with real potential" :
    "Just getting started";

  const subline = !profileComplete
    ? "Complete your style profile for a fully personalised score."
    : topGaps.length > 0 && topGaps[0].severity === "critical"
    ? topGaps[0].description
    : weakest.status === "weak" || weakest.status === "fair"
    ? `Biggest opportunity: ${weakest.label.toLowerCase()}.`
    : "Your closet is in great shape across all dimensions.";

  return {
    overall,
    grade,
    headline,
    subline,
    dimensions: dims,
    topGaps,
    strengths,
    activeItemCount: active.length,
    profileComplete,
  };
}
