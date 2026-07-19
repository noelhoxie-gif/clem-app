import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { useCloset, type Category, type Season } from "@/lib/vesti/store";
import { SHOP_CATALOG } from "@/lib/vesti/suggestions";
import { useWearLog, wearLog, todayISO } from "@/lib/vesti/wear-log";
import { LogWearSheet } from "@/components/vesti/LogWearSheet";
import { Sparkles, ArrowUpRight, Shirt, CalendarDays, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Seasonal Report — Clem" },
      { name: "description", content: "What's trending this season and where your closet has gaps." },
    ],
  }),
  component: TrendsPage,
});

// Curated seasonal trend list — refreshed each season in app.
function currentSeason(): { label: string; season: Season } {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return { label: "Spring", season: "Warm" };
  if (m >= 5 && m <= 7) return { label: "Summer", season: "Warm" };
  if (m >= 8 && m <= 10) return { label: "Fall", season: "Cold" };
  return { label: "Winter", season: "Cold" };
}

interface Trend {
  title: string;
  blurb: string;
  category: Category;
  colors: string[];
  season: Season;
}

const TRENDS: Trend[] = [
  { title: "Quiet Luxury Knits", blurb: "Soft, expensive-looking neutrals — cashmere, merino, alpaca.", category: "Tops", colors: ["cream", "ivory", "camel", "sage"], season: "Cold" },
  { title: "Butter Yellow", blurb: "The runway color of the season — slips, knits, accessories.", category: "Tops", colors: ["butter", "champagne"], season: "Warm" },
  { title: "Burgundy Hour", blurb: "Wine-stained reds replacing black for evening — slip dresses, knits, tights.", category: "Tops", colors: ["burgundy", "wine", "merlot"], season: "Cold" },
  { title: "Boho Revival", blurb: "Crochet, lace, fringe — Sienna Miller energy.", category: "Tops", colors: ["ivory", "cream", "tan"], season: "Warm" },
  { title: "Wide-Leg Tailoring", blurb: "Drapey trousers and pleated skirts in muted tones.", category: "Bottoms", colors: ["charcoal", "cream", "espresso", "sage"], season: "Year-round" },
  { title: "Denim Maxi Skirts", blurb: "The new everyday — pair with a fitted top and slingbacks.", category: "Bottoms", colors: ["indigo", "light wash"], season: "Year-round" },
  { title: "Cobalt Trouser", blurb: "A jolt of saturated blue tailoring — the unexpected neutral.", category: "Bottoms", colors: ["cobalt", "navy", "royal"], season: "Year-round" },
  { title: "Ballet Flats", blurb: "Ribbon ties, mesh, satin — the slipper moment continues.", category: "Shoes", colors: ["black", "red", "ivory"], season: "Year-round" },
  { title: "Sculptural Sandals", blurb: "Lace-up, twisted leather, and architectural heels.", category: "Shoes", colors: ["tan", "black", "champagne"], season: "Warm" },
  { title: "Kitten-Heel Mules", blurb: "Square toes, low heels, polished metallic finishes.", category: "Shoes", colors: ["silver", "pewter", "bronze"], season: "Year-round" },
  { title: "Chocolate Outerwear", blurb: "The new camel — rich espresso and cocoa coats anchor every look.", category: "Outerwear", colors: ["chocolate", "cocoa", "espresso"], season: "Cold" },
  { title: "Statement Outerwear", blurb: "Oversized topcoats and tailored trenches.", category: "Outerwear", colors: ["camel", "ivory"], season: "Cold" },
  { title: "Layered Gold", blurb: "Stacked chains, baroque pearls, and chunky hoops.", category: "Accessories", colors: ["gold", "champagne"], season: "Year-round" },
  { title: "Silver Hardware", blurb: "Polished silver bags, belts, and chain jewelry — the cool counter to gold.", category: "Accessories", colors: ["silver", "chrome", "pewter"], season: "Year-round" },
  { title: "Structured Mini Bags", blurb: "Sculpted silhouettes in chocolate, sage, and butter.", category: "Accessories", colors: ["chocolate", "sage", "butter", "camel"], season: "Year-round" },
];

type Filter = "all" | "covered" | "gaps";

