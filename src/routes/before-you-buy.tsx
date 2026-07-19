import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingBag, Link2, Loader2, ArrowLeft, Check, AlertTriangle, Sparkles,
  Camera, ScanLine, Tag, X,
} from "lucide-react";
import { PageShell } from "@/components/vesti/PageShell";
import { useCloset, closet, itemStatus, type Item, type Category } from "@/lib/vesti/store";
import { useProfile } from "@/lib/vesti/profile";
import { scrapeProduct, type ScrapedItem } from "@/lib/api/wishlist.functions";

export const Route = createFileRoute("/before-you-buy")({
  head: () => ({
    meta: [
      { title: "Should I buy this? — Clem" },
      { name: "description", content: "Paste a link or scan in store. Clem checks it against your closet and your style." },
    ],
  }),
  component: BeforeYouBuyPage,
});

const MAUVE = "#6B3A4A";
const CREAM = "#F2EDE6";

const COLOR_WORDS = [
  "black", "white", "ivory", "cream", "beige", "tan", "camel", "chocolate", "brown",
  "navy", "blue", "indigo", "denim", "sage", "olive", "green", "mint", "sky",
  "red", "burgundy", "wine", "pink", "blush", "rose", "mauve", "lavender", "purple",
  "yellow", "butter", "mustard", "gold", "silver", "grey", "gray", "charcoal",
  "orange", "rust", "coral", "peach", "espresso", "natural",
];

const CATEGORY_HINTS: Record<Category, string[]> = {
  Tops: ["shirt", "blouse", "tee", "top", "knit", "sweater", "cardigan", "turtleneck", "tank", "polo", "hoodie", "dress", "jumpsuit"],
  Bottoms: ["pant", "trouser", "jean", "denim", "skirt", "short", "legging", "chino"],
  Shoes: ["shoe", "boot", "sneaker", "sandal", "heel", "flat", "loafer", "mule", "pump", "slipper"],
  Outerwear: ["coat", "jacket", "blazer", "trench", "parka", "puffer", "vest", "cardigan"],
  Accessories: ["bag", "purse", "tote", "clutch", "scarf", "hat", "belt", "sunglass", "earring", "necklace", "bracelet", "ring"],
};

function detectCategory(text: string): Category {
  const t = text.toLowerCase();
  for (const cat of ["Shoes", "Outerwear", "Bottoms", "Accessories", "Tops"] as Category[]) {
    if (CATEGORY_HINTS[cat].some((w) => t.includes(w))) return cat;
  }
  return "Tops";
}

function detectColor(text: string): string | undefined {
  const t = text.toLowerCase();
  return COLOR_WORDS.find((c) => t.includes(c));
}

function pairingCategories(cat: Category): Category[] {
  switch (cat) {
    case "Tops": return ["Bottoms", "Shoes", "Outerwear", "Accessories"];
    case "Bottoms": return ["Tops", "Shoes", "Outerwear", "Accessories"];
    case "Shoes": return ["Tops", "Bottoms", "Outerwear", "Accessories"];
    case "Outerwear": return ["Tops", "Bottoms", "Shoes", "Accessories"];
    case "Accessories": return ["Tops", "Bottoms", "Shoes", "Outerwear"];
  }
}

const NEUTRALS = new Set(["black", "white", "ivory", "cream", "beige", "tan", "camel", "grey", "gray", "charcoal", "natural", "navy"]);

function colorsCompatible(a?: string, b?: string) {
  if (!a || !b) return true;
  const al = a.toLowerCase(); const bl = b.toLowerCase();
  if (NEUTRALS.has(al) || NEUTRALS.has(bl)) return true;
  if (al === bl) return true;
  const groups = [
    new Set(["sage", "olive", "green", "mint", "champagne", "gold"]),
    new Set(["blush", "pink", "rose", "mauve", "burgundy", "wine", "red"]),
    new Set(["butter", "mustard", "yellow", "gold", "cream", "chocolate"]),
    new Set(["sky", "blue", "navy", "indigo", "denim"]),
  ];
  return groups.some((g) => g.has(al) && g.has(bl));
}

