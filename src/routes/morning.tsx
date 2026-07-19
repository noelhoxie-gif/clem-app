import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCloset, type Category, type Item } from "@/lib/vesti/store";
import { useProfile, profileStore } from "@/lib/vesti/profile";
import { FitModel, FitModelStage } from "@/components/vesti/FitModel";
import {
  dayOfWeekLabel,
  getMorningWeather,
  greetingFor,
  markMorningSeenToday,
  momentBlurb,
  momentFor,
  occasionForToday,
  pickLookFromLookbook,
  quoteForToday,
  taglineForToday,
  type MomentTag,
  type MorningWeather,
  type TodayLook,
} from "@/lib/vesti/morning";
import { wearLog } from "@/lib/vesti/wear-log";
import { ArrowRight, Clock, RefreshCw, Sun, X, Zap } from "lucide-react";

type Slot = "outer" | "top" | "bottom" | "shoes" | "accessory";
const SLOT_TO_CATEGORY: Record<Slot, Category> = {
  outer: "Outerwear",
  top: "Tops",
  bottom: "Bottoms",
  shoes: "Shoes",
  accessory: "Accessories",
};

export const Route = createFileRoute("/morning")({
  head: () => ({
    meta: [
      { title: "Right now — Clem" },
      { name: "description", content: "One considered look for this exact moment." },
    ],
  }),
  component: MorningPage,
});


function momentToHour(m: MomentTag): number {
  switch (m) {
    case "Morning": return 8;
    case "Midday": return 13;
    case "After work": return 18;
    case "Tonight": return 21;
  }
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-ink/70 border border-ink/20 rounded-full px-3 py-1.5 bg-cream">
      {children}
    </span>
  );
}

const MOMENTS: MomentTag[] = ["Morning", "Midday", "After work", "Tonight"];

