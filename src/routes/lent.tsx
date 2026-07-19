import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/vesti/AppHeader";
import { BottomNav } from "@/components/vesti/BottomNav";
import { useCloset } from "@/lib/vesti/store";
import { hasFired, markFired, reminderKey, reminderPrefs } from "@/lib/vesti/reminders";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/lent")({
  head: () => ({
    meta: [
      { title: "Pieces to Lend — Clem" },
      { name: "description", content: "Pieces currently out on loan from your closet." },
    ],
  }),
  component: LentPage,
});

import { getLoans, type Loan } from "@/lib/vesti/lending";

const DAY = 24 * 60 * 60 * 1000;

function statusFor(loan: Loan, now: number): "active" | "due-soon" | "overdue" {
  const dueTs = new Date(loan.due + "T23:59:59").getTime();
  const diff = dueTs - now;
  if (diff < 0) return "overdue";
  if (diff <= DAY) return "due-soon";
  return "active";
}

const STATUS_STYLES = {
  active:   { label: "Active",   cls: "text-[#8B8B6B] border-[#8B8B6B]/40 bg-[#8B8B6B]/10", dot: "bg-[#8B8B6B]" },
  "due-soon": { label: "Due Soon", cls: "text-[#C4845A] border-[#C4845A]/40 bg-[#C4845A]/10", dot: "bg-[#C4845A]" },
  overdue:  { label: "Overdue",  cls: "text-[#B5614A] border-[#B5614A]/40 bg-[#B5614A]/10", dot: "bg-[#B5614A]" },
} as const;

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LentPage() {
  const { items } = useCloset();
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const loans = useMemo(() => {
    return getLoans()
      .map((l) => ({ loan: l, item: items.find((i) => i.id === l.itemId) }))
      .filter((x): x is { loan: Loan; item: NonNullable<typeof x.item> } => Boolean(x.item));
  }, [items]);

  // On-due-date reminder trigger
  useEffect(() => {
    if (!now) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const prefs = reminderPrefs.get();
    if (!prefs.inApp && !prefs.sms) return;

    loans.forEach(({ loan, item }) => {
      if (loan.due !== todayIso) return;
      const key = reminderKey(loan.itemId, todayIso);
      if (hasFired(key)) return;
      markFired(key);

      const dueTime = new Date(loan.due + "T18:00:00").toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      console.info(
        `[reminder → ${loan.borrower}] Time to send the ${item.name} home — today by ${dueTime}.`,
        { channels: { inApp: prefs.inApp, sms: prefs.sms } },
      );

      if (prefs.inApp) {
        toast(`Reminder sent for ${item.name}`, {
          description: `Due back from ${loan.borrower} today.`,
        });
      }
    });
  }, [loans, now]);

  return (
    <div className="min-h-screen bg-cream text-ink pb-32">
      <AppHeader title="Pieces to Lend" />

      <main>
        <section className="px-8 pt-12 pb-8 animate-rise">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-ink/55 hover:text-ink transition mb-7"
          >
            <ArrowLeft className="size-3" strokeWidth={1.5} />
            Back to closet
          </Link>
          <p className="text-[10px] uppercase tracking-[0.32em] text-mauve mb-5">
            The Lending Closet · Out in the world
          </p>
          <h1 className="font-serif italic text-[40px] leading-[1.05] tracking-[0.02em] text-ink">
            Your pieces, out in the world.
          </h1>
          <p className="font-serif italic text-sm text-ink/55 mt-4 leading-relaxed max-w-[34ch]">
            {loans.length} {loans.length === 1 ? "piece is" : "pieces are"} currently with someone you trust.
          </p>
        </section>

        <section className="px-8 pb-16">
          {loans.length === 0 ? (
            <div className="border border-dashed border-taupe/50 rounded-sm p-10 text-center">
              <p className="font-serif italic text-ink/60 text-lg leading-snug mb-3">
                Some things are meant to be passed around.
              </p>
              <p className="text-sm text-ink/55 font-light max-w-[32ch] mx-auto">
                When a piece leaves your closet for someone else's weekend, it'll appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {loans.map(({ loan, item }) => {
                const s = now ? statusFor(loan, now) : "active";
                const style = STATUS_STYLES[s];
                return (
                  <li
                    key={loan.itemId}
                    className="flex gap-4 p-3 border border-taupe/40 rounded-sm bg-mint-soft"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="size-24 object-cover rounded-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-ink/55 truncate">
                              {item.brand}
                            </p>
                            <p className="font-serif text-base text-ink leading-tight truncate">
                              {item.name}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] border rounded-full px-2.5 py-1 ${style.cls}`}
                          >
                            <span className={`size-1.5 rounded-full ${style.dot}`} />
                            {style.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-[0.24em] text-ink/45">With</p>
                          <p className="font-serif italic text-sm text-ink/85 truncate">
                            {loan.borrower}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] uppercase tracking-[0.24em] text-ink/45">Window</p>
                          <p className="font-serif text-xs text-ink/85">
                            {fmtDate(loan.start)} <span className="text-ink/40">→</span> {fmtDate(loan.due)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
