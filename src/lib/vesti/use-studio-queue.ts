import { useCallback, useEffect, useRef, useState } from "react";
import { gptImageStudio } from "@/lib/vesti/supabase-storage";

export type StudioJobStatus = "queued" | "working" | "done" | "error";

export interface StudioJob {
  id: string;
  style: string;
  status: StudioJobStatus;
  result?: Blob;
  previewUrl?: string;
  error?: string;
}

interface StudioJobInput {
  file: File | Blob;
  category: string;
  style: string;
  description?: string;
}

interface PendingJob extends StudioJobInput {
  id: string;
}

const MAX_CONCURRENT_JOBS = 3;

/**
 * Small client-side worker pool for AI Studio. Inputs are captured when they
 * are queued, so changing the current photo/style cannot alter an in-flight
 * request.
 */
export function useStudioQueue(
  onComplete: (job: StudioJob & { result: Blob; previewUrl: string }) => void,
) {
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const pendingRef = useRef<PendingJob[]>([]);
  const activeRef = useRef(0);
  const mountedRef = useRef(true);
  const urlsRef = useRef<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  const pumpRef = useRef<() => void>(() => {});
  onCompleteRef.current = onComplete;

  pumpRef.current = () => {
    while (
      mountedRef.current &&
      activeRef.current < MAX_CONCURRENT_JOBS &&
      pendingRef.current.length > 0
    ) {
      const pending = pendingRef.current.shift()!;
      activeRef.current += 1;
      setJobs((current) =>
        current.map((job) =>
          job.id === pending.id ? { ...job, status: "working" } : job,
        ),
      );

      void gptImageStudio(
        pending.file,
        pending.category,
        pending.style,
        pending.description,
      )
        .then((result) => {
          if (!mountedRef.current) return;
          const previewUrl = URL.createObjectURL(result);
          urlsRef.current.push(previewUrl);
          const completed: StudioJob & { result: Blob; previewUrl: string } = {
            id: pending.id,
            style: pending.style,
            status: "done",
            result,
            previewUrl,
          };
          setJobs((current) =>
            current.map((job) => (job.id === pending.id ? completed : job)),
          );
          onCompleteRef.current(completed);
        })
        .catch((error: unknown) => {
          if (!mountedRef.current) return;
          setJobs((current) =>
            current.map((job) =>
              job.id === pending.id
                ? {
                    ...job,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "AI Studio failed",
                  }
                : job,
            ),
          );
        })
        .finally(() => {
          activeRef.current -= 1;
          pumpRef.current();
        });
    }
  };

  const enqueue = useCallback((input: StudioJobInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingRef.current.push({ ...input, id });
    setJobs((current) => [
      ...current,
      { id, style: input.style, status: "queued" },
    ]);
    queueMicrotask(() => pumpRef.current());
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    pendingRef.current = pendingRef.current.filter((job) => job.id !== id);
    setJobs((current) => {
      const target = current.find((job) => job.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((job) => job.id !== id);
    });
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  return {
    jobs,
    enqueue,
    dismiss,
    workingCount: jobs.filter((job) => job.status === "working").length,
    queuedCount: jobs.filter((job) => job.status === "queued").length,
    errorCount: jobs.filter((job) => job.status === "error").length,
  };
}
