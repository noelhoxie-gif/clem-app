import { useEffect, useState, useSyncExternalStore } from "react";

export interface ReminderPrefs {
  inApp: boolean;
  sms: boolean;
}

const PREFS_KEY = "vesti.reminders.prefs.v1";
const FIRED_KEY = "vesti.reminders.fired.v1";

const DEFAULT_PREFS: ReminderPrefs = { inApp: true, sms: true };

function loadPrefs(): ReminderPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ReminderPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

let prefs: ReminderPrefs = typeof window !== "undefined" ? loadPrefs() : DEFAULT_PREFS;
const listeners = new Set<() => void>();

export const reminderPrefs = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): ReminderPrefs {
    return prefs;
  },
  set(patch: Partial<ReminderPrefs>) {
    prefs = { ...prefs, ...patch };
    if (typeof window !== "undefined") {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
    listeners.forEach((l) => l());
  },
};

export function useReminderPrefs(): ReminderPrefs {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const value = useSyncExternalStore(
    reminderPrefs.subscribe,
    () => reminderPrefs.get(),
    () => DEFAULT_PREFS,
  );
  return hydrated ? value : DEFAULT_PREFS;
}

/** Track which reminder keys have already fired, scoped per day, so we don't double-notify. */
function loadFired(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

export function hasFired(key: string): boolean {
  return Boolean(loadFired()[key]);
}

export function markFired(key: string) {
  if (typeof window === "undefined") return;
  const fired = loadFired();
  fired[key] = true;
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
}

export function reminderKey(loanId: string, isoDate: string) {
  return `${loanId}::${isoDate}`;
}