interface Analysis {
  item: { title: string; image?: string; brand?: string; url: string; category: Category; color?: string };
  compatibleCount: number;
  totalCount: number;
  outfits: Item[][];
  styleAligned: boolean;
  styleNote: string;
  styleSuggestion?: string;
  similar: Item[];
  alreadyOwn: boolean;
}

const SIMILAR_KEYWORDS = [
  "trench", "blazer", "trouser", "jean", "denim", "skirt", "knit", "sweater", "cardigan",
  "shirt", "blouse", "tee", "tank", "dress", "slip", "coat", "puffer", "vest",
  "sneaker", "boot", "sandal", "loafer", "heel", "flat", "mule",
  "tote", "clutch", "bag", "purse", "scarf", "hat", "belt",
];

function keywordMatches(a: string, b: string): string | undefined {
  const al = a.toLowerCase(); const bl = b.toLowerCase();
  return SIMILAR_KEYWORDS.find((k) => al.includes(k) && bl.includes(k));
}

function analyze(scraped: ScrapedItem, items: Item[], profile: ReturnType<typeof useProfile>["profile"]): Analysis {
  // Use title only for category detection — descriptions often mention pairings
  // (e.g. "looks great with sneakers") and would mis-classify the item.
  const title = scraped.title ?? "";
  const text = `${title} ${scraped.description ?? ""}`;
  const category = detectCategory(title);
  const color = detectColor(text);

  const active = items.filter((i) => itemStatus(i) === "active");

  const pairCats = pairingCategories(category);
  const candidates = active.filter((i) => pairCats.includes(i.category));
  const compatible = candidates.filter((i) => colorsCompatible(color, i.color));
  const compatibleCount = compatible.length;
  const totalCount = active.length;

  // Find pieces already in the closet that look similar to this one.
  // Require BOTH same category AND a shared item-type keyword (e.g. both are
  // "blouses" or both are "sneakers"). Color alone is not enough — otherwise
  // any white item would match a white top.
  const similar = active
    .filter((i) => i.category === category)
    .map((i) => {
      const kw = keywordMatches(title, `${i.name} ${i.brand ?? ""}`);
      const sameColor = !!color && !!i.color && i.color.toLowerCase().includes(color);
      const sameNeutral = !!color && !!i.color && NEUTRALS.has(color) && NEUTRALS.has(i.color.toLowerCase());
      const score = (kw ? 3 : 0) + (sameColor ? 2 : 0) + (sameNeutral ? 1 : 0);
      return { item: i, score, hasKeyword: !!kw };
    })
    .filter((s) => s.hasKeyword)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.item);

  const alreadyOwn = similar.length > 0;


  const slots: Category[] = category === "Shoes"
    ? ["Tops", "Bottoms", "Outerwear"]
    : category === "Bottoms"
    ? ["Tops", "Shoes", "Outerwear"]
    : category === "Outerwear"
    ? ["Tops", "Bottoms", "Shoes"]
    : category === "Accessories"
    ? ["Tops", "Bottoms", "Shoes"]
    : ["Bottoms", "Shoes", "Outerwear"];

  const byCat: Record<string, Item[]> = {};
  for (const c of slots) {
    byCat[c] = compatible.filter((i) => i.category === c);
    if (byCat[c].length === 0) byCat[c] = candidates.filter((i) => i.category === c);
  }
  const outfits: Item[][] = [];
  for (let n = 0; n < 3; n++) {
    const set: Item[] = [];
    for (const c of slots) {
      const pool = byCat[c];
      if (pool && pool.length > 0) set.push(pool[n % pool.length]);
    }
    if (set.length > 0) outfits.push(set);
  }

  const avoid = (profile.avoidColors || "").toLowerCase();
  const loved = profile.colors.map((c) => c.toLowerCase());
  const conflictsAvoid = !!color && avoid.includes(color);
  const matchesLoved = !!color && loved.some((c) => c.includes(color));
  const styleAligned = !conflictsAvoid && (matchesLoved || NEUTRALS.has((color ?? "").toLowerCase()) || loved.length === 0);

  let styleNote = "This fits your style.";
  let styleSuggestion: string | undefined;
  if (conflictsAvoid) {
    styleNote = `This is a stretch from your usual palette — but here's how it could work.`;
    styleSuggestion = `Anchor it with your cream trousers and tan sandals so the ${color} reads as the single statement.`;
  } else if (!matchesLoved && color && !NEUTRALS.has(color)) {
    styleNote = `A small step outside your usual palette — but worth trying.`;
    styleSuggestion = `Pair with neutrals from your closet to keep it grounded.`;
  }

  return {
    item: { title: scraped.title, image: scraped.image, brand: scraped.brand, url: scraped.url, category, color },
    compatibleCount,
    totalCount,
    outfits,
    styleAligned,
    styleNote,
    styleSuggestion,
    similar,
    alreadyOwn,
  };
}

