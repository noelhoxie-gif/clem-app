import { useEffect, useState, useSyncExternalStore } from "react";
import {
  setDbUser,
  fetchUserData,
  dbUpsertItem,
  dbDeleteItem,
  dbUpsertFolder,
  dbDeleteFolder,
  dbUpsertWish,
  dbDeleteWish,
} from "./db";
import { wearLog } from "./wear-log";
import sweater from "@/assets/item-sweater.jpg";
import dress from "@/assets/item-dress.jpg";
import trench from "@/assets/item-trench.jpg";
import boots from "@/assets/item-boots.jpg";
import folderBeach from "@/assets/folder-beach.jpg";
import folderWork from "@/assets/folder-work.jpg";
import trousers from "@/assets/item-trousers.jpg";
import shirt from "@/assets/item-shirt.jpg";
import jeans from "@/assets/item-jeans.jpg";
import bag from "@/assets/item-bag.jpg";
import sneakers from "@/assets/item-sneakers.jpg";
import sunglasses from "@/assets/item-sunglasses.jpg";
import skirt from "@/assets/item-skirt.jpg";
import blazer from "@/assets/item-blazer.jpg";
import outfitBlouse from "@/assets/outfit-blouse.jpg";
import outfitTrousers from "@/assets/outfit-trousers.jpg";
import outfitJewelry from "@/assets/outfit-jewelry.jpg";
import slipButter from "@/assets/item-slip-butter.jpg";
import bagChocolate from "@/assets/item-bag-chocolate.jpg";
import knitSet from "@/assets/item-knit-set.jpg";
import flatsRed from "@/assets/item-flats-red.jpg";
import sequinMini from "@/assets/item-sequin-mini.jpg";
import denimMaxi from "@/assets/item-denim-maxi.jpg";
import blazerSage from "@/assets/item-blazer-sage.jpg";
import crochetTop from "@/assets/item-crochet-top.jpg";
import heelsBlack from "@/assets/item-heels-black.jpg";
import necklaces from "@/assets/item-necklaces.jpg";
import leatherSkirt from "@/assets/item-leather-skirt.jpg";
import strawHat from "@/assets/item-straw-hat.jpg";
import wishCelineLuggage from "@/assets/wish-celine-luggage.jpg";
import sandalsTan from "@/assets/item-sandals-tan.jpg";
import topcoatCamel from "@/assets/item-topcoat-camel.jpg";
import scarfCream from "@/assets/item-scarf-cream.jpg";
import turtleneckCream from "@/assets/item-turtleneck-cream.jpg";
import skiSweater from "@/assets/item-ski-sweater.jpg";
import sundress from "@/assets/item-sundress.jpg";
import leatherPants from "@/assets/item-leather-pants.jpg";
import shearlingDenim from "@/assets/item-shearling-denim.jpg";
import vaultLace from "@/assets/item-vault-lace.jpg";
import vaultTee from "@/assets/item-vault-tee.jpg";
import vaultCoat from "@/assets/item-vault-coat.jpg";
import departingSequin from "@/assets/item-departing-sequin.jpg";
import departingJeans from "@/assets/item-departing-jeans.jpg";
import departingPuffer from "@/assets/item-departing-puffer.jpg";

export type Category = "Tops" | "Bottoms" | "Dresses" | "Sweaters" | "Shoes" | "Accessories" | "Outerwear";
export const CATEGORIES: Category[] = ["Tops", "Bottoms", "Dresses", "Sweaters", "Shoes", "Accessories", "Outerwear"];

export type Season = "Warm" | "Cold" | "Year-round";
export const SEASONS: Season[] = ["Warm", "Cold", "Year-round"];

