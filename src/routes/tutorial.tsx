import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Shirt, Sparkles, X, type LucideIcon } from "lucide-react";
import { markTutorialSeen } from "@/lib/vesti/tutorial";

export const Route = createFileRoute("/tutorial")({
  head: () => ({
    meta: [
      { title: "Welcome — Clem" },
      { name: "description", content: "A 60-second tour of how Clem works." },
    ],
  }),
  component: TutorialPage,
});

interface Screen {
  kicker: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

const SCREENS: Screen[] = [
  {
    kicker: "Your closet",
    title: "Snap it. Store it.",
    body: "Add pieces from your wardrobe in seconds. Clem sorts everything into your Closet and lets you group favorites into Collections.",
    icon: Shirt,
  },
  {
    kicker: "Right now",
    title: "A look, on demand",
    body: "Open Looks anytime for an outfit built entirely from what's already in your closet — matched to the weather and the occasion.",
    icon: Sparkles,
  },
  {
    kicker: "Curate smarter",
    title: "Shop with intention",
    body: "Save pieces you're eyeing to Curate, weigh them in Before You Buy, and watch your style take shape in Report.",
    icon: Heart,
  },
];

const TOTAL_STEPS = SCREENS.length;

function TutorialPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const finish = () => {
    markTutorialSeen();
    void navigate({ to: "/" });
  };

  const onBack = () => setStep((s) => Math.max(1, s - 1));
  const onNext = () => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else finish();
  };

  const screen = SCREENS[step - 1];
  const Icon = screen.icon;

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col">
      <header className="px-8 pt-10 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.32em] text-mauve">
            {step} of {TOTAL_STEPS}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Skip tutorial"
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-ink/50 hover:text-ink transition py-2 -mr-2 px-2"
          >
            Skip <X className="size-3" strokeWidth={1.5} />
          </button>
        </div>

        <div className="h-[2px] w-full bg-ink/10 overflow-hidden">
          <div
            className="h-full bg-mauve transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-8 pb-40 max-w-[640px] w-full mx-auto flex flex-col items-center text-center">
        <div key={step} className="pt-10 animate-rise flex flex-col items-center">
          <div className="mb-8 flex size-24 items-center justify-center rounded-full border border-ink/15 bg-mauve/5">
            <Icon className="size-9 text-mauve" strokeWidth={1.25} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-4">{screen.kicker}</p>
          <h1 className="font-serif text-[32px] sm:text-[40px] leading-[1.05] uppercase tracking-[0.04em] text-ink mb-4">
            {screen.title}
          </h1>
          <p className="text-ink/60 text-[15px] leading-relaxed font-serif italic max-w-[420px]">
            {screen.body}
          </p>
        </div>

        <div className="mt-10 flex items-center gap-2">
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === step - 1 ? "bg-mauve" : "bg-ink/15"
              }`}
            />
          ))}
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-cream border-t border-ink/10 px-6 py-5">
        <div className="max-w-[640px] mx-auto flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-ink/70 hover:text-ink transition"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.5} />
              Back
            </button>
          ) : (
            <Link
              to="/"
              onClick={() => markTutorialSeen()}
              className="text-[11px] uppercase tracking-[0.28em] text-ink/70 hover:text-ink transition"
            >
              Skip
            </Link>
          )}
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 bg-mauve text-cream px-8 py-3.5 text-[11px] uppercase tracking-[0.28em] hover:bg-ink transition"
          >
            {step === TOTAL_STEPS ? "Get started" : "Next"}
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </footer>
    </div>
  );
}
