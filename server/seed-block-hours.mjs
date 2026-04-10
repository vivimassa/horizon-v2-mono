/**
 * Seed block hours from V1 (Supabase) into V2 (Fastify API).
 *
 * Reads city_pairs + city_pair_block_hours from Supabase,
 * matches to V2 city pairs by IATA codes, deduplicates, and POSTs.
 *
 * Usage: node seed-block-hours.mjs
 */

import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:3002";
const SUPABASE_URL = "https://qfaanyjjikvaubjnvqgb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYWFueWpqaWt2YXViam52cWdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk4OTQ5NSwiZXhwIjoyMDg2NTY1NDk1fQ.aSYvRhG95BFgLBbSrmvIiebF97bxekPiP74Qzvvy0Rc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// V1 icao_type "320" → V2 icaoCode "A320"
const ICAO_MAP = { "320": "A320", "321": "A321", "787": "B787", "350": "A350", "330": "A330", "380": "A380" };

async function fetchAll(table, select = "*") {
  const all = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  console.log("── Fetching V1 data from Supabase ──");

  // 1. Fetch V1 data
  const [v1CityPairs, v1BlockHours, v1AircraftTypes] = await Promise.all([
    fetchAll("city_pairs", "id, departure_airport, arrival_airport, standard_block_minutes"),
    fetchAll("city_pair_block_hours"),
    fetchAll("aircraft_types", "id, icao_type"),
  ]);

  console.log(`  V1 city pairs: ${v1CityPairs.length}`);
  console.log(`  V1 block hours: ${v1BlockHours.length}`);
  console.log(`  V1 aircraft types: ${v1AircraftTypes.length}`);

  // Build lookup maps
  const v1TypeMap = {};
  v1AircraftTypes.forEach((a) => (v1TypeMap[a.id] = ICAO_MAP[a.icao_type] || `A${a.icao_type}`));

  const v1CpMap = {};
  v1CityPairs.forEach((c) => (v1CpMap[c.id] = c));

  // 2. Group block hours by city pair IATA pair + aircraft type, deduplicate (keep last)
  const grouped = {}; // key: "DEP-ARR" → { "A320|annual": { ... } }
  for (const bh of v1BlockHours) {
    const cp = v1CpMap[bh.city_pair_id];
    if (!cp) continue;
    const pairKey = cp.departure_airport + "-" + cp.arrival_airport;
    const acType = v1TypeMap[bh.aircraft_type_id] || null;
    const dedupeKey = (acType || "ALL") + "|" + bh.season_type;

    if (!grouped[pairKey]) grouped[pairKey] = {};
    // Last write wins (deduplication)
    grouped[pairKey][dedupeKey] = {
      aircraftTypeIcao: acType,
      seasonType: bh.season_type || "annual",
      dir1BlockMinutes: bh.direction1_block_minutes,
      dir2BlockMinutes: bh.direction2_block_minutes,
      dir1FlightMinutes: bh.direction1_flight_minutes || null,
      dir2FlightMinutes: bh.direction2_flight_minutes || null,
      dir1FuelKg: bh.direction1_fuel_kg || null,
      dir2FuelKg: bh.direction2_fuel_kg || null,
    };
  }

  // Also add standard_block_minutes as a generic "All" entry where no block hours exist
  for (const cp of v1CityPairs) {
    if (cp.standard_block_minutes == null) continue;
    const pairKey = cp.departure_airport + "-" + cp.arrival_airport;
    if (!grouped[pairKey]) grouped[pairKey] = {};
    // Only add "All|annual" if no entries exist for this pair yet
    if (!grouped[pairKey]["ALL|annual"]) {
      grouped[pairKey]["ALL|annual"] = {
        aircraftTypeIcao: null,
        seasonType: "annual",
        dir1BlockMinutes: cp.standard_block_minutes,
        dir2BlockMinutes: cp.standard_block_minutes,
      };
    }
  }

  const pairsToSeed = Object.keys(grouped).length;
  const entriesToSeed = Object.values(grouped).reduce((sum, g) => sum + Object.keys(g).length, 0);
  console.log(`\n── Deduplicated: ${entriesToSeed} entries across ${pairsToSeed} city pairs ──`);

  // 3. Fetch V2 city pairs (no operatorId filter — get all)
  console.log("\n── Fetching V2 city pairs ──");
  const v2Res = await fetch(BASE + "/city-pairs");
  const v2CityPairs = await v2Res.json();
  console.log(`  V2 city pairs: ${v2CityPairs.length}`);

  // Build V2 lookup by IATA pair (both directions)
  const v2Map = {};
  for (const cp of v2CityPairs) {
    const iata1 = cp.station1Iata || "";
    const iata2 = cp.station2Iata || "";
    if (iata1 && iata2) {
      v2Map[iata1 + "-" + iata2] = cp;
      v2Map[iata2 + "-" + iata1] = cp;
    }
  }

  // 4. Seed block hours
  console.log("\n── Seeding block hours ──");
  let added = 0, skipped = 0, notFound = 0, errors = 0;

  for (const [pairKey, entries] of Object.entries(grouped)) {
    const [dep, arr] = pairKey.split("-");
    const v2Cp = v2Map[dep + "-" + arr];

    if (!v2Cp) {
      notFound++;
      continue;
    }

    // Check existing block hours to avoid duplicates
    const existingKeys = new Set(
      (v2Cp.blockHours || []).map(
        (bh) => (bh.aircraftTypeIcao || "ALL") + "|" + bh.seasonType
      )
    );

    // Determine direction: V1 stores dep→arr as dir1. V2 stores station1→station2 as dir1.
    // station1 is alphabetically first ICAO. We need to check if V1's dep matches V2's station1.
    const v2Iata1 = v2Cp.station1Iata || "";
    const needSwap = dep !== v2Iata1;

    for (const [dedupeKey, entry] of Object.entries(entries)) {
      if (existingKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      // Swap directions if V1 dep→arr doesn't match V2 station1→station2
      const payload = needSwap
        ? {
            ...entry,
            dir1BlockMinutes: entry.dir2BlockMinutes,
            dir2BlockMinutes: entry.dir1BlockMinutes,
            dir1FlightMinutes: entry.dir2FlightMinutes ?? null,
            dir2FlightMinutes: entry.dir1FlightMinutes ?? null,
            dir1FuelKg: entry.dir2FuelKg ?? null,
            dir2FuelKg: entry.dir1FuelKg ?? null,
          }
        : entry;

      try {
        const res = await fetch(BASE + `/city-pairs/${v2Cp._id}/block-hours`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          added++;
        } else {
          const err = await res.json();
          console.error(`  ✗ ${pairKey} ${dedupeKey}: ${err.error} ${err.details?.join(", ") || ""}`);
          errors++;
        }
      } catch (e) {
        console.error(`  ✗ ${pairKey} ${dedupeKey}: ${e.message}`);
        errors++;
      }
    }
  }

  console.log(`\n── Done ──`);
  console.log(`  Added:     ${added}`);
  console.log(`  Skipped:   ${skipped} (already exist)`);
  console.log(`  Not found: ${notFound} (V1 pair not in V2)`);
  console.log(`  Errors:    ${errors}`);
}

main().catch(console.error);
