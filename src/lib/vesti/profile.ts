import { useEffect, useState, useSyncExternalStore } from "react";
import { dbUpsertProfile, fetchUserProfile } from "@/lib/vesti/db";

const KEY = "clem.profile.v1";

export type BodyShape = "hourglass" | "athletic" | "pear" | "straight" | "petite" | "plus" | "";
export type SkinTone = "porcelain" | "fair" | "light" | "medium" | "tan" | "deep" | "rich" | "";

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  city?: string;
  styleIdentities: string[];
  brands: string[];
  confidence: string;
  boldness: number; // 1..5
  occasions: string[];
  height: string;
  weight: string;
  topSize: string;
  bottomSize: string;
  shoeSize: string;
  bodyShape: BodyShape | string;
  skinTone: SkinTone;
  colors: string[];
  avoidColors: string;
  frustration: string;
  inspiration: string[];
  shoppingHabits: string[];
  budget: string[];
  completedAt: number | null;
}

export const EMPTY_PROFILE: UserProfile = {
  firstName: "",
  lastName: "",
  city: "",
  styleIdentities: [],
  brands: [],
  confidence: "",
  boldness: 3,
  occasions: [],
  height: "",
  weight: "",
  topSize: "",
  bottomSize: "",
  shoeSize: "",
  bodyShape: "",
  skinTone: "",
  colors: [],
  avoidColors: "",
  frustration: "",
  inspiration: [],
  shoppingHabits: [],
  budget: [],
  completedAt: null,
};

function load(): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
  } catch {
    return EMPTY_PROFILE;
  }
}

let state: UserProfile = typeof window !== "undefined" ? load() : EMPTY_PROFILE;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  dbUpsertProfile(state);
  listeners.forEach((l) => l());
}

export const profileStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return state;
  },
  save(next: UserProfile) {
    state = next;
    persist();
  },
  complete(next: UserProfile) {
    state = { ...next, completedAt: Date.now() };
    persist();
  },
  reset() {
    state = EMPTY_PROFILE;
    persist();
  },
  async syncUser(userId: string | null) {
    if (!userId) {
      state = load();
      listeners.forEach((l) => l());
      return;
    }
    const dbData = await fetchUserProfile(userId).catch(() => null);
    if (dbData) {
      state = { ...EMPTY_PROFILE, ...(dbData as Partial<UserProfile>) };
      localStorage.setItem(KEY, JSON.stringify(state));
      listeners.forEach((l) => l());
    }
  },
};

export function useProfile() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    state = load();
    setHydrated(true);
    listeners.forEach((l) => l());
  }, []);
  const snap = useSyncExternalStore(
    (cb) => profileStore.subscribe(cb),
    () => state,
    () => EMPTY_PROFILE,
  );
  return { profile: snap, hydrated };
}
