/**
 * Seed block hours for ALL city pairs × ALL aircraft types.
 *
 * Calculates realistic block & flight times based on:
 *   - Great-circle distance (from city pair distanceNm)
 *   - Aircraft-type cruise speed
 *   - Typical taxi times (10–15 min depending on distance)
 *   - Wind component (slight asymmetry for longer routes)
 *
 * Usage:
 *   node seed-block-hours-all.mjs              # dry-run (preview only)
 *   node seed-block-hours-all.mjs --commit      # actually POST to API
 */

const BASE = "http://localhost:3002";

// ── Cruise speed & fuel burn per ICAO type ──────────────────────────
// cruiseKts: typical cruise speed in knots
// fuelKgPerMin: approximate fuel burn in kg per minute of flight
const AIRCRAFT_PROFILES = {
  A319: { cruiseKts: 440, fuelKgPerMin: 38 },
  A320: { cruiseKts: 450, fuelKgPerMin: 42 },
  A321: { cruiseKts: 450, fuelKgPerMin: 47 },
  A332: { cruiseKts: 470, fuelKgPerMin: 95 },
  A333: { cruiseKts: 470, fuelKgPerMin: 100 },
  A339: { cruiseKts: 475, fuelKgPerMin: 85 },
  A350: { cruiseKts: 480, fuelKgPerMin: 80 },
  A359: { cruiseKts: 480, fuelKgPerMin: 80 },
  A388: { cruiseKts: 480, fuelKgPerMin: 160 },
  B737: { cruiseKts: 440, fuelKgPerMin: 42 },
  B738: { cruiseKts: 445, fuelKgPerMin: 43 },
  B739: { cruiseKts: 445, fuelKgPerMin: 44 },
  B744: { cruiseKts: 475, fuelKgPerMin: 150 },
  B763: { cruiseKts: 460, fuelKgPerMin: 85 },
  B772: { cruiseKts: 475, fuelKgPerMin: 105 },
  B773: { cruiseKts: 480, fuelKgPerMin: 110 },
  B77W: { cruiseKts: 480, fuelKgPerMin: 110 },
  B787: { cruiseKts: 480, fuelKgPerMin: 78 },
  B788: { cruiseKts: 480, fuelKgPerMin: 75 },
  B789: { cruiseKts: 480, fuelKgPerMin: 80 },
  E170: { cruiseKts: 400, fuelKgPerMin: 25 },
  E190: { cruiseKts: 410, fuelKgPerMin: 28 },
  E195: { cruiseKts: 410, fuelKgPerMin: 30 },
  AT72: { cruiseKts: 275, fuelKgPerMin: 14 },
  AT76: { cruiseKts: 280, fuelKgPerMin: 14 },
  DH8D: { cruiseKts: 310, fuelKgPerMin: 16 },
  Q400: { cruiseKts: 310, fuelKgPerMin: 16 },
  CRJ9: { cruiseKts: 420, fuelKgPerMin: 30 },
};

// Fallback for unknown types
const DEFAULT_PROFILE = { cruiseKts: 450, fuelKgPerMin: 45 };

/**
 * Calculate block & flight minutes for a given distance and aircraft type.
 */
