#!/usr/bin/env node
/**
 * Upload brand seed rows from the SQL migration into public.brands.
 *
 * Source: supabase/migrations/20260719_create_brands_table.sql
 *
 * Requires a service-role key (anon cannot write — RLS is select-only):
 *   SUPABASE_URL              (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-brands.mjs
 *   npm run upload:brands
 *
 * Safe to re-run: uses Prefer: resolution=ignore-duplicates on name.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

const SUPABASE_URL = (
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  ""
).replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const MIGRATION = resolve(
  ROOT,
  "supabase/migrations/20260719_create_brands_table.sql",
);
const BATCH_SIZE = 200;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  process.exit(1);
}
if (!SERVICE_KEY && !DRY_RUN) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Get it from Supabase → Project Settings → API → service_role (secret).\n" +
      "Pass it as an env var; do not commit it.",
  );
  process.exit(1);
}

const brands = parseBrandsFromSql(readFileSync(MIGRATION, "utf8"));
console.log(`Parsed ${brands.length} brands from ${MIGRATION}`);

if (DRY_RUN) {
  const byCat = new Map();
  for (const b of brands) byCat.set(b.category, (byCat.get(b.category) ?? 0) + 1);
  console.log("Categories:");
  for (const [cat, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${n}`);
  }
  console.log("Sample:", brands.slice(0, 5));
  process.exit(0);
}

let inserted = 0;
let skipped = 0;

for (let i = 0; i < brands.length; i += BATCH_SIZE) {
  const batch = brands.slice(i, i + BATCH_SIZE);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/brands?on_conflict=name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Batch starting at ${i} failed (${res.status}):`, err);
    process.exit(1);
  }

  const rows = await res.json();
  const wrote = Array.isArray(rows) ? rows.length : 0;
  inserted += wrote;
  skipped += batch.length - wrote;
  console.log(
    `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${wrote} inserted, ${batch.length - wrote} already present`,
  );
}

const countRes = await fetch(
  `${SUPABASE_URL}/rest/v1/brands?select=id`,
  {
    method: "HEAD",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "count=exact",
    },
  },
);
const total = countRes.headers.get("content-range")?.split("/")[1] ?? "?";

console.log(`Done. Inserted ${inserted}, skipped ${skipped} duplicates. Table now has ${total} rows.`);

function parseBrandsFromSql(sql) {
  const match = sql.match(
    /insert into public\.brands \(name, category\)\s*values\s*([\s\S]*?)on conflict/i,
  );
  if (!match) {
    throw new Error("Could not find INSERT ... VALUES block in migration SQL");
  }

  const rows = [];
  const re = /\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g;
  let m;
  while ((m = re.exec(match[1]))) {
    rows.push({
      name: m[1].replace(/''/g, "'"),
      category: m[2].replace(/''/g, "'"),
    });
  }
  if (rows.length === 0) {
    throw new Error("Parsed 0 brand rows from migration SQL");
  }
  return rows;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
