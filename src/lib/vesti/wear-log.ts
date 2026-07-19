import { useEffect, useState, useSyncExternalStore } from "react";

export interface WearEntry {
  id: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  people: string[]; // free-form tags: "Sarah", "Work team", "Friday dinner crew"
  note?: string;
  createdAt: number;
}

interface WearState {
  entries: WearEntry[];
}

const KEY = "vesti.wear-log.v1";

const seed: WearState = { entries: [] };

function load(): WearState {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    return JSON.parse(raw) as WearState;
  } catch {
    return seed;
  }
}

let state: WearState = typeof window !== "undefined" ? load() : seed;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const wearLog = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return state;
  },
  log(input: { date?: string; itemIds: string[]; people?: string[]; note?: string }) {
    const entry: WearEntry = {
      id: crypto.randomUUID(),
      date: input.date ?? todayISO(),
      itemIds: input.itemIds,
      people: input.people ?? [],
      note: input.note,
      createdAt: Date.now(),
    };
    state = { entries: [entry, ...state.entries] };
    persist();
    return entry;
  },
  remove(id: string) {
    state = { entries: state.entries.filter((e) => e.id !== id) };
    persist();
  },
  /** Count of times each item has been worn. */
  wearCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    state.entries.forEach((e) => {
      e.itemIds.forEach((id) => {
        counts[id] = (counts[id] ?? 0) + 1;
      });
    });
    return counts;
  },
  /** Last wear date per item (YYYY-MM-DD). */
  lastWornMap(): Record<string, string> {
    const last: Record<string, string> = {};
    state.entries.forEach((e) => {
      e.itemIds.forEach((id) => {
        if (!last[id] || e.date > last[id]) last[id] = e.date;
      });
    });
    return last;
  },
  /** Past entries that include all the same itemIds & shared a person tag. */
  findRepeats(itemIds: string[], people: string[]): WearEntry[] {
    if (itemIds.length === 0) return [];
    const set = new Set(itemIds);
    return state.entries.filter((e) => {
      const sameItems = e.itemIds.length === itemIds.length && e.itemIds.every((id) => set.has(id));
      if (!sameItems) return false;
      if (people.length === 0) return true;
      return e.people.some((p) => people.includes(p));
    });
  },
  /** Distinct people tags ever used (for autocomplete). */
  knownPeople(): string[] {
    const set = new Set<string>();
    state.entries.forEach((e) => e.people.forEach((p) => set.add(p)));
    return Array.from(set).sort();
  },
};

export function useWearLog() {
  const [, setHydrated] = useState(false);
  useEffect(() => {
    state = load();
    setHydrated(true);
    listeners.forEach((l) => l());
  }, []);
  const snap = useSyncExternalStore(
    (cb) => wearLog.subscribe(cb),
    () => state,
    () => seed,
  );
  return snap;
}
