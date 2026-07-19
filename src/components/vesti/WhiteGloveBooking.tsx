import { useState } from "react";
import { X, Check } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

const CITIES = ["New York", "Los Angeles", "Miami", "Dallas", "Chicago"];
const TIME_WINDOWS = ["Morning (9am–12pm)", "Afternoon (12pm–3pm)", "Late afternoon (3pm–6pm)"];
const SIZES = ["Under 50 pieces", "50–100 pieces", "100–200 pieces", "200+ pieces"];
const STORAGE = ["Everything is hung", "Mostly folded", "Mix of both", "It's everywhere — no judgment"];
const SPACE = ["I have great natural light", "I'll need the stylist to find a spot", "Not sure yet"];
const STYLIST = ["Women only", "No preference"];
const REFERRAL = ["Friend or family", "Social media", "Google", "Press or article", "Other"];

interface State {
  city: string;
  address: string;
  dates: string[];
  timeWindow: string;
  size: string;
  specialItems: string;
  storage: string;
  excluded: string;
  space: string;
  fullName: string;
  phone: string;
  email: string;
  stylistPref: string;
  notes: string;
  referral: string;
}

const initial: State = {
  city: "", address: "", dates: [], timeWindow: "",
  size: "", specialItems: "", storage: "", excluded: "", space: "",
  fullName: "", phone: "", email: "", stylistPref: "", notes: "", referral: "",
};