function calculateTimes(distanceNm, profile) {
  if (!distanceNm || distanceNm <= 0) return null;

  const { cruiseKts, fuelKgPerMin } = profile;

  // Climb/descent overhead: shorter flights spend proportionally more time climbing
  // Average ground speed is lower than cruise for short flights
  let avgSpeedKts;
  if (distanceNm < 200) {
    avgSpeedKts = cruiseKts * 0.75; // lots of climb/descent
  } else if (distanceNm < 500) {
    avgSpeedKts = cruiseKts * 0.82;
  } else if (distanceNm < 1000) {
    avgSpeedKts = cruiseKts * 0.87;
  } else {
    avgSpeedKts = cruiseKts * 0.90;
  }

  // Base flight time in minutes
  const flightMinutes = (distanceNm / avgSpeedKts) * 60;

  // Taxi time: 10 min for short domestic, 12 for medium, 15 for long-haul
  let taxiMinutes;
  if (distanceNm < 300) taxiMinutes = 10;
  else if (distanceNm < 1000) taxiMinutes = 12;
  else taxiMinutes = 15;

  const blockMinutes = flightMinutes + taxiMinutes;

  // Wind component: slight asymmetry for longer routes (prevailing westerlies)
  // dir1 (station1→station2) gets a small random offset, dir2 gets opposite
  // We keep it deterministic by using distance as seed
  let windOffsetMin = 0;
  if (distanceNm > 500) {
    windOffsetMin = Math.round(distanceNm / 300); // ~1 min per 300 nm
    if (windOffsetMin > 15) windOffsetMin = 15;
  }

  const dir1Flight = Math.round(flightMinutes - windOffsetMin / 2);
  const dir2Flight = Math.round(flightMinutes + windOffsetMin / 2);
  const dir1Block = Math.round(blockMinutes - windOffsetMin / 2);
  const dir2Block = Math.round(blockMinutes + windOffsetMin / 2);

  // Fuel calculation
  const dir1Fuel = Math.round(dir1Flight * fuelKgPerMin);
  const dir2Fuel = Math.round(dir2Flight * fuelKgPerMin);

  return {
    dir1BlockMinutes: Math.max(dir1Block, 20),
    dir2BlockMinutes: Math.max(dir2Block, 20),
    dir1FlightMinutes: Math.max(dir1Flight, 10),
    dir2FlightMinutes: Math.max(dir2Flight, 10),
    dir1FuelKg: dir1Fuel,
    dir2FuelKg: dir2Fuel,
  };
}

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(commit ? "── COMMIT MODE: will POST to API ──" : "── DRY RUN: pass --commit to seed ──");

  // 1. Fetch all city pairs
  console.log("\n── Fetching city pairs ──");
  const cpRes = await fetch(BASE + "/city-pairs");
  if (!cpRes.ok) throw new Error(`Failed to fetch city pairs: ${cpRes.status}`);
  const cityPairs = await cpRes.json();
  console.log(`  City pairs: ${cityPairs.length}`);

  // 2. Fetch all aircraft types
  console.log("── Fetching aircraft types ──");
  const atRes = await fetch(BASE + "/aircraft-types");
  if (!atRes.ok) throw new Error(`Failed to fetch aircraft types: ${atRes.status}`);
  const aircraftTypes = await atRes.json();
  console.log(`  Aircraft types: ${aircraftTypes.length}`);
  console.log(`  Types: ${aircraftTypes.map((a) => a.icaoType).join(", ")}`);

  // 3. Calculate and seed
  let total = 0, added = 0, skipped = 0, errors = 0, noDistance = 0;

  for (const cp of cityPairs) {
    const label = `${cp.station1Iata || cp.station1Icao} ↔ ${cp.station2Iata || cp.station2Icao}`;
    const distNm = cp.distanceNm;

    if (!distNm || distNm <= 0) {
      console.log(`  ⊘ ${label}: no distance, skipping`);
      noDistance++;
      continue;
    }

    // Build set of existing block hour entries to avoid duplicates
    const existingKeys = new Set(
      (cp.blockHours || []).map(
        (bh) => (bh.aircraftTypeIcao || "ALL") + "|" + (bh.seasonType || "annual")
      )
    );

    for (const at of aircraftTypes) {
      total++;
      const icao = at.icaoType;
      const dedupeKey = icao + "|annual";

      if (existingKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const profile = AIRCRAFT_PROFILES[icao] || DEFAULT_PROFILE;
      const times = calculateTimes(distNm, profile);
      if (!times) {
        skipped++;
        continue;
      }

      const payload = {
        aircraftTypeIcao: icao,
        seasonType: "annual",
        ...times,
      };

      if (commit) {
        try {
          const res = await fetch(BASE + `/city-pairs/${cp._id}/block-hours`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            added++;
          } else {
            const err = await res.json().catch(() => ({}));
            console.error(`  ✗ ${label} ${icao}: ${err.error || res.status} ${(err.details || []).join(", ")}`);
            errors++;
          }
        } catch (e) {
          console.error(`  ✗ ${label} ${icao}: ${e.message}`);
          errors++;
        }
      } else {
        // Dry-run: just show what would be seeded
        added++;
      }
    }

    if (!commit && existingKeys.size === 0) {
      // Show sample for first unseeded pair
      const sampleType = aircraftTypes[0]?.icaoType || "A320";
      const profile = AIRCRAFT_PROFILES[sampleType] || DEFAULT_PROFILE;
      const sample = calculateTimes(distNm, profile);
      if (sample) {
        console.log(
          `  ${label} (${distNm} nm) → ${sampleType}: ` +
            `block ${sample.dir1BlockMinutes}/${sample.dir2BlockMinutes} min, ` +
            `flight ${sample.dir1FlightMinutes}/${sample.dir2FlightMinutes} min, ` +
            `fuel ${sample.dir1FuelKg}/${sample.dir2FuelKg} kg`
        );
      }
    }
  }

  console.log(`\n── ${commit ? "Done" : "Dry-run complete"} ──`);
  console.log(`  Total combinations: ${total}`);
  console.log(`  ${commit ? "Added" : "Would add"}: ${added}`);
  console.log(`  Skipped (exists):   ${skipped}`);
  console.log(`  No distance:        ${noDistance}`);
  if (commit) console.log(`  Errors:             ${errors}`);
  if (!commit) console.log(`\nRun with --commit to actually seed.`);
}

main().catch(console.error);