function TrendsPage() {
  const { items } = useCloset();
  const { entries } = useWearLog();
  const { label, season } = currentSeason();
  const [filter, setFilter] = useState<Filter>("all");
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLElement | null>(null);

  const seasonal = useMemo(
    () => TRENDS.filter((t) => t.season === season || t.season === "Year-round"),
    [season],
  );

  const analysis = useMemo(() => {
    const seasonItems = items.filter((i) => i.season === season || i.season === "Year-round");
    const lcColors = seasonItems.map((i) => (i.color ?? "").toLowerCase());

    return seasonal.map((trend) => {
      const ownedInCat = seasonItems.filter((i) => i.category === trend.category);
      const colorMatch = ownedInCat.some((i) => trend.colors.includes((i.color ?? "").toLowerCase()));
      const anyColorOverlap = trend.colors.some((c) => lcColors.includes(c));
      let coverage: "covered" | "partial" | "gap";
      if (colorMatch) coverage = "covered";
      else if (anyColorOverlap) coverage = "partial";
      else coverage = "gap";

      const pick = SHOP_CATALOG.find(
        (s) =>
          s.category === trend.category &&
          s.palette.some((p) => trend.colors.includes(p)),
      ) ?? SHOP_CATALOG.find((s) => s.category === trend.category);

      return { trend, coverage, ownedCount: ownedInCat.length, pick };
    });
  }, [items, seasonal, season]);

  const gapCount = analysis.filter((a) => a.coverage === "gap").length;
  const coveredCount = analysis.filter((a) => a.coverage === "covered").length;
  const total = analysis.length;

  const visibleAnalysis = analysis.filter((a) => {
    if (filter === "covered") return a.coverage === "covered";
    if (filter === "gaps") return a.coverage === "gap";
    return true;
  });

  const railItems = useMemo(
    () =>
      analysis
        .filter((a) => a.coverage !== "covered" && a.pick)
        .map((a) => ({ ...a.pick!, trendTitle: a.trend.title })),
    [analysis],
  );

  const verdict = useMemo(() => {
    if (total === 0) return "Your seasonal report is loading.";
    if (coveredCount === total) return `You're nailing every trend this ${label.toLowerCase()}.`;
    if (coveredCount === 0) return `Fresh season ahead — ${gapCount} trend${gapCount === 1 ? "" : "s"} worth exploring.`;
    return `You're nailing ${coveredCount} of ${total} trends. ${gapCount} gap${gapCount === 1 ? "" : "s"} worth a look.`;
  }, [coveredCount, gapCount, total, label]);

  function showFilter(next: Filter) {
    setFilter(next);
    window.requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <PageShell title="Report">
      <section className="px-6 pt-6 pb-6">
        <div className="flex items-center gap-2 mb-2 animate-rise">
          <Sparkles className="size-4 text-mint" strokeWidth={1.5} />
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {label} {new Date().getFullYear()} · Seasonal report
          </span>
        </div>
        <h1 className="font-serif text-3xl leading-tight tracking-[0.06em] uppercase animate-rise">Seasonal report</h1>
        <p className="font-serif text-lg text-foreground/80 mt-3 max-w-md animate-rise tracking-[0.02em]">
          {verdict}
        </p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-3">
          {total} trends · {coveredCount} covered · {gapCount} gaps
        </p>

        <div className="flex gap-2 mt-5 -mx-1 px-1 overflow-x-auto">
          {([
            { key: "all", label: "Trending now" },
            { key: "covered", label: "Covered" },
            { key: "gaps", label: "Gaps" },
          ] as { key: Filter; label: string }[]).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => showFilter(p.key)}
              className={`shrink-0 text-[11px] uppercase tracking-[0.2em] px-4 py-2 rounded-full transition active:scale-[0.97] ${
                filter === p.key
                  ? "bg-mauve text-cream"
                  : "bg-transparent border border-mauve/40 text-mauve"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <RealWearSection
        items={items}
        season={season}
        entriesCount={entries.length}
        onLog={(date) => { setLogDate(date); setLogOpen(true); }}
      />



      <section ref={listRef} className="px-6 pb-10 scroll-mt-24">
        <h2 className="sr-only">Trends</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {filter === "gaps"
            ? "Trends missing from your closet."
            : filter === "covered"
              ? "Trends your closet already nails."
              : "Fresh trends to explore this season."}
        </p>

        <ul className="space-y-3">
          {visibleAnalysis.map(({ trend, coverage, ownedCount }, idx) => {
            const isLead = idx === 0 && filter === "all";
            return (
              <li
                key={trend.title}
                className={`rounded-sm border p-6 ${
                  isLead
                    ? "bg-cream text-ink border-ink/20"
                    : "bg-cream text-ink border-ink/10"
                }`}
              >
                {isLead && (
                  <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">Lead trend</p>
                )}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className={`font-serif leading-tight tracking-[0.02em] ${isLead ? "text-3xl" : "text-xl"}`}>
                    {trend.title}
                  </h3>
                  <CoverageBadge coverage={coverage} />
                </div>
                <p className="text-sm text-ink/70 leading-relaxed font-light">{trend.blurb}</p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ink/10 text-[10px] uppercase tracking-[0.22em] text-ink/50">
                  <span>{trend.category}</span>
                  <span>·</span>
                  <span>
                    {coverage === "gap"
                      ? "Missing this trend"
                      : ownedCount === 0
                        ? "Color lives elsewhere"
                        : `${ownedCount} piece${ownedCount === 1 ? "" : "s"} in closet`}
                  </span>
                </div>
              </li>

            );
          })}
        </ul>
      </section>

      {railItems.length > 0 && filter !== "covered" && (
        <section className="pb-12">
          <div className="px-6 mb-4">
            <h2 className="font-serif text-xl tracking-[0.04em] uppercase">Fill the gaps</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Curated picks for what's missing.
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-6 pb-2 -mx-px">
            {railItems.map((p) => (
              <a
                key={p.id ?? `${p.name}-${p.trendTitle}`}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="snap-start shrink-0 w-44 rounded-2xl border border-border bg-card overflow-hidden active:scale-[0.98] transition"
              >
                <div className="aspect-square w-full bg-muted overflow-hidden">
                  <img src={p.image} alt={p.name} className="size-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-mint truncate">
                    Fills · {p.trendTitle}
                  </p>
                  <p className="text-sm font-medium truncate mt-1">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.brand} · {p.price}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] uppercase tracking-[0.2em] text-foreground/70">
                    Shop <ArrowUpRight className="size-3" strokeWidth={1.75} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
      <LogWearSheet open={logOpen} onClose={() => { setLogOpen(false); setLogDate(undefined); }} initialDate={logDate} />
    </PageShell>
  );
}

function RealWearSection({
  items,
  season,
  entriesCount,
  onLog,
}: {
  items: { id: string; name: string; image: string; category: Category; season: Season; color?: string; brand?: string }[];
  season: Season;
  entriesCount: number;
  onLog: (date?: string) => void;
}) {
  useWearLog();
  const counts = wearLog.wearCounts();
  const last = wearLog.lastWornMap();
  const { entries } = wearLog.get();

  const enriched = items.map((it) => ({
    ...it,
    wears: counts[it.id] ?? 0,
    lastWorn: last[it.id],
  }));

  const mostWorn = [...enriched].sort((a, b) => b.wears - a.wears).filter((x) => x.wears > 0).slice(0, 4);
  const seasonalOwned = enriched.filter((i) => i.season === season || i.season === "Year-round");
  const neverWorn = seasonalOwned.filter((i) => i.wears === 0).slice(0, 4);

  // Build last 14 days strip
  const days = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - idx));
    return d.toISOString().slice(0, 10);
  });
  const byDate: Record<string, typeof entries> = {};
  entries.forEach((e) => {
    (byDate[e.date] ??= []).push(e);
  });

  const recent = entries.slice(0, 4);

  return (
    <section className="px-6 pb-10 scroll-mt-24 mt-6 pt-10 border-t-4 border-double border-ink/20 bg-cream/40 -mx-0">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-ink/20" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-ink/60">Part II · Real wear</span>
        <div className="h-px flex-1 bg-ink/20" />
      </div>
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="size-4 text-mauve" strokeWidth={1.5} />
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {entriesCount} log{entriesCount === 1 ? "" : "s"}
          </span>
        </div>
        <h2 className="font-serif text-3xl leading-tight tracking-[0.06em] uppercase">What you actually wear</h2>
        <p className="text-xs text-muted-foreground mt-3 max-w-md">
          Aspirational vs. real. Logged outfits sharpen your seasonal report and warn you before
          you repeat a look around the same people.
        </p>
        {entriesCount > 0 && (
          <button
            type="button"
            onClick={onLog}
            className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] border border-ink/30 px-4 py-2 hover:bg-ink hover:text-cream transition"
          >
            <Shirt className="size-3" strokeWidth={1.5} />
            Log an outfit
          </button>
        )}
      </div>

      {entriesCount === 0 && (
        <div className="mt-8 text-center py-12 px-6 border border-ink/15 rounded-2xl bg-cream">
          <Sparkles className="size-6 mx-auto mb-3 text-mauve" strokeWidth={1.25} />
          <p className="font-serif text-2xl mb-2 tracking-[0.04em] uppercase">Start a wear log</p>
          <p className="text-xs text-muted-foreground max-w-[32ch] mx-auto mb-6">
            Log today's outfit — Clem learns what you actually reach for.
          </p>
          <button
            type="button"
            onClick={onLog}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] bg-sage text-cream px-8 py-4 rounded-full active:scale-[0.98] transition shadow-sm"
          >
            <Shirt className="size-4" strokeWidth={1.5} />
            Log an outfit
          </button>
        </div>
      )}

      {/* 14-day strip */}
      <div className={`mt-8 ${entriesCount === 0 ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground">Last 14 days</p>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <CalendarDays className="size-3" strokeWidth={1.5} />
            {entriesCount === 0 ? "Awaiting first log" : "Tap to log"}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {days.map((d) => {
            const list = byDate[d] ?? [];
            const isToday = d === todayISO();
            return (
              <button
                key={d}
                type="button"
                onClick={() => onLog(d)}
                className={`shrink-0 w-12 rounded-xl border text-center py-2 transition ${
                  list.length > 0
                    ? "border-mauve bg-mauve/10"
                    : "border-border bg-card hover:border-ink/40"
                }`}
              >
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  {new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className={`text-sm font-serif mt-0.5 ${isToday ? "text-mauve" : "text-foreground"}`}>
                  {new Date(d + "T00:00:00").getDate()}
                </p>
                <p className="text-[9px] text-mauve mt-0.5 h-3">
                  {list.length > 0 ? `${list.reduce((s, e) => s + e.itemIds.length, 0)} pcs` : ""}
                </p>
              </button>
            );
          })}
        </div>
      </div>


      {/* Most worn */}
      {mostWorn.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground mb-3">In heavy rotation</p>
          <ul className="grid grid-cols-2 gap-3">
            {mostWorn.map((it) => (
              <li key={it.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="aspect-[4/5] bg-muted">
                  <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] truncate">{it.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {[it.brand, it.color].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[10px] text-mauve mt-1">
                    {it.wears} wear{it.wears === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gathering dust */}
      {neverWorn.length > 0 && entriesCount > 0 && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground mb-1">
            Gathering dust this {season === "Cold" ? "season" : "season"}
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Owned but never logged — your aspirational pile.
          </p>
          <ul className="grid grid-cols-4 gap-2">
            {neverWorn.map((it) => (
              <li key={it.id} className="aspect-square rounded-lg overflow-hidden bg-card border border-border opacity-80">
                <img src={it.image} alt={it.name} className="w-full h-full object-cover grayscale" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent entries */}
      {recent.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.22em] text-foreground mb-3">Recently worn</p>
          <ul className="space-y-2">
            {recent.map((e) => {
              const pics = e.itemIds
                .map((id) => items.find((i) => i.id === id))
                .filter((x): x is NonNullable<typeof x> => !!x);
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-border">
                  <div className="flex -space-x-2 shrink-0">
                    {pics.slice(0, 3).map((p) => (
                      <div key={p.id} className="size-9 rounded-full overflow-hidden border-2 border-background bg-muted">
                        <img src={p.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.12em] truncate">
                      {pics.map((p) => p.name).slice(0, 2).join(" + ")}
                      {pics.length > 2 && ` +${pics.length - 2}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {e.date}
                      {e.people.length > 0 && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <Users className="size-2.5" strokeWidth={1.5} />
                          {e.people.join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => wearLog.remove(e.id)}
                    className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-mauve transition"
                  >
                    Undo
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}


function CoverageBadge({ coverage }: { coverage: "covered" | "partial" | "gap" }) {
  const styles =
    coverage === "covered"
      ? "bg-sage text-cream"
      : coverage === "partial"
        ? "border border-ink/30 text-ink/70"
        : "border border-mauve/50 text-mauve";
  const label = coverage === "covered" ? "Covered" : coverage === "partial" ? "Partial" : "Gap";
  return (
    <span
      className={`shrink-0 text-[9px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${styles}`}
    >
      {label}
    </span>
  );
}
