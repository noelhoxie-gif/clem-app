import { Link } from "@tanstack/react-router";
import { Plus, Bell, Zap } from "lucide-react";
import { useReceipts } from "@/lib/vesti/receipts";
import { useCredits } from "@/lib/vesti/credits";
import clemWordmark from "@/assets/clem-wordmark.png";

interface Props {
  title?: string;
}

export function AppHeader({ title: _title }: Props) {
  const { receipts: all } = useReceipts();
  const pendingCount = all.filter((r) => r.status === "pending").length;
  const credits = useCredits();

  return (
    <header className="sticky top-0 z-30 bg-cream text-ink px-6 sm:px-8 pt-[max(env(safe-area-inset-top),1.75rem)] pb-5 flex justify-between items-center border-b border-taupe">
      <Link
        to="/"
        aria-label="Clem"
        className="block leading-none"
      >
        <img
          src={clemWordmark}
          alt="Clem"
          className="h-8 w-auto object-contain"
        />
      </Link>
      <div className="flex gap-2 items-center">
        <Link
          to="/add"
          aria-label="Credits"
          className="inline-flex items-center gap-1 border border-taupe/60 rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-ink/55 hover:border-mauve/60 hover:text-mauve transition"
        >
          <span className="font-mono text-ink/70">{credits}</span>
          <span>credits</span>
        </Link>
        <Link
          to="/morning"
          aria-label="Right now"
          title="Right now"
          className="size-9 grid place-items-center text-ink/70 hover:text-ink transition active:scale-95"
        >
          <Zap className="size-[18px]" strokeWidth={1} />
        </Link>
        <Link
          to="/inbox"
          aria-label={`Receipt inbox${pendingCount > 0 ? `, ${pendingCount} pending` : ""}`}
          className="relative size-9 grid place-items-center text-ink/70 hover:text-ink transition active:scale-95"
        >
          <Bell className="size-[18px]" strokeWidth={1} />
          {pendingCount > 0 && (
            <span
              aria-hidden
              className="absolute top-2 right-2 size-[5px] rounded-full bg-mauve/70"
            />
          )}
        </Link>
        <Link
          to="/add"
          aria-label="Add item"
          className="size-9 grid place-items-center text-ink/70 hover:text-ink transition active:scale-95"
        >
          <Plus className="size-[19px]" strokeWidth={1} />
        </Link>
      </div>
    </header>
  );
}
