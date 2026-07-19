import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { EMPTY_PROFILE, profileStore, useProfile, type BodyShape, type SkinTone, type UserProfile } from "@/lib/vesti/profile";
import { FitModel, FitModelStage, SHAPE_OPTIONS, SKIN_TONES } from "@/components/vesti/FitModel";
import { getApiUrl } from "@/lib/api-base";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Clem" },
      { name: "description", content: "Build your style profile in seven quick steps." },
    ],
  }),
  component: OnboardingPage,
});

const STYLE_IDENTITIES = [
  { title: "Classic & timeless", desc: "Tailoring, neutrals, and pieces that last." },
  { title: "Romantic & feminine", desc: "Soft fabrics, florals, delicate detail." },
  { title: "Minimalist", desc: "Clean lines, restrained palette, no fuss." },
  { title: "Bohemian", desc: "Free-spirited, layered, texture-rich." },
  { title: "Editorial & bold", desc: "Statement silhouettes and confident colour." },
  { title: "Casual chic", desc: "Elevated everyday — denim done right." },
];

const BRANDS = [
  "Sézane", "Dôen", "Reformation", "Totême", "& Other Stories",
  "Anthropologie", "Madewell", "Veronica Beard", "Zimmermann", "Aritzia",
  "Ulla Johnson", "Club Monaco", "Banana Republic", "Nordstrom", "Revolve", "Other",
];

const BRAND_SUGGESTIONS = [
  "Acne Studios", "Agolde", "Alex Mill", "AllSaints", "Alo Yoga", "APC", "Arc'teryx",
  "Babaà", "Bode", "Boden", "Brandy Melville", "Brunello Cucinelli", "Burberry",
  "Celine", "Chloé", "Citizens of Humanity", "Coach", "COS", "Cuyana",
  "Diesel", "Everlane", "Faherty", "Farm Rio", "Frame", "Free People",
  "Ganni", "Gap", "H&M", "Hill House Home", "J.Crew", "Jacquemus",
  "Khaite", "La DoubleJ", "Levi's", "Loewe", "Lululemon", "Mango",
  "Mara Hoffman", "Marine Serre", "Massimo Dutti", "Mejuri", "Miu Miu",
  "Nanushka", "Nili Lotan", "Outdoor Voices", "Paloma Wool", "Patagonia",
  "Polène", "Prada", "Princess Polly", "Proenza Schouler", "Quince",
  "Rachel Comey", "Ralph Lauren", "Rouje", "Saks Potts", "Self-Portrait",
  "Skims", "Staud", "Stine Goya", "The Frankie Shop", "The Row", "Theory",
  "Tibi", "Tory Burch", "Vince", "Vuori", "Wilfred", "Zara",
];


const CONFIDENCES = [
  "I know exactly what works for me",
  "I have a sense of my style but want more variety",
  "I'm still figuring it out",
  "I dress for the occasion not a style",
];

const OCCASIONS = ["Work", "Weekends", "Events & going out", "Travel"];

const BOLDNESS_LABELS = ["Classic, always", "Mostly classic", "Balanced", "A little bold", "Anything goes"];

const COLORS = [
  "Neutrals", "Earth tones", "Black & white", "Blush & rose", "Deep jewel tones",
  "Navy & cobalt", "Warm reds", "Olive & sage", "All of the above", "I avoid colour",
];

const SHOPPING_HABITS = ["Mostly online", "Mostly in-store", "Both equally", "Mostly secondhand"];
const BUDGETS = ["Under $50", "$50–$150", "$150–$400", "$400+", "Depends on the occasion"];

const TOTAL_STEPS = 8;