export const POPULAR_BRANDS: string[] = [
  "& Other Stories", "A.P.C.", "Acne Studios", "Agolde", "Anine Bing",
  "Aquazzura", "Aritzia", "ARKET", "Ba&sh", "Balenciaga",
  "Banana Republic", "Bottega Veneta", "Burberry", "By Malene Birger",
  "Celine", "Chanel", "Christian Louboutin", "Club Monaco", "Common Projects",
  "COS", "Demellier", "Diane von Furstenberg", "Dior", "DL1961",
  "Doên", "Equipment", "Everlane", "Faithfull the Brand", "Frame",
  "Frank & Eileen", "Free People", "Ganni", "Givenchy", "Gucci",
  "Hermès", "Isabel Marant", "J.Crew", "Jacquemus", "Janessa Leoné",
  "Kenzo", "Khaite", "Levi's", "Loewe", "Louis Vuitton",
  "Madewell", "Maison Margiela", "Mango", "Massimo Dutti", "Max Mara",
  "Mejuri", "Miu Miu", "Nanushka", "Nili Lotan", "Officine Générale",
  "Polène", "Polo Ralph Lauren", "Prada", "Rag & Bone", "Réalisation Par",
  "Reformation", "Rhode", "Rotate", "Saint Laurent", "Sandy Liang",
  "Sandro", "Sea New York", "Sézane", "Sir.", "Sophie Buhai",
  "The Row", "Theory", "Tibi", "Tom Ford", "Tommy Hilfiger",
  "Toteme", "Uniqlo", "Valentino", "Versace", "Vince",
  "Vintage", "Zara",
];

export type ItemStatus = "active" | "archived" | "departing" | "vault";

export interface MemoryMeta {
  story: string;
  occasion?: string;
  person?: string;
}

export type DepartingIntent = "sell" | "giveaway" | "donate";

export interface DepartingMeta {
  intent: DepartingIntent;
  listed?: boolean;
  price?: string;
  notes?: string;
}

export interface Item {
  id: string;
  name: string;
  brand?: string;
  color?: string;
  category: Category;
  season: Season;
  image: string;
  createdAt: number;
  status?: ItemStatus;
  favorite?: boolean;
  memory?: MemoryMeta;
  departing?: DepartingMeta;
}

/** Returns the effective status, defaulting to "active" for legacy items. */
export function itemStatus(i: Item): ItemStatus {
  return i.status ?? "active";
}

export interface Folder {
  id: string;
  name: string;
  cover?: string;
  itemIds: string[];
  createdAt: number;
  destination?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  dayAssignments?: Record<string, string[]>; // date (YYYY-MM-DD) -> itemIds for daytime
  nightAssignments?: Record<string, string[]>; // date (YYYY-MM-DD) -> itemIds for evening
}

export type DaySlot = "day" | "night";

interface ClosetState {
  items: Item[];
  folders: Folder[];
  wishlist: WishItem[];
}

export interface WishItem {
  id: string;
  url: string;
  title: string;
  image?: string;
  brand?: string;
  description?: string;
  price?: string;
  createdAt: number;
}


const KEY = "vesti.closet.v9";

