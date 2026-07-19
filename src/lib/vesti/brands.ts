import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { POPULAR_BRANDS } from "@/lib/vesti/store";

// Brand names for the "add item" / "edit item" autocomplete, sourced from the
// shared `public.brands` reference table (see
// supabase/migrations/20260719_create_brands_table.sql) instead of the old
// hardcoded POPULAR_BRANDS list. Fetched once per session and cached in
// memory; falls back to POPULAR_BRANDS if the table can't be reached (e.g.
// offline) so the field still works.

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

async function loadBrandNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("name")
    .order("name", { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "Failed to load brands");
  const names = (data as { name: string }[]).map((row) => row.name);
  if (names.length === 0) throw new Error("Brands table is empty");
  return names;
}

export function fetchBrandNames(): Promise<string[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = loadBrandNames()
      .then((names) => {
        cache = names;
        return names;
      })
      .catch(() => POPULAR_BRANDS)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Validate an AI-guessed brand name against the known `public.brands` list so
 * a vision model can't silently write a hallucinated brand into an item —
 * only names that actually match something in the table are accepted.
 * Tries an exact case-insensitive match first, then falls back to a loose
 * substring match (e.g. a model saying "Ralph Lauren" matching the table's
 * "Polo Ralph Lauren"). Returns the table's canonical spelling, or null if
 * nothing in the list plausibly matches.
 */
export async function matchKnownBrand(guess: string | null | undefined): Promise<string | null> {
  const g = (guess ?? "").trim().toLowerCase();
  if (!g) return null;
  const names = await fetchBrandNames();
  const exact = names.find((n) => n.toLowerCase() === g);
  if (exact) return exact;
  const loose = names.find((n) => {
    const nl = n.toLowerCase();
    return nl.includes(g) || g.includes(nl);
  });
  return loose ?? null;
}

/** Brand name list for autocomplete — starts with POPULAR_BRANDS, then swaps
 * in the full Supabase brand list once it loads. */
export function useBrandNames(): string[] {
  const [names, setNames] = useState<string[]>(cache ?? POPULAR_BRANDS);
  useEffect(() => {
    let alive = true;
    void fetchBrandNames().then((loaded) => {
      if (alive) setNames(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);
  return names;
}