export function WhiteGloveBooking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [s, setS] = useState<State>(initial);

  if (!open) return null;

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  const toggleDate = (d: string) => {
    setS((p) => {
      if (p.dates.includes(d)) return { ...p, dates: p.dates.filter((x) => x !== d) };
      if (p.dates.length >= 3) return p;
      return { ...p, dates: [...p.dates, d] };
    });
  };

  const close = () => {
    onClose();
    setTimeout(() => { setStep(1); setS(initial); }, 300);
  };

  const progress = step === 5 ? 100 : (step / 4) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-cream text-ink overflow-y-auto animate-rise">
      {/* Top bar */}
      <div className="sticky top-0 bg-cream/95 backdrop-blur-sm border-b border-ink/10 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-[10px] uppercase tracking-[0.32em] text-ink/55">
            {step === 5 ? "Confirmed" : `Step ${step} of 4`}
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
            <h2 className="font-serif italic text-[36px] leading-[1.05] tracking-[0.02em]">Where are you located?</h2>

            <Field label="City">
              <Pills options={CITIES} value={s.city} onChange={(v) => set("city", v)} />
            </Field>

            <Field label="Full address">
              <input
                type="text"
                value={s.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Street, apt, city, ZIP"
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 transition"
              />
            </Field>

            <Field label="Preferred dates (choose 2–3)">
              <input
                type="date"
                onChange={(e) => { if (e.target.value) { toggleDate(e.target.value); e.target.value = ""; } }}
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink"
              />
              {s.dates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {s.dates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDate(d)}
                      className="inline-flex items-center gap-2 text-xs bg-mauve text-cream px-3 py-1.5 rounded-full"
                    >
                      {new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      <X className="size-3" strokeWidth={2} />
                    </button>
                  ))}
                </div>
              )}
              <p className="font-serif italic text-xs text-ink/55 mt-4 leading-relaxed">
                We'll confirm within 24 hours. Your first choice isn't guaranteed — we're a small team and we want to make sure we give you our full attention.
              </p>
            </Field>

            <Field label="Preferred time window">
              <Pills options={TIME_WINDOWS} value={s.timeWindow} onChange={(v) => set("timeWindow", v)} />
            </Field>

            <Nav onNext={() => setStep(2)} nextDisabled={!s.city || !s.address || s.dates.length === 0 || !s.timeWindow} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-10 animate-rise">
            <div>
              <h2 className="font-serif italic text-[36px] leading-[1.05] tracking-[0.02em]">How much are we working with?</h2>
              <p className="text-sm text-ink/65 mt-4 font-light leading-relaxed">
                This helps us plan the right amount of time for your appointment.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SIZES.map((opt) => {
                const active = s.size === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set("size", opt)}
                    className={`text-left p-5 rounded-sm border transition ${
                      active ? "bg-mauve text-cream border-mauve" : "bg-transparent text-ink border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <span className="font-serif text-lg tracking-[0.02em]">{opt}</span>
                  </button>
                );
              })}
            </div>

            {s.size === "200+ pieces" && (
              <p className="font-serif italic text-sm text-ink/55 leading-relaxed">
                We'll reach out to confirm timing before your appointment.
              </p>
            )}

            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!s.size} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10 animate-rise">
            <div>
              <h2 className="font-serif italic text-[36px] leading-[1.05] tracking-[0.02em]">Tell us what we're walking into.</h2>
              <p className="text-sm text-ink/65 mt-4 font-light leading-relaxed">
                The more you share, the better prepared your stylist will be.
              </p>
            </div>

            <Field label="Any special items we should know about?">
              <textarea
                rows={3}
                value={s.specialItems}
                onChange={(e) => set("specialItems", e.target.value)}
                placeholder="e.g. vintage pieces, designer items, delicate fabrics"
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 resize-none transition"
              />
            </Field>

            <Field label="How is everything stored?">
              <Pills options={STORAGE} value={s.storage} onChange={(v) => set("storage", v)} />
            </Field>

            <Field label="Anything you'd like excluded?">
              <textarea
                rows={2}
                value={s.excluded}
                onChange={(e) => set("excluded", e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 resize-none transition"
              />
            </Field>

            <Field label="Space & lighting">
              <Pills options={SPACE} value={s.space} onChange={(v) => set("space", v)} />
            </Field>

            <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!s.storage || !s.space} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-10 animate-rise">
            <h2 className="font-serif italic text-[36px] leading-[1.05] tracking-[0.02em]">Almost done.</h2>

            <Field label="Full name">
              <input type="text" value={s.fullName} onChange={(e) => set("fullName", e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 transition" />
            </Field>
            <Field label="Phone number">
              <input type="tel" value={s.phone} onChange={(e) => set("phone", e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 transition" />
            </Field>
            <Field label="Email">
              <input type="email" value={s.email} onChange={(e) => set("email", e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 transition" />
            </Field>

            <Field label="Stylist preference (optional)">
              <Pills options={STYLIST} value={s.stylistPref} onChange={(v) => set("stylistPref", v)} />
            </Field>

            <Field label="Any final notes or special requests?">
              <textarea rows={3} value={s.notes} onChange={(e) => set("notes", e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-mauve outline-none py-3 text-base text-ink placeholder:text-ink/30 resize-none transition" />
            </Field>

            <Field label="How did you hear about us?">
              <Pills options={REFERRAL} value={s.referral} onChange={(v) => set("referral", v)} />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={() => setStep(3)}
                className="text-[10px] uppercase tracking-[0.28em] text-ink/55 hover:text-ink transition border-b border-ink/30 pb-1">
                Back
              </button>
              <button
                type="button"
                disabled={!s.fullName || !s.phone || !s.email}
                onClick={() => setStep(5)}
                className="flex-1 bg-mauve text-cream text-[11px] uppercase tracking-[0.28em] py-4 rounded-sm hover:bg-mauve/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Request my appointment
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="text-center py-16 animate-rise">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-mauve text-cream mb-10">
              <Check className="size-5" strokeWidth={1.5} />
            </div>
            <h2 className="font-serif italic text-[48px] leading-[1] tracking-[0.02em] mb-8">
              You're on the list.
            </h2>
            <p className="text-base text-ink/75 leading-relaxed font-light max-w-[36ch] mx-auto mb-10">
              Your stylist will be in touch within 24 hours to confirm your date. In the meantime — don't touch a thing.
            </p>
            <p className="text-xs text-ink/45 mb-12">
              Questions? Email us at hello@clem.com
            </p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-ink/55 mb-4">{label}</p>
      {children}
    </div>
  );
}

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`text-xs px-4 py-2.5 rounded-full border transition ${
              active
                ? "bg-mauve text-cream border-mauve"
                : "bg-transparent text-ink/75 border-ink/20 hover:border-ink/50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Nav({ onBack, onNext, nextDisabled }: { onBack?: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      {onBack && (
        <button type="button" onClick={onBack}
          className="text-[10px] uppercase tracking-[0.28em] text-ink/55 hover:text-ink transition border-b border-ink/30 pb-1">
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 bg-mauve text-cream text-[11px] uppercase tracking-[0.28em] py-4 rounded-sm hover:bg-mauve/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
}
