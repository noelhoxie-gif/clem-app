import { useEffect, useState, useSyncExternalStore } from "react";
import type { Outfit } from "./looks";

export interface HeartedLook {
  signature: string;
  title: string;
  vibe: string;
  itemIds: string[];
  createdAt: number;
}

interface HeartedLookState {
  looks: HeartedLook[];
}

const KEY = "clem.hearted-looks.v1";
const emptyState: HeartedLookState = { looks: [] };
let state: HeartedLookState =
  typeof window === "undefined" ? emptyState : load();
const listeners = new Set<() => void>();

function load(): HeartedLookState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<HeartedLookState>;
    return { looks: Array.isArray(parsed.looks) ? parsed.looks : [] };
  } catch {
    return emptyState;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

export function outfitSignature(outfit: Outfit): string {
  return [
    ["outer", outfit.outer?.id],
    ["top", outfit.top?.id],
    ["bottom", outfit.bottom?.id],
    ["shoes", outfit.shoes?.id],
    ["accessory", outfit.accessory?.id],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([slot, id]) => `${slot}:${id}`)
    .join("|");
}

export const heartedLooks = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get() {
    return state;
  },
  toggle(outfit: Outfit) {
    const signature = outfitSignature(outfit);
    if (!signature) return;
    const exists = state.looks.some((look) => look.signature === signature);
    state = exists
      ? { looks: state.looks.filter((look) => look.signature !== signature) }
      : {
          looks: [
            {
              signature,
              title: outfit.title,
              vibe: outfit.vibe,
              itemIds: [
                outfit.outer,
                outfit.top,
                outfit.bottom,
                outfit.shoes,
                outfit.accessory,
              ]
                .filter(Boolean)
                .map((item) => item!.id),
              createdAt: Date.now(),
            },
            ...state.looks,
          ],
        };
    persist();
  },
};

export function useHeartedLooks(): HeartedLookState {
  const [, setHydrated] = useState(false);
  useEffect(() => {
    state = load();
    setHydrated(true);
    listeners.forEach((listener) => listener());
  }, []);
  return useSyncExternalStore(
    heartedLooks.subscribe,
    heartedLooks.get,
    () => emptyState,
  );
}
