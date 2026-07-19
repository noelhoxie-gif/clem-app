import { useEffect, useState } from "react";

const CREDITS_KEY = "clem.credits";
const RENEWAL_KEY = "clem.credits.month";
const DEFAULT_CREDITS = 25;

export const CREDIT_COSTS = {
  bgRemoval: 1,
  aiSuggest: 1,
  flatLay: 5,
  smartEdit: 3,
  randomEdit: 3,
  gptStudio: 5,
} as const;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emit() {
  window.dispatchEvent(new CustomEvent("clem.credits"));
}

/** Returns balance, renewing to DEFAULT_CREDITS if the calendar month has rolled over. */
export function getCredits(): number {
  try {
    const month = currentMonth();
    const stored = localStorage.getItem(RENEWAL_KEY);
    if (stored !== month) {
      // New month — reset
      localStorage.setItem(CREDITS_KEY, String(DEFAULT_CREDITS));
      localStorage.setItem(RENEWAL_KEY, month);
      return DEFAULT_CREDITS;
    }
    const balance = localStorage.getItem(CREDITS_KEY);
    return balance !== null ? Number(balance) : DEFAULT_CREDITS;
  } catch {
    return DEFAULT_CREDITS;
  }
}

/** Returns false if insufficient credits; otherwise deducts and returns true. */
export function consumeCredits(amount: number): boolean {
  const current = getCredits();
  if (current < amount) return false;
  try { localStorage.setItem(CREDITS_KEY, String(current - amount)); } catch { /* ignore */ }
  emit();
  return true;
}

export function addCredits(amount: number): void {
  getCredits(); // trigger renewal check first
  try { localStorage.setItem(CREDITS_KEY, String(getCredits() + amount)); } catch { /* ignore */ }
  emit();
}

export function useCredits(): number {
  const [credits, setCredits] = useState(getCredits);
  useEffect(() => {
    const handler = () => setCredits(getCredits());
    window.addEventListener("clem.credits", handler);
    return () => window.removeEventListener("clem.credits", handler);
  }, []);
  return credits;
}