const t = Date.now();
const seed: ClosetState = {
  items: [
    // Tops
    { id: "i1", name: "Ribbed Cashmere Knit", brand: "The Row", color: "Sage", category: "Tops", season: "Cold", image: sweater, createdAt: t - 5e7 },
    { id: "i2", name: "Satin Slip Midi", brand: "Toteme", color: "Mint", category: "Tops", season: "Warm", image: dress, createdAt: t - 4.9e7 },
    { id: "i3", name: "Poplin Button-Down", brand: "Frank & Eileen", color: "Ivory", category: "Tops", season: "Year-round", image: shirt, createdAt: t - 4.8e7 },
    { id: "i4", name: "Silk Charmeuse Blouse", brand: "Vince", color: "Champagne", category: "Tops", season: "Year-round", image: outfitBlouse, createdAt: t - 4.7e7 },
    { id: "i6", name: "Merino Turtleneck", brand: "Everlane", color: "Cream", category: "Tops", season: "Cold", image: turtleneckCream, createdAt: t - 4.5e7 },
    { id: "i21", name: "Butter Silk Slip Dress", brand: "Réalisation Par", color: "Butter", category: "Tops", season: "Warm", image: slipButter, createdAt: t - 4.45e7 },
    { id: "i22", name: "Crochet Halter Crop", brand: "Sir.", color: "Ivory", category: "Tops", season: "Warm", image: crochetTop, createdAt: t - 4.4e7 },
    { id: "i23", name: "Ribbed Knit Set", brand: "Faithfull the Brand", color: "Cream", category: "Tops", season: "Year-round", image: knitSet, createdAt: t - 4.35e7 },
    { id: "i24", name: "Sequin Mini Dress", brand: "Rotate", color: "Onyx", category: "Tops", season: "Year-round", image: sequinMini, createdAt: t - 4.32e7 },

    // Bottoms
    { id: "i7", name: "Cream Wide-Leg Trousers", brand: "Toteme", color: "Cream", category: "Bottoms", season: "Year-round", image: trousers, createdAt: t - 4.3e7 },
    { id: "i8", name: "Straight Vintage Denim", brand: "Agolde", color: "Indigo", category: "Bottoms", season: "Year-round", image: jeans, createdAt: t - 4.28e7 },
    { id: "i9", name: "Pleated Midi Skirt", brand: "Reformation", color: "Sage", category: "Bottoms", season: "Warm", image: skirt, createdAt: t - 4.26e7 },
    { id: "i10", name: "Tailored Trouser", brand: "Khaite", color: "Charcoal", category: "Bottoms", season: "Cold", image: outfitTrousers, createdAt: t - 4.24e7 },
    { id: "i25", name: "Denim Maxi Skirt", brand: "DL1961", color: "Light Wash", category: "Bottoms", season: "Year-round", image: denimMaxi, createdAt: t - 4.22e7 },
    { id: "i26", name: "Leather Mini Skirt", brand: "Reformation", color: "Black", category: "Bottoms", season: "Year-round", image: leatherSkirt, createdAt: t - 4.2e7 },

    // Outerwear
    { id: "i11", name: "Double-Breasted Trench", brand: "Burberry", color: "Camel", category: "Outerwear", season: "Year-round", image: trench, createdAt: t - 4.18e7 },
    { id: "i12", name: "Ivory Wool Blazer", brand: "Anine Bing", color: "Ivory", category: "Outerwear", season: "Year-round", image: blazer, createdAt: t - 4.16e7 },
    { id: "i13", name: "Wool Topcoat", brand: "Max Mara", color: "Camel", category: "Outerwear", season: "Cold", image: topcoatCamel, createdAt: t - 4.14e7 },
    { id: "i27", name: "Sage Linen Blazer", brand: "Reformation", color: "Sage", category: "Outerwear", season: "Warm", image: blazerSage, createdAt: t - 4.12e7 },

    // Shoes
    { id: "i14", name: "Pointed Ankle Boots", brand: "Khaite", color: "Espresso", category: "Shoes", season: "Cold", image: boots, createdAt: t - 4.1e7 },
    { id: "i15", name: "Leather Sneakers", brand: "Common Projects", color: "White", category: "Shoes", season: "Year-round", image: sneakers, createdAt: t - 4.08e7 },
    { id: "i16", name: "Strappy Sandals", brand: "The Row", color: "Tan", category: "Shoes", season: "Warm", image: sandalsTan, createdAt: t - 4.06e7 },
    { id: "i28", name: "Ribbon Ballet Flats", brand: "Sandy Liang", color: "Red", category: "Shoes", season: "Year-round", image: flatsRed, createdAt: t - 4.04e7 },
    { id: "i29", name: "Lace-Up Stiletto Sandals", brand: "Aquazzura", color: "Black", category: "Shoes", season: "Warm", image: heelsBlack, createdAt: t - 4.02e7 },

    // Accessories
    { id: "i17", name: "Structured Mini Bag", brand: "Polène", color: "Sage", category: "Accessories", season: "Year-round", image: bag, createdAt: t - 4e7 },
    { id: "i18", name: "Tortoise Sunglasses", brand: "Celine", color: "Tortoise", category: "Accessories", season: "Warm", image: sunglasses, createdAt: t - 3.98e7 },
    { id: "i19", name: "Gold Hoop Earrings", brand: "Mejuri", color: "Gold", category: "Accessories", season: "Year-round", image: outfitJewelry, createdAt: t - 3.96e7 },
    { id: "i20", name: "Cashmere Scarf", brand: "Acne Studios", color: "Cream", category: "Accessories", season: "Cold", image: scarfCream, createdAt: t - 3.94e7 },
    { id: "i30", name: "Chocolate Chain Bag", brand: "Demellier", color: "Chocolate", category: "Accessories", season: "Year-round", image: bagChocolate, createdAt: t - 3.92e7 },
    { id: "i31", name: "Layered Gold & Pearl Set", brand: "Sophie Buhai", color: "Gold", category: "Accessories", season: "Year-round", image: necklaces, createdAt: t - 3.9e7 },
    { id: "i32", name: "Wide-Brim Straw Hat", brand: "Janessa Leoné", color: "Natural", category: "Accessories", season: "Warm", image: strawHat, createdAt: t - 3.88e7 },

    // Archived — paused, between seasons or sizes
    { id: "a1", name: "Alpine Cable Knit", brand: "Sézane", color: "Burgundy", category: "Tops", season: "Cold", image: skiSweater, createdAt: t - 3.8e7, status: "archived" },
    { id: "a2", name: "Peach Floral Sundress", brand: "Doên", color: "Peach", category: "Tops", season: "Warm", image: sundress, createdAt: t - 3.78e7, status: "archived" },
    { id: "a3", name: "Cognac Leather Pant", brand: "Nili Lotan", color: "Cognac", category: "Bottoms", season: "Cold", image: leatherPants, createdAt: t - 3.76e7, status: "archived" },
    { id: "a4", name: "Shearling Denim Jacket", brand: "Levi's Made & Crafted", color: "Indigo", category: "Outerwear", season: "Cold", image: shearlingDenim, createdAt: t - 3.74e7, status: "archived" },

    // Departing — leaving the wardrobe: sell, giveaway, or donate
    { id: "d1", name: "Black Sequin Mini", brand: "Rotate", color: "Black", category: "Tops", season: "Year-round", image: departingSequin, createdAt: t - 3.72e7, status: "departing", departing: { intent: "sell", listed: true, price: "£85", notes: "Listed on Vinted — worn twice." } },
    { id: "d2", name: "Indigo Straight Jeans", brand: "Levi's", color: "Indigo", category: "Bottoms", season: "Year-round", image: departingJeans, createdAt: t - 3.71e7, status: "departing", departing: { intent: "giveaway", notes: "Promised to Maya — pickup this weekend." } },
    { id: "d3", name: "Cropped Sage Puffer", brand: "Ganni", color: "Sage", category: "Outerwear", season: "Cold", image: departingPuffer, createdAt: t - 3.7e7, status: "departing", departing: { intent: "donate", notes: "Bag for the charity shop run." } },

    // Memory Vault — kept for what they meant
    { id: "v1", name: "Ivory Lace Slip", brand: "Vintage", color: "Ivory", category: "Tops", season: "Warm", image: vaultLace, createdAt: t - 3.68e7, status: "vault", memory: { story: "Mum's rehearsal dinner dress from 1989. She handed it to me the morning of my own.", occasion: "Wedding weekend", person: "Mum" } },
    { id: "v2", name: "Faded Tour Tee", brand: "Vintage", color: "Washed Black", category: "Tops", season: "Year-round", image: vaultTee, createdAt: t - 3.66e7, status: "vault", memory: { story: "First concert with Liv. We slept in the car and woke up sunburnt and happy.", occasion: "Summer '19", person: "Liv" } },
    { id: "v3", name: "Heirloom Camel Coat", brand: "Aquascutum", color: "Camel", category: "Outerwear", season: "Cold", image: vaultCoat, createdAt: t - 3.64e7, status: "vault", memory: { story: "Grandma's. Still smells faintly like her perfume in the lining.", person: "Grandma Rose" } },
  ],
  folders: (() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const inDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };
    return [
      {
        id: "f1",
        name: "Cannes Trip",
        cover: folderBeach,
        itemIds: ["i21", "i22", "i9", "i29", "i18", "i30", "i32"],
        createdAt: t - 1e7,
        destination: "Cannes",
        startDate: inDays(3),
        endDate: inDays(7),
      },
      { id: "f2", name: "Work Capsule", cover: folderWork, itemIds: ["i3", "i7", "i12", "i15", "i27", "i30"], createdAt: t - 9e6 },
      {
        id: "f3",
        name: "Bridal Weekend",
        itemIds: ["i4", "i12", "i29", "i31", "i17", "i23"],
        createdAt: t - 8e6,
      },
      {
        id: "f4",
        name: "Bachelorette Trip",
        itemIds: ["i24", "i21", "i26", "i29", "i28", "i30", "i31", "i18"],
        createdAt: t - 7e6,
        destination: "Miami",
        startDate: inDays(14),
        endDate: inDays(17),
      },
    ];
  })(),
  wishlist: [
    {
      id: "w-seed-celine-teen",
      url: "https://www.celine.com/en-us/celine-shop-women/bags-and-small-leather-goods/teen-luggage/",
      title: "Teen Luggage in Grained Calfskin",
      brand: "Celine",
      image: wishCelineLuggage,
      description: "Iconic Teen Luggage handbag in supple tan grained calfskin.",
      createdAt: t - 1e6,
    },
  ],
};


