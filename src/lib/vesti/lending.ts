// Lending data model (mock). Shared between Closet grid and /lent detail.
// In a real backend these would be persisted records, not module constants.

export interface Loan {
  itemId: string;
  borrower: string;
  start: string; // ISO yyyy-mm-dd
  due: string;   // ISO yyyy-mm-dd
}

function iso(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Built lazily so SSR and client agree on the same set of mock loans
// (the offsets are stable; only the resolved ISO strings differ by day).
export function getLoans(): Loan[] {
  return [
    { itemId: "i21", borrower: "Maya Chen",    start: iso(-3),  due: iso(4) },
    { itemId: "i24", borrower: "Liv Bauer",    start: iso(-5),  due: iso(0) },
    { itemId: "i30", borrower: "Priya Shah",   start: iso(-10), due: iso(-2) },
    { itemId: "i29", borrower: "Elena Cortez", start: iso(-1),  due: iso(6) },
    { itemId: "i26", borrower: "Sasha Marin",  start: iso(-7),  due: iso(1) },
  ];
}

// Pieces the owner has marked as not available to lend (sentimental, fragile,
// etc.). Mock set — would be a per-item flag in a real schema.
export const NOT_LENDABLE = new Set<string>(["i01", "i02", "i05", "i10", "i15"]);

export function getLoanForItem(itemId: string): Loan | undefined {
  return getLoans().find((l) => l.itemId === itemId);
}

export function isCurrentlyLent(itemId: string): boolean {
  return getLoans().some((l) => l.itemId === itemId);
}

export function isNotLendable(itemId: string): boolean {
  return NOT_LENDABLE.has(itemId);
}

export function isAvailableToLend(itemId: string): boolean {
  return !isCurrentlyLent(itemId) && !isNotLendable(itemId);
}

export type LendingFilter = "all" | "available" | "lent" | "not-lendable";

export function matchesLendingFilter(itemId: string, filter: LendingFilter): boolean {
  switch (filter) {
    case "available":   return isAvailableToLend(itemId);
    case "lent":        return isCurrentlyLent(itemId);
    case "not-lendable": return isNotLendable(itemId);
    case "all":
    default:            return true;
  }
}

export function formatDueDate(due: string): string {
  return new Date(due + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