function OnboardingPage() {
  const navigate = useNavigate();
  const { profile: saved } = useProfile();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<UserProfile>(saved.completedAt ? saved : EMPTY_PROFILE);

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggleMulti = (key: keyof UserProfile, value: string) => {
    setData((d) => {
      const arr = (d[key] as string[]) ?? [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...d, [key]: next } as UserProfile;
    });
  };

  const canContinue = (() => {
    switch (step) {
      case 1: return data.styleIdentities.length > 0;
      case 2: return data.brands.length > 0;
      case 3: return data.confidence !== "";
      case 4: return data.occasions.length > 0;
      case 5: return data.height.trim() !== "" && data.topSize.trim() !== "" && data.bottomSize.trim() !== "" && data.shoeSize.trim() !== "";
      case 6: return data.bodyShape !== "" && data.skinTone !== "";
      case 7: return data.colors.length > 0;
      case 8: return data.shoppingHabits.length > 0 && data.budget.length > 0;
      default: return true;
    }
  })();

  const onBack = () => {
    if (step === 1) navigate({ to: "/" });
    else setStep((s) => s - 1);
  };

  const onContinue = () => {
    profileStore.save(data);
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else setStep(TOTAL_STEPS + 1); // summary
  };

  const onFinish = () => {
    profileStore.complete(data);
    navigate({ to: "/" });
  };

  const progress = Math.min(step, TOTAL_STEPS) / TOTAL_STEPS;

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col">
      {/* Progress */}
      <header className="px-8 pt-10 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.32em] text-mauve">
            {step <= TOTAL_STEPS ? `Step ${step} of ${TOTAL_STEPS}` : "Complete"}
          </p>
          <Link
            to="/"
            aria-label="Exit onboarding"
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-ink/50 hover:text-ink transition py-2 -mr-2 px-2"
          >
            Skip <X className="size-3" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="h-[2px] w-full bg-ink/10 overflow-hidden">
          <div
            className="h-full bg-mauve transition-all duration-500"
            style={{ width: `${(step > TOTAL_STEPS ? 1 : progress) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-8 pb-40 max-w-[640px] w-full mx-auto">
        {step === 1 && (
          <Step
            kicker="Style identity"
            title="How do you like to dress?"
            sub="Pick everything that resonates — multi-select."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STYLE_IDENTITIES.map((s) => {
                const active = data.styleIdentities.includes(s.title);
                return (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => toggleMulti("styleIdentities", s.title)}
                    className={`text-left p-5 border transition ${
                      active
                        ? "border-mauve bg-mauve/5"
                        : "border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-serif uppercase tracking-[0.06em] text-[15px] text-ink">{s.title}</p>
                      {active && <Check className="size-4 text-mauve shrink-0 mt-1" strokeWidth={1.5} />}
                    </div>
                    <p className="text-[12px] text-ink/60 mt-2 leading-snug">{s.desc}</p>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step
            kicker="Favourite brands"
            title="Whose pieces do you reach for?"
            sub="Tap as many as you like."
          >
            <Pills options={BRANDS} selected={data.brands} onToggle={(v) => toggleMulti("brands", v)} />
            {data.brands.includes("Other") && (
              <OtherBrandsInput
                customBrands={data.brands.filter((b) => !BRANDS.includes(b))}
                onAdd={(name) => {
                  if (!data.brands.includes(name)) {
                    update("brands", [...data.brands, name]);
                  }
                }}
                onRemove={(name) =>
                  update("brands", data.brands.filter((b) => b !== name))
                }
              />
            )}
          </Step>
        )}

        {step === 3 && (
          <Step
            kicker="Style confidence"
            title="Which one sounds like you?"
            sub="Pick one."
          >
            <div className="flex flex-col gap-3">
              {CONFIDENCES.map((c) => {
                const active = data.confidence === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update("confidence", c)}
                    className={`text-left p-5 border transition ${
                      active ? "border-mauve bg-mauve/5" : "border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-serif text-[16px] text-ink leading-snug">{c}</p>
                      {active && <Check className="size-4 text-mauve shrink-0" strokeWidth={1.5} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step
            kicker="Boldness"
            title="How adventurous is your wardrobe?"
            sub="Slide to set, then pick the occasions you dress for."
          >
            <div className="mb-12">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-ink/50 mb-3">
                <span>Classic, always</span>
                <span>Anything goes</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={data.boldness}
                onChange={(e) => update("boldness", Number(e.target.value))}
                className="w-full accent-[#6B3A4A]"
              />
              <p className="mt-4 font-serif text-[20px] uppercase tracking-[0.06em] text-mauve">
                {BOLDNESS_LABELS[data.boldness - 1]}
              </p>
            </div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">Occasions</p>
            <div className="grid grid-cols-2 gap-3">
              {OCCASIONS.map((o) => {
                const active = data.occasions.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleMulti("occasions", o)}
                    className={`p-5 border text-left transition ${
                      active ? "border-mauve bg-mauve/5" : "border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-serif text-[15px] uppercase tracking-[0.05em]">{o}</p>
                      {active && <Check className="size-4 text-mauve" strokeWidth={1.5} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step
            kicker="Measurements"
            title="Help us get the fit right."
            sub="Used to filter suggestions — never shared."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <TextField label="Height" value={data.height} onChange={(v) => update("height", v)} placeholder="e.g. 5'6&quot;" />
              <TextField label="Weight (optional)" value={data.weight} onChange={(v) => update("weight", v)} placeholder="e.g. 140 lb" />
              <TextField label="Top size" value={data.topSize} onChange={(v) => update("topSize", v)} placeholder="e.g. M" />
              <TextField label="Bottom size" value={data.bottomSize} onChange={(v) => update("bottomSize", v)} placeholder="e.g. 28" />
              <TextField label="Shoe size" value={data.shoeSize} onChange={(v) => update("shoeSize", v)} placeholder="e.g. 8" />
            </div>
          </Step>
        )}

        {step === 6 && (
          <Step
            kicker="Your Fit Model"
            title="Meet a figure that looks like you."
            sub="It updates as you tell us more — and shows up across the app when Clem styles a look."
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 items-start">
              <FitModelStage className="py-4">
                <FitModel
                  height={data.height}
                  weight={data.weight}
                  shape={data.bodyShape}
                  skinTone={(data.skinTone || "light") as SkinTone}
                  bare
                />
              </FitModelStage>
              <div className="space-y-7">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">
                    How would you describe your body shape?
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SHAPE_OPTIONS.map((s) => {
                      const active = data.bodyShape === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => update("bodyShape", s.id as BodyShape)}
                          className={`text-left p-3 border rounded-sm transition ${
                            active ? "border-mauve bg-mauve/5" : "border-ink/15 hover:border-ink/40"
                          }`}
                        >
                          <p className="font-serif text-[14px] uppercase tracking-[0.06em] text-ink">{s.label}</p>
                          <p className="text-[11px] text-ink/55 mt-1 leading-snug">{s.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">Skin tone</p>
                  <div className="flex flex-wrap gap-2.5">
                    {SKIN_TONES.map((t) => {
                      const active = data.skinTone === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-label={t.label}
                          onClick={() => update("skinTone", t.id as SkinTone)}
                          className={`relative size-9 rounded-full border-2 transition ${
                            active ? "border-mauve scale-110" : "border-ink/15 hover:border-ink/40"
                          }`}
                          style={{ backgroundColor: t.hex }}
                        >
                          {active && (
                            <Check className="absolute inset-0 m-auto size-4 text-cream drop-shadow" strokeWidth={2.5} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Step>
        )}

        {step === 7 && (
          <Step
            kicker="Colour palette"
            title="Which palettes feel like you?"
            sub="Multi-select. Anything to avoid below."
          >
            <Pills options={COLORS} selected={data.colors} onToggle={(v) => toggleMulti("colors", v)} />
            <ColorAnalysis
              onApply={(palettes) => {
                const merged = Array.from(new Set([...data.colors, ...palettes]));
                update("colors", merged);
              }}
            />
            <div className="mt-10">
              <label className="block text-[10px] uppercase tracking-[0.28em] text-mauve mb-2">
                Anything you never wear?
              </label>
              <textarea
                value={data.avoidColors}
                onChange={(e) => update("avoidColors", e.target.value)}
                rows={3}
                placeholder="e.g. neon, mustard, anything pastel"
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-2 text-ink font-serif text-[16px] placeholder:text-ink/30 resize-none"
              />
            </div>
          </Step>
        )}

        {step === 8 && (
          <Step
            kicker="Final touches"
            title="A few last things."
            sub="Helps us tailor the suggestions."
          >
            <div className="space-y-8">
              <TextArea
                label="What's your biggest style frustration? (optional)"
                value={data.frustration}
                onChange={(v) => update("frustration", v)}
                placeholder="e.g. nothing matches my new trousers"
              />
              <div>
                <label className="block text-[10px] uppercase tracking-[0.28em] text-mauve mb-2">
                  Favourite fashion icons & influencers (optional)
                </label>
                <p className="text-[12px] text-ink/60 mb-3 font-serif italic">
                  Designers, editors, celebs, TikTokers — anyone whose looks you save. We'll scan their style to sharpen Clem's suggestions.
                </p>
                <IconsInput
                  values={data.inspiration}
                  onAdd={(name) => {
                    if (!data.inspiration.includes(name)) {
                      update("inspiration", [...data.inspiration, name]);
                    }
                  }}
                  onRemove={(name) =>
                    update("inspiration", data.inspiration.filter((v) => v !== name))
                  }
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">Shopping habits</p>
                <Pills
                  options={SHOPPING_HABITS}
                  selected={data.shoppingHabits}
                  onToggle={(v) => toggleMulti("shoppingHabits", v)}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">Budget per piece</p>
                <Pills
                  options={BUDGETS}
                  selected={data.budget}
                  onToggle={(v) => toggleMulti("budget", v)}
                />
              </div>
            </div>
          </Step>
        )}

        {step > TOTAL_STEPS && (
          <section className="pt-10 animate-rise">
            <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">Meet your fit model</p>
            <h1 className="font-serif text-[44px] leading-[1.02] uppercase tracking-[0.04em] text-ink mb-8">
              She's ready
              <br />when you are.
            </h1>
            <div className="grid grid-cols-[1fr_1.1fr] gap-6 items-start mb-10">
              <FitModelStage className="py-3">
                <FitModel
                  height={data.height}
                  weight={data.weight}
                  shape={data.bodyShape}
                  skinTone={(data.skinTone || "light") as SkinTone}
                  bare
                />
              </FitModelStage>
              <p className="text-ink/70 font-serif text-[15px] leading-relaxed pt-2">
                Your fit model will wear every look Clem suggests — so you can see the
                cut, length, and silhouette on your proportions before you ever try a
                piece on. Update her any time from your profile.
              </p>
            </div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-3">Your style file</p>
            <SummaryList data={data} />
            <button
              type="button"
              onClick={onFinish}
              className="mt-12 w-full bg-ink text-cream py-5 font-serif text-[14px] uppercase tracking-[0.28em] hover:bg-mauve transition"
            >
              Start building your closet
            </button>
          </section>
        )}
      </main>

      {step <= TOTAL_STEPS && (
        <footer className="fixed bottom-0 inset-x-0 bg-cream border-t border-ink/10 px-6 py-5">
          <div className="max-w-[640px] mx-auto flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-ink/70 hover:text-ink transition"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.5} />
              Back
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!canContinue}
              className="inline-flex items-center gap-2 bg-mauve text-cream px-8 py-3.5 text-[11px] uppercase tracking-[0.28em] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink transition"
            >
              {step === TOTAL_STEPS ? "Review" : "Continue"}
              <ArrowRight className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function Step({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-6 animate-rise">
      <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-4">{kicker}</p>
      <h1 className="font-serif text-[32px] sm:text-[40px] leading-[1.05] uppercase tracking-[0.04em] text-ink mb-3">
        {title}
      </h1>
      {sub && <p className="text-ink/60 text-[14px] mb-8 font-serif italic">{sub}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Pills({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`px-4 py-2 text-[12px] tracking-[0.04em] border rounded-full transition ${
              active
                ? "bg-mauve text-cream border-mauve"
                : "border-ink/20 text-ink/80 hover:border-ink/50"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.28em] text-mauve mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-2 text-ink font-serif text-[16px] placeholder:text-ink/30"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.28em] text-mauve mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-2 text-ink font-serif text-[16px] placeholder:text-ink/30 resize-none"
      />
    </div>
  );
}

function SummaryList({ data }: { data: UserProfile }) {
  const rows: { label: string; value: string }[] = [
    { label: "Style", value: data.styleIdentities.join(", ") || "—" },
    { label: "Brands", value: data.brands.join(", ") || "—" },
    { label: "Confidence", value: data.confidence || "—" },
    { label: "Boldness", value: BOLDNESS_LABELS[data.boldness - 1] },
    { label: "Occasions", value: data.occasions.join(", ") || "—" },
    {
      label: "Fit",
      value: [data.height, data.topSize && `Top ${data.topSize}`, data.bottomSize && `Bottom ${data.bottomSize}`, data.shoeSize && `Shoe ${data.shoeSize}`]
        .filter(Boolean)
        .join(" · ") || "—",
    },
    { label: "Palette", value: data.colors.join(", ") || "—" },
    { label: "Avoids", value: data.avoidColors || "—" },
    { label: "Shopping", value: data.shoppingHabits.join(", ") || "—" },
    { label: "Budget", value: data.budget.join(", ") || "—" },
  ];
  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {rows.map((r) => (
        <li key={r.label} className="py-4 grid grid-cols-[110px_1fr] gap-4">
          <span className="text-[10px] uppercase tracking-[0.28em] text-mauve pt-1">{r.label}</span>
          <span className="font-serif text-[15px] text-ink leading-snug">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function OtherBrandsInput({
  customBrands,
  onAdd,
  onRemove,
}: {
  customBrands: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const suggestions = q
    ? BRAND_SUGGESTIONS.filter(
        (b) => b.toLowerCase().includes(q) && !customBrands.includes(b),
      ).slice(0, 6)
    : [];

  const commit = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    onAdd(clean);
    setQuery("");
  };

  return (
    <div className="mt-6 border-t border-ink/10 pt-6">
      <label className="block text-[10px] uppercase tracking-[0.28em] text-mauve mb-2">
        Add your own
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(suggestions[0] ?? query);
          }
        }}
        placeholder="Start typing a brand…"
        className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-2 text-ink font-serif text-[16px] placeholder:text-ink/30"
      />
      {suggestions.length > 0 && (
        <ul className="mt-2 border border-ink/10 bg-cream divide-y divide-ink/10">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => commit(s)}
                className="w-full text-left px-4 py-2.5 text-[14px] text-ink hover:bg-mauve/10 transition"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && suggestions.length === 0 && (
        <button
          type="button"
          onClick={() => commit(query)}
          className="mt-2 text-[11px] uppercase tracking-[0.24em] text-mauve hover:text-ink transition"
        >
          + Add "{query.trim()}"
        </button>
      )}
      {customBrands.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {customBrands.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] bg-mauve text-cream rounded-full"
            >
              {b}
              <button
                type="button"
                onClick={() => onRemove(b)}
                className="text-cream/70 hover:text-cream"
                aria-label={`Remove ${b}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorAnalysis({ onApply }: { onApply: (palettes: string[]) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    season: string | null;
    undertone: string | null;
    palettes: string[];
    rationale: string;
  } | null>(null);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Image must be under 6MB.");
      return;
    }
    try {
      const dataUrl = await readFile(file);
      setPreview(dataUrl);
      setLoading(true);
      const res = await fetch(getApiUrl("/api/color-analysis"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Analysis failed");
      }
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-ink/10 pt-6">
      <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-1">
        Not sure? Get a colour analysis
      </p>
      <p className="text-[12px] text-ink/60 mb-4 font-serif italic">
        Upload a clear, well-lit photo of your face. We'll suggest palettes that flatter you.
      </p>

      <label className="inline-block cursor-pointer border border-ink/30 px-5 py-2.5 text-[11px] uppercase tracking-[0.24em] text-ink hover:border-mauve hover:text-mauve transition">
        {preview ? "Use a different photo" : "Upload photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {preview && (
        <div className="mt-5 flex items-start gap-4">
          <img
            src={preview}
            alt="Uploaded preview"
            className="w-20 h-20 object-cover border border-ink/15"
          />
          {loading && (
            <p className="text-[12px] text-ink/60 font-serif italic pt-2">
              Reading your colours…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-[12px] text-mauve">{error}</p>
      )}

      {result && (
        <div className="mt-5 p-5 border border-mauve/30 bg-mauve/5">
          <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
            {result.season && (
              <p className="text-[10px] uppercase tracking-[0.28em] text-mauve">
                Season · <span className="text-ink">{result.season}</span>
              </p>
            )}
            {result.undertone && (
              <p className="text-[10px] uppercase tracking-[0.28em] text-mauve">
                Undertone · <span className="text-ink">{result.undertone}</span>
              </p>
            )}
          </div>
          {result.rationale && (
            <p className="text-[13px] text-ink/75 font-serif italic mb-4 leading-snug">
              {result.rationale}
            </p>
          )}
          {result.palettes.length > 0 ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.28em] text-mauve mb-2">
                Recommended palettes
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {result.palettes.map((p) => (
                  <span
                    key={p}
                    className="px-3 py-1.5 text-[12px] bg-cream border border-mauve text-ink rounded-full"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onApply(result.palettes)}
                className="bg-mauve text-cream px-5 py-2.5 text-[11px] uppercase tracking-[0.24em] hover:bg-ink transition"
              >
                Add to my palette
              </button>
            </>
          ) : (
            <p className="text-[12px] text-ink/60">
              Couldn't confidently pick palettes — try a clearer photo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const ICON_SUGGESTIONS = [
  "Carolyn Bessette-Kennedy", "Jane Birkin", "Audrey Hepburn", "Sofia Richie Grainge",
  "Hailey Bieber", "Zendaya", "Bella Hadid", "Gigi Hadid", "Kendall Jenner",
  "Rihanna", "Alexa Chung", "Kate Moss", "Diana, Princess of Wales",
  "Olivia Palermo", "Phoebe Philo", "Rosie Huntington-Whiteley", "Tilda Swinton",
  "Solange Knowles", "Tracee Ellis Ross", "Iris Apfel", "Sarah Jessica Parker",
  "Matilda Djerf", "Tamu McPherson", "Leandra Medine", "Camille Charrière",
  "Pernille Teisbaek", "Emili Sindlev", "Linda Tol", "Reese Blutstein",
  "Devon Lee Carlson", "Emma Chamberlain", "Wisdom Kaye", "Tinx",
  "Brittany Xavier", "Aimee Song", "Chriselle Lim", "Negin Mirsalehi",
  "Lily Collins", "Anya Taylor-Joy", "Dua Lipa", "Taylor Swift",
  "Harry Styles", "Timothée Chalamet", "A$AP Rocky", "Tyler, the Creator",
];

function IconsInput({
  values,
  onAdd,
  onRemove,
}: {
  values: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const suggestions = q
    ? ICON_SUGGESTIONS.filter(
        (n) => n.toLowerCase().includes(q) && !values.includes(n),
      ).slice(0, 6)
    : [];

  const commit = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    onAdd(clean);
    setQuery("");
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(suggestions[0] ?? query);
          }
        }}
        placeholder="Start typing a name…"
        className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-2 text-ink font-serif text-[16px] placeholder:text-ink/30"
      />
      {suggestions.length > 0 && (
        <ul className="mt-2 border border-ink/10 bg-cream divide-y divide-ink/10">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => commit(s)}
                className="w-full text-left px-4 py-2.5 text-[14px] text-ink hover:bg-mauve/10 transition"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && suggestions.length === 0 && (
        <button
          type="button"
          onClick={() => commit(query)}
          className="mt-2 text-[11px] uppercase tracking-[0.24em] text-mauve hover:text-ink transition"
        >
          + Add "{query.trim()}"
        </button>
      )}
      {values.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] bg-mauve text-cream rounded-full"
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(v)}
                className="text-cream/70 hover:text-cream"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