function MorningPage() {
  const navigate = useNavigate();
  const { items: allItems } = useCloset();
  const items = useMemo(() => allItems.filter((i) => (i.status ?? "active") === "active"), [allItems]);
  const { profile } = useProfile();
  const [seed, setSeed] = useState(0);
  const [weather, setWeather] = useState<MorningWeather | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  // Initial values are deterministic so SSR markup matches first client paint.
  // Real time-derived values get filled in inside the mount effect below.
  const [moment, setMoment] = useState<MomentTag>("Morning");
  const [rushed, setRushed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMoment(momentFor());
    markMorningSeenToday();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMorningWeather(profile.city).then((w) => {
      if (!cancelled) {
        setWeather(w);
        setWeatherLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [profile.city]);

  // Greeting tied to the selected moment (not just clock), so an after-work
  // pivot reads correctly even if she opens it at noon.
  const greeting = useMemo(
    () => greetingFor(profile.firstName, momentToHour(moment), rushed),
    [profile.firstName, moment, rushed],
  );
  const occasion = useMemo(
    () => occasionForToday(profile, mounted ? new Date() : new Date(0), moment),
    [profile, moment, mounted],
  );
  // Stable empty strings on SSR; real labels swap in after mount to avoid hydration mismatch.
  const dow = useMemo(() => (mounted ? dayOfWeekLabel() : ""), [mounted]);
  const tagline = useMemo(() => (mounted ? taglineForToday() : ""), [mounted]);
  const quote = useMemo(() => (mounted ? quoteForToday() : ""), [mounted]);
  const blurb = useMemo(() => momentBlurb(moment, rushed), [moment, rushed]);

  const baseLook: TodayLook | null = useMemo(
    () => pickLookFromLookbook(items, weather?.pack, occasion, seed),
    [items, weather?.pack, occasion, seed],
  );

  // Per-slot user overrides on top of the suggested look
  const [overrides, setOverrides] = useState<Partial<Record<Slot, Item>>>({});
  useEffect(() => {
    // Reset overrides when the base suggestion changes
    setOverrides({});
  }, [baseLook]);

  const look: TodayLook | null = useMemo(() => {
    if (!baseLook) return null;
    return { ...baseLook, ...overrides };
  }, [baseLook, overrides]);

  const [picker, setPicker] = useState<Slot | null>(null);
  const pickerOptions = useMemo(() => {
    if (!picker) return [];
    return items.filter((i) => i.category === SLOT_TO_CATEGORY[picker]);
  }, [picker, items]);

  const pieces: { item: Item; role: string; slot: Slot }[] = useMemo(() => {
    if (!look) return [];
    const out: { item: Item; role: string; slot: Slot }[] = [];
    if (look.outer) out.push({ item: look.outer, role: "Layer", slot: "outer" });
    if (look.top) out.push({ item: look.top, role: "Top", slot: "top" });
    if (look.bottom) out.push({ item: look.bottom, role: "Bottom", slot: "bottom" });
    if (look.shoes) out.push({ item: look.shoes, role: "Shoes", slot: "shoes" });
    if (look.accessory) out.push({ item: look.accessory, role: "Finish", slot: "accessory" });
    return out;
  }, [look]);

  const onWearing = () => {
    if (!look) return;
    wearLog.log({ itemIds: pieces.map((p) => p.item.id) });
    setConfirmed(true);
  };

  // Final "you're ready" screen
  if (confirmed) {
    return (
      <div className="min-h-screen bg-cream text-ink flex flex-col">
        <div className="flex justify-end px-6 pt-6">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            aria-label="Close"
            className="size-9 grid place-items-center text-ink/60 hover:text-ink transition"
          >
            <X className="size-5" strokeWidth={1.25} />
          </button>
        </div>
        <div className="flex-1 grid place-items-center px-8 -mt-8 text-center animate-rise">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-6">{dow}</p>
            <h1 className="font-serif italic text-6xl leading-[1.02] tracking-[0.01em] text-ink mb-6">
              You're ready.
            </h1>
            <p className="text-sm text-ink/70 tracking-wide italic max-w-[28ch] mx-auto leading-relaxed">
              {tagline}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="mt-12 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] border-b border-ink/40 pb-1 hover:text-mauve transition"
            >
              Into the day <ArrowRight className="size-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col">
      {/* Top bar */}
      <div className="flex justify-between items-center px-6 pt-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-mauve inline-flex items-center gap-1.5">
          <Clock className="size-3" strokeWidth={1.5} /> Right now
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          aria-label="Close"
          className="size-9 grid place-items-center text-ink/60 hover:text-ink transition"
        >
          <X className="size-5" strokeWidth={1.25} />
        </button>
      </div>

      {/* Greeting */}
      <header className="px-7 pt-6">
        <h1 className="font-serif italic text-[40px] leading-[1.05] tracking-[0.01em] text-ink">
          {greeting}
        </h1>
        <p className="mt-2 text-sm text-ink/60 font-serif italic leading-snug max-w-[36ch]">
          {rushed ? blurb : quote}
        </p>

        {/* Inline name capture if missing */}
        {!profile.firstName && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = nameDraft.trim();
              if (!v) return;
              profileStore.save({ ...profile, firstName: v });
              setNameDraft("");
            }}
            className="mt-4 flex items-center gap-2 max-w-xs"
          >
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your first name"
              className="flex-1 bg-transparent border-b border-ink/30 py-1.5 text-sm placeholder:text-ink/40 focus:outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={!nameDraft.trim()}
              className="text-[10px] uppercase tracking-[0.22em] text-ink/70 disabled:opacity-40"
            >
              Save
            </button>
          </form>
        )}

        {/* Moment selector — pick the moment you're styling for */}
        <div className="mt-6 -mx-7 px-7 overflow-x-auto no-scrollbar">
          <div className="flex gap-1.5 min-w-max">
            {MOMENTS.map((m) => {
              const active = m === moment;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMoment(m); setSeed((s) => s + 1); }}
                  className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border transition ${
                    active
                      ? "bg-sage text-cream border-sage"
                      : "border-ink/20 text-ink/70 hover:border-ink/50"
                  }`}
                >
                  {m}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => { setRushed((r) => !r); setSeed((s) => s + 1); }}
              aria-pressed={rushed}
              className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition ${
                rushed
                  ? "bg-mauve text-cream border-mauve"
                  : "border-ink/20 text-ink/70 hover:border-ink/50"
              }`}
            >
              <Zap className="size-3" strokeWidth={1.5} /> Running late
            </button>
          </div>
        </div>

        {/* Context pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>
            <Sun className="size-3" strokeWidth={1.5} />
            {weatherLoaded
              ? weather
                ? `${weather.label}${weather.place ? ` · ${weather.place}` : ""}`
                : "Weather unavailable"
              : "Reading the sky…"}
          </Pill>
          <Pill>{dow}</Pill>
          <Pill>{occasion}</Pill>
        </div>
      </header>

      {/* The Look */}
      <main className="flex-1 px-7 pt-8 pb-6">
        <p className="font-serif italic text-base text-mauve mb-1">
          {rushed ? "Grab this" : moment === "Morning" ? "Today's Look" : `For ${moment.toLowerCase()}`}
        </p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink/45 mb-3">
          From your Lookbook
        </p>


        {!look ? (
          <div className="aspect-[3/4] grid place-items-center border border-dashed border-ink/20 text-center px-8">
            <p className="text-xs text-ink/60 tracking-wide">
              Add a few pieces to your closet and Clem will style your morning.
            </p>
          </div>
        ) : (
          <article className="animate-rise">
            {/* The look — rendered on the user's fit model */}
            <FitModelStage className="py-4">
              <FitModel
                className="max-w-[260px]"
                height={profile.height}
                weight={profile.weight}
                shape={profile.bodyShape}
                skinTone={(profile.skinTone || "light") as never}
                outfit={{
                  outer: look.outer ?? undefined,
                  top: look.top ?? undefined,
                  bottom: look.bottom ?? undefined,
                  shoes: look.shoes ?? undefined,
                  accessory: look.accessory ?? undefined,
                }}
                onSlotClick={(slot) => setPicker(slot)}
              />
              <p className="text-center text-[10px] uppercase tracking-[0.22em] text-ink/40 pb-3">
                Tap any piece to swap
              </p>
            </FitModelStage>

            <p className="mt-5 font-serif italic text-lg leading-snug text-ink max-w-[40ch]">
              {look.note}
            </p>

            <ul className="mt-5 divide-y divide-ink/10 border-t border-ink/10">
              {pieces.map(({ item, role, slot }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setPicker(slot)}
                    className="w-full flex items-baseline justify-between py-2.5 text-left hover:text-mauve transition"
                  >
                    <span className="text-[10px] uppercase tracking-[0.22em] text-ink/50 w-16">
                      {role}
                    </span>
                    <span className="flex-1 text-sm text-ink truncate">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ink/50 ml-3 truncate max-w-[40%] text-right">
                      {[item.brand, item.color].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </article>
        )}
      </main>

      {/* Actions */}
      {look && (
        <div className="sticky bottom-0 bg-cream/95 backdrop-blur px-6 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] border-t border-ink/10">
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onWearing}
              className="w-full bg-ink text-cream text-[11px] uppercase tracking-[0.24em] py-4 hover:bg-ink/90 transition active:scale-[0.99]"
            >
              Wearing this today
            </button>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="w-full text-[10px] uppercase tracking-[0.24em] text-ink/70 py-2 inline-flex items-center justify-center gap-2 hover:text-ink transition border border-ink/15"
            >
              <RefreshCw className="size-3" strokeWidth={1.5} />
              Try something else
            </button>
            <Link
              to="/"
              className="text-center text-[10px] uppercase tracking-[0.22em] text-ink/40 italic"
            >
              Skip for today
            </Link>
          </div>
        </div>
      )}

      {/* Slot picker sheet */}
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
              Try another {SLOT_TO_CATEGORY[picker].toLowerCase().replace(/s$/, "")}
            </h3>
            {pickerOptions.length === 0 ? (
              <p className="text-xs text-ink/50 italic py-6 text-center">
                No {SLOT_TO_CATEGORY[picker].toLowerCase()} in your closet yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto -mx-2 px-2">
                {pickerOptions.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setOverrides((prev) => ({ ...prev, [picker]: it }));
                      setPicker(null);
                    }}
                    className="text-left active:scale-95 transition"
                  >
                    <div className="aspect-[4/5] bg-card overflow-hidden rounded-sm">
                      <img src={it.image} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
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
    </div>
  );
}
