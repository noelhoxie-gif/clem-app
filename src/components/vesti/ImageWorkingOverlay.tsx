import { Zap } from "lucide-react";

export function ImageWorkingOverlay({
  working,
  queued = 0,
}: {
  working: number;
  queued?: number;
}) {
  if (working === 0 && queued === 0) return null;

  const detail =
    queued > 0
      ? `${working} working · ${queued} queued`
      : working > 1
        ? `${working} images working`
        : "Changing your photo";

  return (
    <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-sm grid place-items-center pointer-events-none">
      <div className="text-center rounded-2xl bg-background/85 border border-border/70 px-5 py-4 shadow-sm">
        <Zap
          className="size-6 text-mint animate-pulse mx-auto mb-2"
          strokeWidth={1.5}
        />
        <p className="text-xs font-medium uppercase tracking-[0.18em]">
          Working…
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>
      </div>
    </div>
  );
}
