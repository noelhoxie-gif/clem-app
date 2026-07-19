// Tracks whether the user has completed (or skipped) the 3-screen app tour
// shown once after their first sign-in. Persisted (not per-session) so it
// never reappears once dismissed, mirroring the storage pattern used for
// the profile store (src/lib/vesti/profile.ts).

const SEEN_KEY = "clem.tutorial.seen";

export function hasSeenTutorial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}
