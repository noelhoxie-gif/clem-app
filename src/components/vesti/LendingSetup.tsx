import { useMemo, useState } from "react";
import { X, Check, Sparkles } from "lucide-react";
import { useCloset, itemStatus, type Item } from "@/lib/vesti/store";

type Step = 1 | 2 | 3 | 4;

const LENDING_CATEGORIES = ["Dresses", "Tops", "Bags", "Shoes", "Outerwear"] as const;
type LendingCategory = (typeof LENDING_CATEGORIES)[number];

const PRIVACY = ["Full Inner Circle", "Select Groups", "Specific People Only", "One-Time Link"];

function matchesLending(item: Item, cat: LendingCategory): boolean {
  if (itemStatus(item) !== "active") return false;
  const name = item.name.toLowerCase();
  const isDressLike = /dress|slip|sundress/.test(name);
  switch (cat) {
    case "Dresses":
      return item.category === "Tops" && isDressLike;
    case "Tops":
      return item.category === "Tops" && !isDressLike;
    case "Bags":
      return item.category === "Accessories" && /bag/.test(name);
    case "Shoes":
      return item.category === "Shoes";
    case "Outerwear":
      return item.category === "Outerwear";
  }
}

export function LendingSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items } = useCloset();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<LendingCategory>("Dresses");
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [price, setPrice] = useState("15");
  const [unit, setUnit] = useState("weekend");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => items.filter((i) => matchesLending(i, category)), [items, category]);
  const includedItems = filtered.filter((i) => !excluded[i.id]);

  if (!open) return null;

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setCategory("Dresses");
      setExcluded({});
      setPrice("15");
      setUnit("weekend");
      setOverrides({});
      setEditingId(null);
    }, 300);
  };

  const progress = (step / 4) * 100;

  const onSelectCategory = (c: LendingCategory) => {
    setCategory(c);
    setExcluded({});
    setOverrides({});
  };

  return (
    <div className="fixed inset-0 z-50 bg-cream text-ink overflow-y-auto animate-rise">
      <div className="sticky top-0 bg-cream/95 backdrop-blur-sm border-b border-ink/10 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-[10px] uppercase tracking-[0.32em] text-ink/55">
            {step === 4 ? "Confirmed" : `Step ${step} of 4 · The Lending Closet`}
          </p>
          <button type="button" onClick={close} aria-label="Close" className="text-ink/60 hover:text-ink transition">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="h-[2px] bg-ink/[0.08]">
          <div className="h-full bg-mauve transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-12 pb-32">
        {step === 1 && (
          <div className="space-y-10 animate-rise">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">Begin somewhere</p>
              <h2 className="font-serif italic text-[36px] leading-[1.05] tracking-[0.02em]">
                Which category would you like to start with?
              </h2>
              <p className="font-serif italic text-sm text-ink/55 mt-4 leading-relaxed">
                Start with one. Add the rest when you're ready.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {LENDING_CATEGORIES.map((c) => {
                const active = category === c;
                const recommended = c === "Dresses";
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onSelectCategory(c)}
                    className={`flex items-center justify-between text-left p-5 rounded-sm border transition ${
                      active ? "bg-mauve text-cream border-mauve" : "bg-transparent text-ink border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <span className="font-serif text-xl tracking-[0.02em]">{c}</span>
                    {recommended && (
                      <span className={`inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.28em] ${active ? "text-cream/85" : "text-mauve"}`}>
                        <Sparkles className="size-3" strokeWidth={1.5} />
                        Recommended
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <Nav onNext={() => setStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-rise">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">Your {category.toLowerCase()}</p>
              <h2 className="font-serif italic text-[30px] leading-[1.1] tracking-[0.02em]">
                All your {category.toLowerCase()} are available to lend.
              </h2>
              <p className="text-sm text-ink/65 mt-4 font-light leading-relaxed">
                Tap to exclude any you'd rather keep to yourself.
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="font-serif italic text-ink/55 text-base">
                You haven't added any {category.toLowerCase()} yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((i) => {
                  const isExcluded = !!excluded[i.id];
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setExcluded((e) => ({ ...e, [i.id]: !e[i.id] }))}
                      className="relative text-left rounded-sm overflow-hidden border border-taupe/40 bg-mint-soft"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <img
                          src={i.image}
                          alt={i.name}
                          className={`w-full h-full object-cover transition ${isExcluded ? "opacity-30 grayscale" : ""}`}
                        />
                        <div
                          className={`absolute top-2 right-2 size-7 rounded-full flex items-center justify-center border transition ${
                            isExcluded
                              ? "bg-cream/90 border-ink/20 text-ink/40"
                              : "bg-mauve border-mauve text-cream"
                          }`}
                        >
                          <Check className="size-3.5" strokeWidth={2} />
                        </div>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-ink/55 truncate">{i.brand}</p>
                        <p className="font-serif text-sm text-ink leading-tight truncate">{i.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="font-serif italic text-xs text-ink/55">
              {includedItems.length} of {filtered.length} included
            </p>

            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={includedItems.length === 0} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-rise">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">Set the terms</p>
              <h2 className="font-serif italic text-[30px] leading-[1.1] tracking-[0.02em]">
                One price for the whole category.
              </h2>
              <p className="text-sm text-ink/65 mt-4 font-light leading-relaxed">
                Tap into any piece below to override its price individually.
              </p>
            </div>

            <div className="border border-taupe/40 rounded-sm p-6 bg-mint-soft">
              <p className="text-[10px] uppercase tracking-[0.28em] text-ink/55 mb-4">Base price</p>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[40px] text-ink leading-none">$</span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-24 bg-transparent border-b border-ink/30 focus:border-mauve outline-none font-serif text-[40px] text-ink leading-none"
                />
                <span className="font-serif italic text-ink/55 text-lg">/</span>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bg-transparent border-b border-ink/30 focus:border-mauve outline-none font-serif italic text-lg text-ink/75 py-1"
                >
                  <option value="weekend">weekend</option>
                  <option value="week">week</option>
                  <option value="day">day</option>
                  <option value="event">event</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.28em] text-ink/55 mb-3">Individual overrides</p>
              {includedItems.map((i) => {
                const isEditing = editingId === i.id;
                const override = overrides[i.id];
                return (
                  <div
                    key={i.id}
                    className="flex items-center gap-3 border-b border-taupe/30 py-3"
                  >
                    <img src={i.image} alt="" className="size-12 rounded-sm object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50 truncate">{i.brand}</p>
                      <p className="font-serif text-sm text-ink truncate">{i.name}</p>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-ink/60">$</span>
                        <input
                          type="number"
                          autoFocus
                          value={override ?? price}
                          onChange={(e) => setOverrides((o) => ({ ...o, [i.id]: e.target.value }))}
                          onBlur={() => setEditingId(null)}
                          className="w-16 bg-transparent border-b border-mauve outline-none font-serif text-base text-ink text-right"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingId(i.id)}
                        className="font-serif text-base text-ink/85"
                      >
                        ${override ?? price}
                        <span className="text-ink/45 text-xs italic ml-1">/{unit}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Confirm" nextDisabled={!price} />
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-12 animate-rise">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-mauve text-cream mb-10">
              <Check className="size-5" strokeWidth={1.5} />
            </div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">The Lending Closet</p>
            <h2 className="font-serif italic text-[44px] leading-[1.02] tracking-[0.02em] mb-6">
              {includedItems.length} {includedItems.length === 1 ? "piece is" : "pieces are"} now available to lend.
            </h2>
            <p className="text-base text-ink/70 leading-relaxed font-light max-w-[34ch] mx-auto mb-12">
              You can adjust your privacy settings anytime — choose who in your circle gets to borrow.
            </p>

            <div className="text-left bg-mint-soft border border-taupe/40 rounded-sm p-6 mb-10">
              <p className="text-[10px] uppercase tracking-[0.28em] text-ink/55 mb-4">Privacy settings</p>
              <ul className="space-y-3">
                {PRIVACY.map((p, idx) => (
                  <li key={p} className="flex items-start gap-3">
                    <span className={`mt-1 size-2 rounded-full ${idx === 0 ? "bg-mauve" : "bg-ink/20"}`} />
                    <div>
                      <p className="font-serif text-base text-ink">{p}</p>
                      {idx === 0 && <p className="text-[10px] uppercase tracking-[0.22em] text-mauve mt-0.5">Default</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={close}
              className="border border-ink/30 text-ink text-[11px] uppercase tracking-[0.28em] px-8 py-4 rounded-sm hover:bg-ink hover:text-cream transition"
            >
              Back to my closet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-[10px] uppercase tracking-[0.28em] text-ink/55 hover:text-ink transition border-b border-ink/30 pb-1"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 bg-mauve text-cream text-[11px] uppercase tracking-[0.28em] py-4 rounded-sm hover:bg-mauve/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  );
}
