import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/vesti/AppHeader";
import { BottomNav } from "@/components/vesti/BottomNav";
import { WhiteGloveBooking } from "@/components/vesti/WhiteGloveBooking";
import { LendingSetup } from "@/components/vesti/LendingSetup";
import { Switch } from "@/components/ui/switch";
import { useCloset, itemStatus, type Item } from "@/lib/vesti/store";
import { getLoans } from "@/lib/vesti/lending";
import { useProfile, type UserProfile } from "@/lib/vesti/profile";
import { computeClosetScore } from "@/lib/vesti/closet-score";
import { reminderPrefs, useReminderPrefs } from "@/lib/vesti/reminders";
import { useAuth } from "@/lib/auth-context";
import { Copy, Check, Settings, LogOut, Pencil, ChevronDown, Sparkles, ArrowRight, Key } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { setPhotoroomKey, getStoredPhotoroomKey } from "@/lib/vesti/supabase-storage";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Clem" },
      { name: "description", content: "Manage your account and share your closet with friends." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { items, folders } = useCloset();
  const { profile, hydrated } = useProfile();
  const { signOut } = useAuth();
  const [copied, setCopied] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("/share/me");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [lendingOpen, setLendingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [photoroomInput, setPhotoroomInput] = useState("");

  useEffect(() => {
    setShareUrl(`${window.location.origin}/share/me`);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink pb-32">
      <AppHeader title="Profile" />

      <main>
        {/* Editorial intro */}
        <section className="px-8 pt-14 pb-10 animate-rise">
          <p className="text-[10px] uppercase tracking-[0.32em] text-ink/50 mb-5">
            The Wearer · Vol. I
          </p>
          <h1 className="font-serif text-[56px] leading-[0.95] text-ink tracking-[0.06em] uppercase">
            Clem
            <br />
            Curator
          </h1>
          <p className="font-serif text-lg text-ink/70 mt-6 max-w-[28ch] leading-snug tracking-[0.02em]">
            A wardrobe in progress — kept with intention.
          </p>
        </section>

        {/* Stat ledger — editorial blocks on cream */}
        <section className="px-8 pb-12">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-mint-soft border border-taupe/40 rounded-sm p-4 aspect-square flex flex-col justify-between">
              <p className="text-[9px] uppercase tracking-[0.24em] text-mauve">No. 01</p>
              <div>
                <p className="font-serif text-[44px] text-ink leading-[0.85] tracking-[0.02em]">{items.filter(i => itemStatus(i) === "active").length}</p>
                <p className="text-[9px] uppercase tracking-[0.22em] text-ink/55 mt-2 leading-tight">
                  Pieces in rotation
                </p>
              </div>
            </div>
            <div className="bg-mint-soft border border-taupe/40 rounded-sm p-4 aspect-square flex flex-col justify-between">
              <p className="text-[9px] uppercase tracking-[0.24em] text-mauve">No. 02</p>
              <div>
                <p className="font-serif text-[44px] text-ink leading-[0.85] tracking-[0.02em]">{folders.length}</p>
                <p className="text-[9px] uppercase tracking-[0.22em] text-ink/55 mt-2 leading-tight">
                  Collections kept
                </p>
              </div>
            </div>
            <Link
              to="/lent"
              className="bg-mint-soft border border-taupe/40 rounded-sm p-4 aspect-square flex flex-col justify-between text-left hover:border-mauve/60 transition"
            >
              <p className="text-[9px] uppercase tracking-[0.24em] text-mauve">No. 03</p>
              <div>
                <p className="font-serif text-[44px] text-ink leading-[0.85] tracking-[0.02em]">{getLoans().length}</p>
                <p className="text-[9px] uppercase tracking-[0.22em] text-ink/55 mt-2 leading-tight">
                  Pieces to lend
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Closet Intelligence Score */}
        <ClosetScoreSection items={items} profile={profile} hydrated={hydrated} />

        {/* Reminders — preferences for lending due-date notifications */}
        <RemindersSection />



        {/* Shareable closet — the mauve hero moment */}
        <section className="px-8 pb-14 animate-rise">
          <div className="relative bg-mauve text-cream rounded-sm p-9 overflow-hidden shadow-[0_40px_80px_-30px_rgba(107,58,74,0.55)]">
            {/* Cream corner mark */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-cream" style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />
            <div className="absolute top-3 right-3 font-serif italic text-ink text-xs">C</div>

            <p className="text-[10px] uppercase tracking-[0.32em] text-cream/70 mb-7">
              The Shared Closet · A Keepsake
            </p>
            <h2 className="font-serif text-[40px] leading-[0.95] mb-5 tracking-[0.04em] uppercase">
              An invitation,
              <br />
              sent quietly.
            </h2>
            <p className="text-sm text-cream/75 mb-8 max-w-[34ch] leading-relaxed font-light">
              A private link to your wardrobe — for the ones who'd notice the difference between linen and lyocell.
            </p>

            <div className="border-t border-cream/25 pt-5">
              <p className="text-[9px] uppercase tracking-[0.3em] text-cream/50 mb-2">Your link</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-cream/90 font-mono truncate flex-1">{shareUrl}</p>
                <button
                  type="button"
                  onClick={copy}
                  className="shrink-0 text-[10px] uppercase tracking-[0.24em] text-cream hover:text-cream/70 transition inline-flex items-center gap-1.5 border-b border-cream/40 pb-0.5"
                >
                  {copied ? <Check className="size-3" strokeWidth={1.5} /> : <Copy className="size-3" strokeWidth={1.5} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <Link
              to="/share/$shareId"
              params={{ shareId: "me" }}
              className="mt-7 inline-block text-[10px] uppercase tracking-[0.28em] italic text-cream/85 underline underline-offset-[6px] decoration-cream/50 decoration-1"
            >
              Preview the shared view →
            </Link>
          </div>
        </section>

        {/* Lending Closet — a quieter sibling to the Shared Closet */}
        <section className="px-8 pb-14 animate-rise">
          <div className="relative bg-mint-soft border border-taupe/50 text-ink rounded-sm p-9 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-ink/[0.04]" style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />

            <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-7">
              The Lending Closet · By Invitation
            </p>
            <h2 className="font-serif italic text-[32px] leading-[1.1] tracking-[0.02em] text-ink mb-5">
              Some things are meant to be passed around.
            </h2>
            <p className="text-sm text-ink/70 mb-8 max-w-[34ch] leading-relaxed font-light">
              A dress worn once by you, then her, then someone else entirely. Set your price. Set your circle. Keep what's precious for yourself.
            </p>

            <button
              type="button"
              onClick={() => setLendingOpen(true)}
              className="w-full bg-ink text-cream text-[11px] uppercase tracking-[0.28em] py-4 rounded-sm hover:bg-ink/90 transition inline-flex items-center justify-center gap-2"
            >
              Set up lending
              <ArrowRight className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </section>

        {/* Style profile — onboarding answers, expandable */}
        <section className="px-8 pb-14">
          <div className="flex items-baseline justify-between mb-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-ink/40">Your Style Profile</p>
            <div className="flex items-center gap-4">
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-mauve hover:text-ink transition"
              >
                <Sparkles className="size-3" strokeWidth={1.5} />
                Update my fit model
              </Link>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-mauve hover:text-ink transition"
              >
                <Pencil className="size-3" strokeWidth={1.5} />
                Edit
              </Link>
            </div>
          </div>

          {!hydrated || !profile.completedAt ? (
            <div className="border border-dashed border-taupe/50 rounded-sm p-6 text-center">
              <p className="font-serif italic text-ink/60 text-sm mb-3">
                You haven't told Clem about your style yet.
              </p>
              <Link
                to="/onboarding"
                className="inline-block text-[10px] uppercase tracking-[0.28em] text-mauve border-b border-mauve/50 pb-0.5"
              >
                Begin onboarding →
              </Link>
            </div>
          ) : (
            <div className="border border-taupe/40 rounded-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-ink/5 transition"
              >
                <span className="text-sm text-ink/85 font-light">
                  {profileOpen ? "Hide your style profile" : "View your style profile"}
                </span>
                <ChevronDown
                  className={`size-4 text-ink/40 transition-transform duration-300 ${profileOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
              {profileOpen && (
                <dl className="divide-y divide-taupe/30 border-t border-taupe/40 text-sm px-5">
                  <ProfileRow label="Style identities" value={profile.styleIdentities.join(", ")} />
                  <ProfileRow label="Favorite brands" value={profile.brands.join(", ")} />
                  <ProfileRow label="Confidence" value={profile.confidence} />
                  <ProfileRow label="Boldness" value={`${profile.boldness} / 5`} />
                  <ProfileRow label="Occasions" value={profile.occasions.join(", ")} />
                  <ProfileRow label="Height" value={profile.height} />
                  <ProfileRow label="Weight" value={profile.weight} />
                  <ProfileRow label="Top size" value={profile.topSize} />
                  <ProfileRow label="Bottom size" value={profile.bottomSize} />
                  <ProfileRow label="Shoe size" value={profile.shoeSize} />
                  <ProfileRow label="Body shape" value={profile.bodyShape} />
                  <ProfileRow label="Colors you love" value={profile.colors.join(", ")} />
                  <ProfileRow label="Colors to avoid" value={profile.avoidColors} />
                  <ProfileRow label="Fashion icons" value={profile.inspiration.join(", ")} />
                  <ProfileRow label="Shopping habits" value={profile.shoppingHabits.join(", ")} />
                  <ProfileRow label="Budget" value={profile.budget.join(", ")} />
                  <ProfileRow label="Style frustration" value={profile.frustration} />
                </dl>
              )}
            </div>
          )}
        </section>

        {/* White Glove Service — premium concierge card */}
        <section className="px-8 pb-14 animate-rise">
          <div className="relative bg-sand text-ink rounded-sm p-8 overflow-hidden">
            {/* Subtle corner mark */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-ink/[0.04]" style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />

            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="size-3 text-mauve" strokeWidth={1.5} />
              <p className="text-[9px] uppercase tracking-[0.32em] text-ink/55">Concierge Service</p>
            </div>

            <h2 className="font-serif italic text-[28px] leading-[1.1] text-ink tracking-[0.02em] mb-4">
              White Glove Wardrobe Upload
            </h2>

            <p className="text-sm text-ink/75 leading-relaxed font-light mb-6">
              Some of your best pieces have no digital footprint. Your grandmother's vintage Chanel blazer. The Gucci belt from your honeymoon. The things you've been collecting for years that no receipt can capture. A Clem stylist comes to you and photographs, tags, and uploads every piece that didn't auto-sync — the heirlooms, the investment buys, the irreplaceable. Because every part of your wardrobe deserves to be in your closet.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {["New York", "Los Angeles", "Miami", "Dallas", "Chicago"].map((city) => (
                <span
                  key={city}
                  className="inline-block text-[10px] uppercase tracking-[0.2em] text-ink/60 bg-ink/[0.06] rounded-full px-3 py-1.5"
                >
                  {city}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="w-full bg-mauve text-cream text-[11px] uppercase tracking-[0.28em] py-4 rounded-sm hover:bg-mauve/90 transition"
            >
              Book an appointment
            </button>

            <p className="text-center text-[10px] text-ink/40 tracking-[0.18em] mt-4">
              90 min session · From $199
            </p>
          </div>
        </section>

        {/* Settings list — minimal */}
        <section className="px-8 pb-16">
          <p className="text-[10px] uppercase tracking-[0.28em] text-ink/40 mb-4">House-keeping</p>
          <ul className="divide-y divide-taupe/30 border-y border-taupe/40">
            <li>
              <button
                type="button"
                onClick={() => { setPhotoroomInput(getStoredPhotoroomKey()); setSettingsOpen(true); }}
                className="w-full flex items-center justify-between py-5 text-sm text-ink/85 hover:text-ink transition"
              >
                <span className="flex items-center gap-4 font-light">
                  <Settings className="size-4 text-ink/50" strokeWidth={1} />
                  Settings
                </span>
                <ArrowRight className="size-3.5 text-ink/30" strokeWidth={1.5} />
              </button>
            </li>
            <li>
              <button type="button" onClick={() => void signOut()} className="w-full flex items-center justify-between py-5 text-sm text-ink/85 hover:text-ink transition">
                <span className="flex items-center gap-4 font-light">
                  <LogOut className="size-4 text-ink/50" strokeWidth={1} />
                  Sign out
                </span>
                <ArrowRight className="size-3.5 text-ink/30" strokeWidth={1.5} />
              </button>
            </li>
          </ul>
        </section>
      </main>

      <BottomNav />
      <WhiteGloveBooking open={bookingOpen} onClose={() => setBookingOpen(false)} />
      <LendingSetup open={lendingOpen} onClose={() => setLendingOpen(false)} />

      {/* Settings sheet */}
      <Sheet open={settingsOpen} onOpenChange={(o) => !o && setSettingsOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border max-h-[80vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Settings</p>
            <SheetTitle className="font-serif text-2xl tracking-[0.02em]">API Keys</SheetTitle>
            <SheetDescription className="text-xs">
              Keys are saved locally on this device only.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <Key className="size-3" strokeWidth={1.5} />
                PhotoRoom API Key
              </label>
              <p className="text-[10px] text-muted-foreground/70 mt-1 mb-2">
                Used for background removal when adding items. Get a key at photoroom.com.
              </p>
              <input
                type="text"
                value={photoroomInput}
                onChange={(e) => setPhotoroomInput(e.target.value)}
                placeholder="sk_pr_..."
                className="w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mint/30"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setPhotoroomKey(photoroomInput); setSettingsOpen(false); }}
                className="flex-1 rounded-full bg-foreground text-background py-3 text-xs uppercase tracking-[0.22em] active:scale-[0.98] transition"
              >
                Save
              </button>
              {getStoredPhotoroomKey() && (
                <button
                  type="button"
                  onClick={() => { setPhotoroomKey(""); setPhotoroomInput(""); }}
                  className="px-5 rounded-full border border-border text-xs uppercase tracking-[0.18em] text-muted-foreground active:scale-[0.98] transition"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ClosetScoreSection({
  items,
  profile,
  hydrated,
}: {
  items: Item[];
  profile: UserProfile;
  hydrated: boolean;
}) {
  const report = useMemo(() => computeClosetScore(items, profile), [items, profile]);

  if (!hydrated) {
    return (
      <section className="px-8 pb-12">
        <div className="h-[420px] rounded-sm bg-ink/5 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="px-8 pb-12 animate-rise">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-ink/40">Closet Intelligence</p>
        <p className="text-[10px] uppercase tracking-[0.24em] text-ink/30">{report.activeItemCount} active pieces</p>
      </div>

      <div className="border border-taupe/40 rounded-sm overflow-hidden">

        {/* ── Score panel (dark) ── */}
        <div className="bg-ink px-8 pt-8 pb-7">
          <div className="flex items-end gap-5 mb-5">
            <div>
              <p className="text-[9px] uppercase tracking-[0.26em] text-cream/30 mb-1">Overall</p>
              <p className="font-serif text-[68px] leading-[0.85] text-cream tracking-[0.02em]">
                {report.overall}
              </p>
            </div>
          </div>
          <p className="font-serif italic text-[19px] text-cream leading-snug tracking-[0.01em]">
            {report.headline}
          </p>
          <p className="text-xs text-cream/45 mt-1.5 font-light leading-relaxed max-w-[38ch]">
            {report.subline}
          </p>
        </div>

        {/* ── Dimension bars ── */}
        <div className="bg-cream px-6 py-5 space-y-[18px]">
          {report.dimensions.map((d) => (
            <div key={d.id}>
              <div className="flex items-center justify-between mb-[5px]">
                <p className="text-[9px] uppercase tracking-[0.22em] text-ink/50">{d.label}</p>
                <p className={`text-[9px] font-mono tracking-[0.1em] ${
                  d.status === "strong" ? "text-sage" :
                  d.status === "good"   ? "text-ink/60" :
                  d.status === "fair"   ? "text-ink/45" : "text-mauve"
                }`}>{d.pct}%</p>
              </div>
              <div className="h-[1.5px] bg-taupe/25 rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    d.status === "strong" ? "bg-sage" :
                    d.status === "good"   ? "bg-ink/65" :
                    d.status === "fair"   ? "bg-ink/35" : "bg-mauve/65"
                  }`}
                  style={{ width: `${d.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Top gaps ── */}
        {report.topGaps.length > 0 && (
          <div className="border-t border-taupe/40 bg-mint-soft/40 px-6 pt-5 pb-6">
            <p className="text-[9px] uppercase tracking-[0.28em] text-mauve mb-4">Top priorities</p>
            <div className="space-y-4">
              {report.topGaps.map((g) => (
                <div key={g.id} className="flex gap-3">
                  <div
                    className={`w-[2px] shrink-0 self-stretch rounded-full ${
                      g.severity === "critical" ? "bg-mauve" :
                      g.severity === "moderate" ? "bg-ink/40" : "bg-taupe/60"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-ink/85 font-light leading-snug">{g.label}</p>
                    <p className="text-[11px] text-ink/45 mt-0.5 font-light leading-snug">{g.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <dt className="text-[10px] uppercase tracking-[0.24em] text-ink/45 shrink-0 pt-0.5 w-[38%]">
        {label}
      </dt>
      <dd className="font-serif text-ink/85 text-right flex-1 leading-snug">
        {value && value.trim() !== "" ? value : <span className="italic text-ink/30">—</span>}
      </dd>
    </div>
  );
}

function RemindersSection() {
  const prefs = useReminderPrefs();
  return (
    <section className="px-8 pb-14 animate-rise">
      <div className="border border-taupe/40 rounded-sm p-7 bg-cream">
        <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">
          Reminders
        </p>
        <h2 className="font-serif italic text-[26px] leading-[1.15] tracking-[0.02em] text-ink mb-3">
          How should we remind you?
        </h2>
        <p className="text-sm text-ink/65 font-light leading-relaxed mb-7">
          We'll let you know when a lending cycle is ending.
        </p>

        <ul className="divide-y divide-taupe/30 border-y border-taupe/40">
          <ReminderToggleRow
            label="In-App Notifications"
            hint="A gentle nudge inside Clem."
            checked={prefs.inApp}
            onChange={(v) => reminderPrefs.set({ inApp: v })}
          />
          <ReminderToggleRow
            label="Text Message Reminders"
            hint="A short SMS the morning it's due."
            checked={prefs.sms}
            onChange={(v) => reminderPrefs.set({ sms: v })}
          />
        </ul>
      </div>
    </section>
  );
}

function ReminderToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-5">
      <div className="min-w-0">
        <p className="text-sm text-ink font-light">{label}</p>
        <p className="font-serif italic text-xs text-ink/55 mt-0.5">{hint}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#8B8B6B] data-[state=unchecked]:bg-ink/15"
      />
    </li>
  );
}