type Mode = "link" | "scan";
type ScanKind = "item" | "tag" | "barcode";

function BeforeYouBuyPage() {
  const { items } = useCloset();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("scan");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<ScrapedItem | null>(null);

  // Scan state
  const [scanKind, setScanKind] = useState<ScanKind | null>(null);
  const [snapImage, setSnapImage] = useState<string | undefined>(undefined);
  const [snapBrand, setSnapBrand] = useState("");
  const [snapName, setSnapName] = useState("");
  const [snapColor, setSnapColor] = useState("");

  const analysis = useMemo(() => (scraped ? analyze(scraped, items, profile) : null), [scraped, items, profile]);

  const reset = () => {
    setScraped(null);
    setUrl("");
    setSnapImage(undefined);
    setSnapBrand("");
    setSnapName("");
    setSnapColor("");
    setScanKind(null);
    setError(null);
  };

  const onAnalyzeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const item = await scrapeProduct({ data: { url: url.trim() } });
      setScraped(item);
    } catch {
      setError("Couldn't fetch that link. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  const onAnalyzeSnap = (e: React.FormEvent) => {
    e.preventDefault();
    const title = [snapColor, snapName].filter(Boolean).join(" ").trim() || "In-store find";
    setScraped({
      url: `instore:${Date.now()}`,
      title,
      image: snapImage,
      brand: snapBrand || undefined,
      description: `${snapColor} ${snapName}`.trim(),
    });
  };

  const addToWishlist = () => {
    if (!scraped) return;
    closet.addWish(scraped);
    navigate({ to: "/wishlist" });
  };

  const addToCloset = () => {
    if (!analysis) return;
    closet.addItem({
      name: analysis.item.title,
      brand: analysis.item.brand,
      color: analysis.item.color ? analysis.item.color[0].toUpperCase() + analysis.item.color.slice(1) : undefined,
      category: analysis.item.category,
      season: "Year-round",
      image: analysis.item.image ?? "",
    });
    navigate({ to: "/" });
  };

  return (
    <PageShell title="Before You Buy">
      <section style={{ backgroundColor: CREAM }} className="min-h-[calc(100vh-180px)]">
        <div className="px-6 pt-4 pb-12 max-w-xl mx-auto">
          <div className="flex gap-2 mb-5 border border-ink/20 rounded-full p-1">
            <Link
              to="/wishlist"
              search={{ mode: "wishlist" }}
              className="flex-1 rounded-full py-2 text-xs font-medium uppercase tracking-[0.18em] transition text-ink/60 text-center"
            >
              Wishlist
            </Link>
            <Link
              to="/wishlist"
              search={{ mode: "discover" }}
              className="flex-1 rounded-full py-2 text-xs font-medium uppercase tracking-[0.18em] transition text-ink/60 text-center"
            >
              Discover
            </Link>
            <button
              type="button"
              className="flex-1 rounded-full py-2 text-xs font-medium uppercase tracking-[0.18em] transition bg-ink text-cream"
            >
              Before you buy
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-serif tracking-[0.04em] text-ink">Shopping right now?</h2>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Scan or snap any piece in store — Clem checks your closet before you spend.
            </p>
          </div>


          {!analysis && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-5 border rounded-full p-1" style={{ borderColor: `${MAUVE}33` }}>
                {(["scan", "link"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(null); }}
                    className="flex-1 rounded-full py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition inline-flex items-center justify-center gap-1.5"
                    style={mode === m
                      ? { backgroundColor: MAUVE, color: CREAM }
                      : { color: MAUVE, opacity: 0.7 }}
                  >
                    {m === "link" ? <><Link2 className="size-3.5" /> Paste link</> : <><ScanLine className="size-3.5" /> Scan in store</>}
                  </button>
                ))}
              </div>

              {mode === "scan" && (
                <ScanFlow
                  kind={scanKind}
                  setKind={setScanKind}
                  image={snapImage}
                  setImage={setSnapImage}
                  brand={snapBrand}
                  setBrand={setSnapBrand}
                  name={snapName}
                  setName={setSnapName}
                  color={snapColor}
                  setColor={setSnapColor}
                  onAnalyze={onAnalyzeSnap}
                  onUrlDetected={async (u) => {
                    setLoading(true); setError(null);
                    try {
                      const item = await scrapeProduct({ data: { url: u } });
                      setScraped(item);
                    } catch {
                      setError("Found a code, but couldn't load that product. Try paste link instead.");
                    } finally { setLoading(false); }
                  }}
                  loading={loading}
                />
              )}
              {error && mode === "scan" && <p className="text-xs text-destructive mt-2">{error}</p>}

              {mode === "link" && (
                <form onSubmit={onAnalyzeLink} className="space-y-3">
                  <div className="relative">
                    <Link2 className="size-4 absolute left-4 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-full bg-white border pl-11 pr-4 py-3 text-sm focus:outline-none"
                      style={{ borderColor: `${MAUVE}33` }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !url.trim()}
                    className="w-full rounded-full py-3 text-xs font-medium uppercase tracking-[0.18em] disabled:opacity-40 inline-flex items-center justify-center gap-2"
                    style={{ backgroundColor: MAUVE, color: CREAM }}
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    Analyze this piece
                  </button>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </form>
              )}
            </>
          )}

          {analysis && (
            <div className="space-y-10">
              <div className="flex gap-4 items-center">
                <div className="size-24 rounded-2xl overflow-hidden bg-white shrink-0">
                  {analysis.item.image ? (
                    <img src={analysis.item.image} alt={analysis.item.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  {analysis.item.brand && (
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{analysis.item.brand}</p>
                  )}
                  <p className="text-sm leading-tight line-clamp-2 mt-0.5" style={{ color: MAUVE }}>
                    {analysis.item.title}
                  </p>
                  <button onClick={reset} className="text-[10px] underline mt-2 text-muted-foreground">
                    Check another piece
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-[0.28em] text-center mb-4" style={{ color: MAUVE }}>
                  Already in your closet?
                </p>
                <div
                  className="rounded-3xl border p-5 text-center"
                  style={{
                    backgroundColor: analysis.alreadyOwn ? "#FBF1E1" : "#EFF4EC",
                    borderColor: analysis.alreadyOwn ? "#D9A86A55" : "#9CB28E55",
                  }}
                >
                  <div
                    className="mx-auto size-12 rounded-full grid place-items-center mb-3"
                    style={{ backgroundColor: analysis.alreadyOwn ? "#D9A86A" : "#9CB28E" }}
                  >
                    {analysis.alreadyOwn ? <AlertTriangle className="size-5 text-white" /> : <Check className="size-5 text-white" />}
                  </div>
                  <p
                    className="font-serif italic text-3xl leading-tight"
                    style={{ color: MAUVE, fontFamily: 'Georgia, serif' }}
                  >
                    {analysis.alreadyOwn ? "You already own something similar." : "Nothing like it in your closet."}
                  </p>
                  <p className="text-xs mt-3 leading-relaxed px-2" style={{ color: MAUVE }}>
                    {analysis.alreadyOwn
                      ? `Clem found ${analysis.similar.length} piece${analysis.similar.length === 1 ? "" : "s"} in your closet that overlap${analysis.similar.length === 1 ? "s" : ""} with this one — make sure it's truly different before you buy.`
                      : `It would also work with ${analysis.compatibleCount} of your ${analysis.totalCount} closet pieces.`}
                  </p>

                  {analysis.alreadyOwn && (
                    <div className="flex justify-center gap-3 mt-4">
                      {analysis.similar.map((s) => (
                        <div key={s.id} className="w-20">
                          <div className="aspect-square rounded-xl overflow-hidden bg-white">
                            {s.image && <img src={s.image} alt={s.name} className="w-full h-full object-cover" />}
                          </div>
                          <p className="text-[10px] mt-1.5 line-clamp-2 leading-tight" style={{ color: MAUVE }}>
                            {s.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] mb-4 text-center" style={{ color: MAUVE }}>
                  Looks you could build today
                </p>
                <div className="space-y-4">
                  {analysis.outfits.map((outfit, i) => (
                    <div key={i} className="rounded-3xl p-4 border" style={{ backgroundColor: "#FAF6EF", borderColor: `${MAUVE}1A` }}>
                      <p className="text-[10px] uppercase tracking-[0.22em] mb-3 opacity-60" style={{ color: MAUVE }}>
                        Look {String.fromCharCode(65 + i)}
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        <OutfitTile name={analysis.item.title} image={analysis.item.image} highlight />
                        {outfit.map((it) => (
                          <OutfitTile key={it.id} name={it.name} image={it.image} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {analysis.outfits.length === 0 && (
                    <p className="text-xs text-center text-muted-foreground italic">
                      Add a few more closet items and Clem can style this for you.
                    </p>
                  )}
                </div>
              </div>

              <div
                className="rounded-3xl p-5 border"
                style={{
                  backgroundColor: analysis.styleAligned ? "#EFF4EC" : "#FBF1E1",
                  borderColor: analysis.styleAligned ? "#9CB28E55" : "#D9A86A55",
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: MAUVE }}>Style Check</p>
                <div className="flex gap-3 items-start">
                  <div className="size-7 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ backgroundColor: analysis.styleAligned ? "#9CB28E" : "#D9A86A" }}>
                    {analysis.styleAligned ? <Check className="size-4 text-white" /> : <AlertTriangle className="size-4 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-serif italic" style={{ color: MAUVE, fontFamily: 'Georgia, serif' }}>{analysis.styleNote}</p>
                    {analysis.styleSuggestion && (
                      <p className="text-xs mt-2 leading-relaxed" style={{ fontFamily: 'Calibri, sans-serif' }}>{analysis.styleSuggestion}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button onClick={addToWishlist} className="w-full rounded-full py-3.5 text-xs font-medium uppercase tracking-[0.2em] border-2" style={{ borderColor: MAUVE, color: MAUVE, backgroundColor: CREAM }}>
                  Add to Wishlist
                </button>
                <button onClick={addToCloset} className="w-full rounded-full py-3.5 text-xs font-medium uppercase tracking-[0.2em]" style={{ backgroundColor: MAUVE, color: CREAM }}>
                  Add to Closet
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

/* ---------------- Scan flow ---------------- */

function ScanFlow(props: {
  kind: ScanKind | null;
  setKind: (k: ScanKind | null) => void;
  image?: string;
  setImage: (s?: string) => void;
  brand: string; setBrand: (s: string) => void;
  name: string; setName: (s: string) => void;
  color: string; setColor: (s: string) => void;
  onAnalyze: (e: React.FormEvent) => void;
  onUrlDetected: (url: string) => void;
  loading: boolean;
}) {
  const { kind, setKind } = props;

  if (!kind) {
    return (
      <div className="grid grid-cols-1 gap-3">
        <ScanOption
          icon={<Camera className="size-4" />}
          title="Snap the item"
          sub="Take a photo of the piece on the rack."
          onClick={() => setKind("item")}
        />
        <ScanOption
          icon={<ScanLine className="size-4" />}
          title="Scan barcode or QR"
          sub="Use your camera to read the tag's code."
          onClick={() => setKind("barcode")}
        />
        <ScanOption
          icon={<Tag className="size-4" />}
          title="Snap the price tag"
          sub="Capture brand and name from the tag."
          onClick={() => setKind("tag")}
        />
      </div>
    );
  }

  if (kind === "barcode") {
    return <BarcodeScanner onCancel={() => setKind(null)} onUrl={props.onUrlDetected} loading={props.loading} />;
  }

  // item or tag — same capture + describe form
  return <SnapForm {...props} />;
}

function ScanOption({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-2xl px-4 py-3.5 border-2 bg-white text-left active:scale-[0.99] transition"
      style={{ borderColor: `${MAUVE}33` }}
    >
      <div className="size-9 rounded-full grid place-items-center" style={{ backgroundColor: MAUVE, color: CREAM }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-serif italic" style={{ color: MAUVE, fontFamily: 'Georgia, serif' }}>{title}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] opacity-60 mt-0.5" style={{ color: MAUVE }}>{sub}</p>
      </div>
    </button>
  );
}

function SnapForm(props: {
  kind: ScanKind | null;
  setKind: (k: ScanKind | null) => void;
  image?: string;
  setImage: (s?: string) => void;
  brand: string; setBrand: (s: string) => void;
  name: string; setName: (s: string) => void;
  color: string; setColor: (s: string) => void;
  onAnalyze: (e: React.FormEvent) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = (f?: File) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => props.setImage(reader.result as string);
    reader.readAsDataURL(f);
  };

  const isTag = props.kind === "tag";
  const canSubmit = (props.name.trim().length > 0) || !!props.image;

  return (
    <form onSubmit={props.onAnalyze} className="space-y-4">
      <button
        type="button"
        onClick={() => props.setKind(null)}
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]"
        style={{ color: MAUVE }}
      >
        <ArrowLeft className="size-3" /> Back to scan options
      </button>

      <label className="block">
        <div
          className="aspect-[4/5] rounded-3xl bg-white border-2 border-dashed grid place-items-center overflow-hidden relative"
          style={{ borderColor: `${MAUVE}55` }}
        >
          {props.image ? (
            <>
              <img src={props.image} alt="Scan" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); props.setImage(undefined); }}
                className="absolute top-2 right-2 size-8 grid place-items-center rounded-full bg-white/90"
                aria-label="Remove photo"
              >
                <X className="size-4" style={{ color: MAUVE }} />
              </button>
            </>
          ) : (
            <div className="text-center px-6">
              <div className="size-12 rounded-full grid place-items-center mx-auto mb-3" style={{ backgroundColor: MAUVE, color: CREAM }}>
                {isTag ? <Tag className="size-5" /> : <Camera className="size-5" />}
              </div>
              <p className="text-sm font-serif italic" style={{ color: MAUVE, fontFamily: 'Georgia, serif' }}>
                {isTag ? "Snap the price tag" : "Snap the item"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] mt-1 opacity-60" style={{ color: MAUVE }}>
                Tap to open camera
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Brand" value={props.brand} onChange={props.setBrand} placeholder={isTag ? "From tag" : "Optional"} />
        <Field label="Color" value={props.color} onChange={props.setColor} placeholder="e.g. cream" />
      </div>
      <Field label={isTag ? "Item name (from tag)" : "What is it?"} value={props.name} onChange={props.setName} placeholder="e.g. linen blazer" />

      <p className="text-[10px] text-muted-foreground">
        A few words help Clem categorise and color-match against your closet.
      </p>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-full py-3 text-xs font-medium uppercase tracking-[0.18em] disabled:opacity-40 inline-flex items-center justify-center gap-2"
        style={{ backgroundColor: MAUVE, color: CREAM }}
      >
        <Sparkles className="size-4" /> Analyze this piece
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: MAUVE }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-full bg-white border px-4 py-2.5 text-sm focus:outline-none"
        style={{ borderColor: `${MAUVE}33` }}
      />
    </label>
  );
}

/* ---------------- Barcode scanner (BarcodeDetector w/ graceful fallback) ---------------- */

interface DetectedBarcode { rawValue: string; format: string }
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): { detect: (s: CanvasImageSource) => Promise<DetectedBarcode[]> };
  getSupportedFormats?: () => Promise<string[]>;
}

function BarcodeScanner({ onCancel, onUrl, loading }: { onCancel: () => void; onUrl: (url: string) => void; loading: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string>("Point at a tag's barcode or QR code…");
  const [manual, setManual] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const Ctor = (typeof window !== "undefined" ? (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector : undefined);
    if (!Ctor || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    setSupported(true);
    let cancelled = false;

    (async () => {
      try {
        const detector = new Ctor({ formats: ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        const tick = async () => {
          if (!videoRef.current || cancelled) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue;
              setStatus(`Found: ${value}`);
              if (/^https?:\/\//i.test(value)) {
                onUrl(value);
                return;
              } else {
                setStatus(`Found code ${value}. No product page — paste it below or try another scan.`);
                setManual(value);
                return;
              }
            }
          } catch {/* ignore frame errors */}
          rafRef.current = window.requestAnimationFrame(tick);
        };
        rafRef.current = window.requestAnimationFrame(tick);
      } catch {
        setSupported(false);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onUrl]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]"
        style={{ color: MAUVE }}
      >
        <ArrowLeft className="size-3" /> Back to scan options
      </button>

      {supported === false ? (
        <div className="rounded-3xl bg-white p-5 border" style={{ borderColor: `${MAUVE}33` }}>
          <p className="text-sm font-serif italic mb-1" style={{ color: MAUVE, fontFamily: 'Georgia, serif' }}>
            Your browser can't scan codes
          </p>
          <p className="text-xs text-muted-foreground">
            Try Chrome on Android, or paste the product link from the retailer.
          </p>
        </div>
      ) : (
        <div
          className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-black"
          style={{ outline: `2px solid ${MAUVE}33` }}
        >
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-8 border-2 rounded-2xl" style={{ borderColor: CREAM, opacity: 0.7 }} />
          <div className="absolute bottom-3 inset-x-3 text-center text-[11px] py-1.5 rounded-full" style={{ backgroundColor: `${MAUVE}E6`, color: CREAM }}>
            {loading ? "Loading product…" : status}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (/^https?:\/\//i.test(manual.trim())) onUrl(manual.trim()); }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type/paste the link or code"
          className="flex-1 rounded-full bg-white border px-4 py-2.5 text-sm focus:outline-none"
          style={{ borderColor: `${MAUVE}33` }}
        />
        <button
          type="submit"
          className="rounded-full px-4 text-[11px] font-medium uppercase tracking-[0.18em] disabled:opacity-40"
          style={{ backgroundColor: MAUVE, color: CREAM }}
          disabled={!/^https?:\/\//i.test(manual.trim()) || loading}
        >
          Go
        </button>
      </form>
    </div>
  );
}

function OutfitTile({ name, image, highlight }: { name: string; image?: string; highlight?: boolean }) {
  return (
    <div>
      <div
        className="aspect-square rounded-2xl overflow-hidden bg-white relative"
        style={highlight ? { boxShadow: `0 0 0 2px ${MAUVE}` } : undefined}
      >
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground">
            <ShoppingBag className="size-4 opacity-40" />
          </div>
        )}
        {highlight && (
          <div className="absolute bottom-1 left-1 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ backgroundColor: MAUVE, color: CREAM }}>
            New
          </div>
        )}
      </div>
      <p className="text-[9px] mt-1.5 line-clamp-2 leading-tight text-center opacity-70" style={{ color: MAUVE }}>
        {name}
      </p>
    </div>
  );
}
