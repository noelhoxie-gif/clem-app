import type { StudioJob } from "@/lib/vesti/use-studio-queue";

export function StudioJobStrip({
  jobs,
  onSelect,
  onDismiss,
}: {
  jobs: StudioJob[];
  onSelect: (job: StudioJob & { result: Blob; previewUrl: string }) => void;
  onDismiss: (id: string) => void;
}) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="relative shrink-0 size-16 rounded-xl overflow-hidden border border-border bg-card"
            title={job.error}
          >
            {job.result && job.previewUrl ? (
              <button
                type="button"
                onClick={() =>
                  onSelect(
                    job as StudioJob & { result: Blob; previewUrl: string },
                  )
                }
                className="w-full h-full"
                aria-label={`Use ${job.style} AI Studio result`}
              >
                <img
                  src={job.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <div className="w-full h-full grid place-items-center px-1 text-center">
                <span className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                  {job.status === "error" ? "Failed" : job.status}
                </span>
              </div>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-background/80 px-1 py-0.5 text-center text-[7px] uppercase tracking-[0.08em] pointer-events-none">
              {job.style}
            </span>
            {job.status === "error" && (
              <button
                type="button"
                onClick={() => onDismiss(job.id)}
                className="absolute top-0.5 right-1 text-[10px] text-destructive"
                aria-label="Dismiss failed AI Studio job"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {jobs.some((job) => job.status === "error") && (
        <p className="text-[10px] text-destructive">
          {jobs.find((job) => job.status === "error")?.error}
        </p>
      )}
    </div>
  );
}