function load(): ClosetState {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<ClosetState>;
    return { items: seed.items, folders: seed.folders, wishlist: [], ...parsed };
  } catch {
    return seed;
  }
}


let state: ClosetState = typeof window !== "undefined" ? load() : seed;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — strip base64 images from user-added items and retry
    const stripped = {
      ...state,
      items: state.items.map((i) =>
        i.image.startsWith("data:") ? { ...i, image: "" } : i,
      ),
    };
    try { localStorage.setItem(KEY, JSON.stringify(stripped)); } catch { /* give up */ }
  }
  listeners.forEach((l) => l());
}

function setState(next: ClosetState) {
  state = next;
  persist();
}

export const closet = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get() {
    return state;
  },
  /** Called by AuthProvider when user logs in/out. Loads cloud data into the store. */
  async syncUser(userId: string | null) {
    setDbUser(userId);
    if (!userId) {
      // Signed out — restore seed/local data
      setState(load());
      return;
    }
    const data = await fetchUserData(userId);
    // Authenticated users always see only their own items (empty closet for new users)
    setState({ items: data.items, folders: data.folders, wishlist: data.wishlist });
  },
  addItem(input: Omit<Item, "id" | "createdAt">) {
    const item: Item = { status: "active", ...input, id: crypto.randomUUID(), createdAt: Date.now() };
    setState({ ...state, items: [item, ...state.items] });
    dbUpsertItem(item);
    return item;
  },
  updateItem(id: string, patch: Partial<Pick<Item, "name" | "brand" | "color" | "category" | "season" | "image">>) {
    setState({ ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
    const updated = state.items.find((i) => i.id === id);
    if (updated) dbUpsertItem({ ...updated, ...patch });
  },
  setItemStatus(id: string, status: ItemStatus, extras?: { memory?: MemoryMeta; departing?: DepartingMeta }) {
    setState({
      ...state,
      items: state.items.map((i) =>
        i.id === id
          ? {
              ...i,
              status,
              memory: status === "vault" ? (extras?.memory ?? i.memory) : undefined,
              departing: status === "departing" ? (extras?.departing ?? i.departing) : undefined,
            }
          : i,
      ),
    });
    const updated = state.items.find((i) => i.id === id);
    if (updated) dbUpsertItem({ ...updated, status, memory: status === "vault" ? (extras?.memory ?? updated.memory) : undefined, departing: status === "departing" ? (extras?.departing ?? updated.departing) : undefined });
  },
  toggleFavorite(id: string) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    const next = { ...item, favorite: !item.favorite };
    setState({ ...state, items: state.items.map((i) => i.id === id ? next : i) });
    dbUpsertItem(next);
  },
  updateMemory(id: string, memory: MemoryMeta) {
    setState({
      ...state,
      items: state.items.map((i) => (i.id === id ? { ...i, memory } : i)),
    });
    const updated = state.items.find((i) => i.id === id);
    if (updated) dbUpsertItem({ ...updated, memory });
  },
  updateDeparting(id: string, departing: DepartingMeta) {
    setState({
      ...state,
      items: state.items.map((i) => (i.id === id ? { ...i, departing } : i)),
    });
    const updated = state.items.find((i) => i.id === id);
    if (updated) dbUpsertItem({ ...updated, departing });
  },
  removeItem(id: string) {
    setState({
      ...state,
      items: state.items.filter((i) => i.id !== id),
      folders: state.folders.map((f) => {
        const strip = (rec?: Record<string, string[]>) =>
          rec ? Object.fromEntries(Object.entries(rec).map(([d, ids]) => [d, ids.filter((x) => x !== id)])) : undefined;
        return {
          ...f,
          itemIds: f.itemIds.filter((x) => x !== id),
          dayAssignments: strip(f.dayAssignments),
          nightAssignments: strip(f.nightAssignments),
        };
      }),
    });
    dbDeleteItem(id);
  },

  toggleItemOnDay(folderId: string, date: string, itemId: string, slot: DaySlot = "day") {
    const folder = state.folders.find((f) => f.id === folderId);
    if (!folder) return;
    const key = slot === "night" ? "nightAssignments" : "dayAssignments";
    const existing = (folder[key] as Record<string, string[]> | undefined)?.[date] ?? [];
    const isAdding = !existing.includes(itemId);
    setState({
      ...state,
      folders: state.folders.map((f) => {
        if (f.id !== folderId) return f;
        const rec = { ...((f[key] as Record<string, string[]> | undefined) ?? {}) };
        const day = rec[date] ?? [];
        rec[date] = isAdding ? [...day, itemId] : day.filter((x) => x !== itemId);
        const itemIds = isAdding && !f.itemIds.includes(itemId) ? [...f.itemIds, itemId] : f.itemIds;
        return { ...f, itemIds, [key]: rec };
      }),
    });
    if (isAdding) wearLog.log({ date, itemIds: [itemId] });
    const updated = state.folders.find((f) => f.id === folderId);
    if (updated) dbUpsertFolder(updated);
  },
  createFolder(name: string) {
    const folder: Folder = { id: crypto.randomUUID(), name, itemIds: [], createdAt: Date.now() };
    setState({ ...state, folders: [folder, ...state.folders] });
    dbUpsertFolder(folder);
    return folder;
  },
  toggleItemInFolder(folderId: string, itemId: string) {
    setState({
      ...state,
      folders: state.folders.map((f) =>
        f.id === folderId
          ? { ...f, itemIds: f.itemIds.includes(itemId) ? f.itemIds.filter((x) => x !== itemId) : [...f.itemIds, itemId] }
          : f,
      ),
    });
    const updated = state.folders.find((f) => f.id === folderId);
    if (updated) dbUpsertFolder(updated);
  },
  addItemsToFolder(folderId: string, itemIds: string[]) {
    setState({
      ...state,
      folders: state.folders.map((f) =>
        f.id === folderId
          ? { ...f, itemIds: Array.from(new Set([...f.itemIds, ...itemIds])) }
          : f,
      ),
    });
    const updated = state.folders.find((f) => f.id === folderId);
    if (updated) dbUpsertFolder(updated);
  },
  deleteFolder(id: string) {
    setState({ ...state, folders: state.folders.filter((f) => f.id !== id) });
    dbDeleteFolder(id);
  },
  updateFolder(id: string, patch: Partial<Pick<Folder, "name" | "destination" | "startDate" | "endDate">>) {
    setState({
      ...state,
      folders: state.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
    const updated = state.folders.find((f) => f.id === id);
    if (updated) dbUpsertFolder({ ...updated, ...patch });
  },
  addWish(input: Omit<WishItem, "id" | "createdAt">) {
    // Dedupe by URL
    if (state.wishlist.some((w) => w.url === input.url)) return null;
    const w: WishItem = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
    setState({ ...state, wishlist: [w, ...(state.wishlist ?? [])] });
    dbUpsertWish(w);
    return w;
  },
  removeWish(id: string) {
    setState({ ...state, wishlist: (state.wishlist ?? []).filter((w) => w.id !== id) });
    dbDeleteWish(id);
  },
  updateWish(id: string, patch: Partial<Pick<WishItem, "image" | "title" | "brand" | "description">>) {
    const updated = (state.wishlist ?? []).map((w) => w.id === id ? { ...w, ...patch } : w);
    setState({ ...state, wishlist: updated });
    const w = updated.find((x) => x.id === id);
    if (w) dbUpsertWish(w);
  },
  hasWishUrl(url: string) {
    return (state.wishlist ?? []).some((w) => w.url === url);
  },
  promoteWishToCloset(id: string, category: Category = "Tops", season: Season = "Year-round") {
    const w = (state.wishlist ?? []).find((x) => x.id === id);
    if (!w) return;
    const item: Item = {
      id: crypto.randomUUID(),
      name: w.title,
      brand: w.brand,
      category,
      season,
      image: w.image || "",
      createdAt: Date.now(),
    };
    setState({
      ...state,
      items: [item, ...state.items],
      wishlist: state.wishlist.filter((x) => x.id !== id),
    });
    dbUpsertItem(item);
    dbDeleteWish(id);
  },
};


export function useCloset() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    state = load();
    setHydrated(true);
    listeners.forEach((l) => l());
  }, []);
  const snap = useSyncExternalStore(
    (cb) => closet.subscribe(cb),
    () => state,
    () => seed,
  );
  return { ...snap, hydrated };
}
