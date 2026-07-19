import { useEffect, useState, useSyncExternalStore } from "react";
import { closet, type Category, type Season } from "./store";

export type ReceiptStatus = "pending" | "confirmed" | "denied";
export type ReceiptKind = "purchase" | "return";

export interface DetectedReceipt {
  id: string;
  retailer: string;
  sender: string; // email "from" address
  subject: string;
  detectedAt: number;
  orderDate: string; // YYYY-MM-DD
  price?: string;
  itemName: string;
  brand: string;
  color?: string;
  category: Category;
  season: Season;
  image: string;
  status: ReceiptStatus;
  kind?: ReceiptKind; // defaults to "purchase"
  returned?: boolean; // user has shipped the return back
}


interface ReceiptsState {
  receipts: DetectedReceipt[];
  lastSyncedAt: number | null;
}

const KEY = "vesti.receipts.v1";

const seed: ReceiptsState = {
  receipts: [],
  lastSyncedAt: null,
};


function load(): ReceiptsState {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<ReceiptsState>;
    return { receipts: seed.receipts, lastSyncedAt: null, ...parsed };
  } catch {
    return seed;
  }
}

let state: ReceiptsState = typeof window !== "undefined" ? load() : seed;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function setState(next: ReceiptsState) {
  state = next;
  persist();
}


export const receipts = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return state;
  },
  pending() {
    return state.receipts.filter((r) => r.status === "pending");
  },
  confirm(id: string) {
    const r = state.receipts.find((x) => x.id === id);
    if (!r) return;
    if (r.kind !== "return") {
      closet.addItem({
        name: r.itemName,
        brand: r.brand,
        color: r.color,
        category: r.category,
        season: r.season,
        image: r.image,
      });
    }
    setState({
      ...state,
      receipts: state.receipts.map((x) => (x.id === id ? { ...x, status: "confirmed" } : x)),
    });
  },

  /** Mark confirmed without auto-adding to closet (caller handles closet.addItem). */
  confirmOnly(id: string) {
    setState({
      ...state,
      receipts: state.receipts.map((x) => (x.id === id ? { ...x, status: "confirmed" } : x)),
    });
  },

  deny(id: string) {
    setState({
      ...state,
      receipts: state.receipts.map((x) => (x.id === id ? { ...x, status: "denied" } : x)),
    });
  },
  markReturned(id: string) {
    setState({
      ...state,
      receipts: state.receipts.map((x) => (x.id === id ? { ...x, returned: true } : x)),
    });
  },
  markSynced() {
    setState({ ...state, lastSyncedAt: Date.now() });
  },
  /** Add a real receipt parsed from Gmail. Deduplicates by messageId. */
  addReal(receipt: {
    messageId: string;
    retailer: string;
    sender: string;
    subject: string;
    orderDate: string;
    price?: string;
    itemName: string;
    brand: string;
    color?: string;
    category: Category;
    season: Season;
    kind: "purchase" | "return";
    image: string;
  }) {
    const id = `gmail-${receipt.messageId}`;
    if (state.receipts.some((r) => r.id === id)) return; // already seen
    const newReceipt: DetectedReceipt = {
      id,
      retailer: receipt.retailer,
      sender: receipt.sender,
      subject: receipt.subject,
      detectedAt: Date.now(),
      orderDate: receipt.orderDate,
      price: receipt.price,
      itemName: receipt.itemName,
      brand: receipt.brand,
      color: receipt.color,
      category: receipt.category,
      season: receipt.season,
      image: receipt.image,
      status: "pending",
      kind: receipt.kind,
    };
    setState({ ...state, receipts: [newReceipt, ...state.receipts] });
  },
};

export function useReceipts() {
  const [, setHydrated] = useState(false);
  useEffect(() => {
    state = load();
    setHydrated(true);
    listeners.forEach((l) => l());
  }, []);
  const snap = useSyncExternalStore(
    (cb) => receipts.subscribe(cb),
    () => state,
    () => seed,
  );
  return snap;
}
