/**
 * Supabase persistence layer for the closet store.
 * All functions are fire-and-forget safe — callers don't need to await them.
 */
import { supabase } from "@/lib/supabase";
import type { Item, Folder, WishItem } from "./store";

// ── Row mappers ──────────────────────────────────────────────────────────────

function itemToRow(item: Item, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    name: item.name,
    brand: item.brand ?? null,
    color: item.color ?? null,
    category: item.category,
    season: item.season,
    image: item.image,
    created_at: item.createdAt,
    status: item.status ?? "active",
    memory: item.memory ?? null,
    departing: item.departing ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(row: any): Item {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    color: row.color ?? undefined,
    category: row.category,
    season: row.season,
    image: row.image,
    createdAt: row.created_at,
    status: row.status ?? "active",
    memory: row.memory ?? undefined,
    departing: row.departing ?? undefined,
  };
}

function folderToRow(folder: Folder, userId: string) {
  return {
    id: folder.id,
    user_id: userId,
    name: folder.name,
    cover: folder.cover ?? null,
    item_ids: folder.itemIds,
    created_at: folder.createdAt,
    destination: folder.destination ?? null,
    start_date: folder.startDate ?? null,
    end_date: folder.endDate ?? null,
    day_assignments: folder.dayAssignments ?? null,
    night_assignments: folder.nightAssignments ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFolder(row: any): Folder {
  return {
    id: row.id,
    name: row.name,
    cover: row.cover ?? undefined,
    itemIds: row.item_ids ?? [],
    createdAt: row.created_at,
    destination: row.destination ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    dayAssignments: row.day_assignments ?? undefined,
    nightAssignments: row.night_assignments ?? undefined,
  };
}

function wishToRow(wish: WishItem, userId: string) {
  return {
    id: wish.id,
    user_id: userId,
    url: wish.url,
    title: wish.title,
    image: wish.image ?? null,
    brand: wish.brand ?? null,
    description: wish.description ?? null,
    created_at: wish.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWish(row: any): WishItem {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    image: row.image ?? undefined,
    brand: row.brand ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Fetch all user data ──────────────────────────────────────────────────────

export async function fetchUserData(userId: string) {
  const [itemsRes, foldersRes, wishlistRes] = await Promise.all([
    supabase.from("items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("folders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("wishlist").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return {
    items: (itemsRes.data ?? []).map(rowToItem),
    folders: (foldersRes.data ?? []).map(rowToFolder),
    wishlist: (wishlistRes.data ?? []).map(rowToWish),
  };
}

// ── Targeted writes (fire-and-forget) ────────────────────────────────────────

let _userId: string | null = null;

export function setDbUser(userId: string | null) {
  _userId = userId;
}

export function dbUpsertItem(item: Item) {
  if (!_userId) return;
  void supabase.from("items").upsert(itemToRow(item, _userId));
}

export function dbDeleteItem(id: string) {
  if (!_userId) return;
  void supabase.from("items").eq("id", id).delete();
}

export function dbUpsertFolder(folder: Folder) {
  if (!_userId) return;
  void supabase.from("folders").upsert(folderToRow(folder, _userId));
}

export function dbDeleteFolder(id: string) {
  if (!_userId) return;
  void supabase.from("folders").eq("id", id).delete();
}

export function dbUpsertWish(wish: WishItem) {
  if (!_userId) return;
  void supabase.from("wishlist").upsert(wishToRow(wish, _userId));
}

export function dbDeleteWish(id: string) {
  if (!_userId) return;
  void supabase.from("wishlist").eq("id", id).delete();
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function fetchUserProfile(userId: string): Promise<Record<string, unknown> | null> {
  const res = await supabase.from("profiles").select("data").eq("user_id", userId);
  const row = ((res.data ?? []) as Array<{ data?: Record<string, unknown> }>)[0];
  return row?.data ?? null;
}

export function dbUpsertProfile(profile: object) {
  if (!_userId) return;
  void supabase.from("profiles").upsert({
    user_id: _userId,
    data: profile,
    updated_at: new Date().toISOString(),
  });
}
