// Applies supabase/migrations/*.sql, then supabase/seed.sql, then draws any
// missing legs through OSRM. Safe to re-run.
//   node scripts/db-apply.mjs            migrations + seed + legs
//   node scripts/db-apply.mjs --no-seed  migrations + legs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { config } from "dotenv";
import { routeLeg } from "../lib/routing.ts";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, onnotice: () => {} });

try {
  const dir = "supabase/migrations";
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    console.log(`migrate  ${f}`);
    await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  }
  if (!process.argv.includes("--no-seed")) {
    console.log("seed     supabase/seed.sql");
    await sql.unsafe(readFileSync("supabase/seed.sql", "utf8"));
  }
  await rebuildAllLegs();
  const [{ n }] = await sql`select count(*)::int as n from countries`;
  console.log(`done     ${n} countries`);
} finally {
  await sql.end();
}

async function rebuildAllLegs() {
  const expeditions = await sql`select id from expeditions where deleted_at is null`;
  for (const { id } of expeditions) {
    const stops = await sql`
      select id, lat, lng, arrival_mode from stops
      where expedition_id = ${id} and deleted_at is null
      order by arrived_on, created_at`;
    const keep = [];
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1];
      const b = stops[i];
      const [existing] = await sql`select id, mode from legs where from_stop_id = ${a.id} and to_stop_id = ${b.id}`;
      if (existing && existing.mode === b.arrival_mode) {
        keep.push(existing.id);
        continue;
      }
      const r = await routeLeg([a.lng, a.lat], [b.lng, b.lat], b.arrival_mode);
      const [leg] = await sql`
        insert into legs (expedition_id, from_stop_id, to_stop_id, mode, geometry, distance_km, is_fallback)
        values (${id}, ${a.id}, ${b.id}, ${b.arrival_mode}, ${sql.json(r.geometry)}, ${r.distanceKm}, ${r.isFallback})
        on conflict (from_stop_id, to_stop_id) do update set
          mode = excluded.mode, geometry = excluded.geometry,
          distance_km = excluded.distance_km, is_fallback = excluded.is_fallback
        returning id`;
      keep.push(leg.id);
      console.log(`leg      ${r.distanceKm} km${r.isFallback ? " (straight-line fallback)" : ""}`);
    }
    if (keep.length) await sql`delete from legs where expedition_id = ${id} and id not in ${sql(keep)}`;
    else await sql`delete from legs where expedition_id = ${id}`;
  }
}
