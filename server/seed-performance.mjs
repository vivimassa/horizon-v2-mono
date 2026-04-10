const BASE = 'http://localhost:3002';

// Base performance data per ICAO type — each registration gets slight variation
const PERF = {
  A320: {
    performance: {
      mtowKg: 78000,
      mlwKg: 66000,
      mzfwKg: 62500,
      oewKg: 42600,
      maxFuelCapacityKg: 19400,
      cruisingSpeedKts: 447,
      maxRangeNm: 3300,
      ceilingFl: 390,
    },
    fuelBurnRateKgPerHour: 2500,
    etopsCapable: true,
    etopsRatingMinutes: 180,
  },
  A321: {
    performance: {
      mtowKg: 93500,
      mlwKg: 77800,
      mzfwKg: 73800,
      oewKg: 48500,
      maxFuelCapacityKg: 19000,
      cruisingSpeedKts: 450,
      maxRangeNm: 3200,
      ceilingFl: 391,
    },
    fuelBurnRateKgPerHour: 2800,
    etopsCapable: true,
    etopsRatingMinutes: 180,
  },
  A350: {
    performance: {
      mtowKg: 316000,
      mlwKg: 233000,
      mzfwKg: 220000,
      oewKg: 142000,
      maxFuelCapacityKg: 126000,
      cruisingSpeedKts: 488,
      maxRangeNm: 8700,
      ceilingFl: 430,
    },
    fuelBurnRateKgPerHour: 5900,
    etopsCapable: true,
    etopsRatingMinutes: 370,
  },
  A380: {
    performance: {
      mtowKg: 575000,
      mlwKg: 394000,
      mzfwKg: 369000,
      oewKg: 277000,
      maxFuelCapacityKg: 253000,
      cruisingSpeedKts: 490,
      maxRangeNm: 8000,
      ceilingFl: 430,
    },
    fuelBurnRateKgPerHour: 10500,
    etopsCapable: false,
    etopsRatingMinutes: null,
  },
};

// Slight per-aircraft variation (±1-2%) to make data realistic
function vary(base, pct = 0.02) {
  const result = {};
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'number') {
      const delta = Math.round(v * pct * (Math.random() * 2 - 1));
      result[k] = v + delta;
    } else {
      result[k] = v;
    }
  }
  return result;
}

// Weighted fuel burn variance — creates a realistic fleet distribution:
//   ~15% fuel-efficient  (−2% to −3.5%)
//   ~55% normal          (−1.5% to +2%)
//   ~20% above-average   (+3% to +5%)
//   ~10% fuel-hungry     (+6% to +9%)
function varyFuelBurn(baseRate) {
  const roll = Math.random();
  let pct;
  if (roll < 0.10) {
    // fuel-hungry: +6% to +9%
    pct = 0.06 + Math.random() * 0.03;
  } else if (roll < 0.30) {
    // above-average: +3% to +5%
    pct = 0.03 + Math.random() * 0.02;
  } else if (roll < 0.85) {
    // normal: −1.5% to +2%
    pct = -0.015 + Math.random() * 0.035;
  } else {
    // fuel-efficient: −2% to −3.5%
    pct = -(0.02 + Math.random() * 0.015);
  }
  return Math.round(baseRate * (1 + pct));
}

// Fetch all aircraft types to build icaoType lookup
const typesRes = await fetch(BASE + '/aircraft-types?operatorId=20169cc0-c914-4662-a300-1dbbe20d1416');
if (!typesRes.ok) { console.error('Failed to fetch aircraft types:', typesRes.status); process.exit(1); }
const types = await typesRes.json();
const typeMap = Object.fromEntries(types.map(t => [t._id, t.icaoType]));

// Fetch all registrations
const regsRes = await fetch(BASE + '/aircraft-registrations?operatorId=20169cc0-c914-4662-a300-1dbbe20d1416');
if (!regsRes.ok) { console.error('Failed to fetch registrations:', regsRes.status); process.exit(1); }
const regs = await regsRes.json();
console.log(`Found ${regs.length} registrations`);

let ok = 0, skipped = 0;
const fuelLog = []; // track variance for summary

for (const reg of regs) {
  const icao = typeMap[reg.aircraftTypeId];
  const base = PERF[icao];
  if (!base) {
    console.log(`  SKIP ${reg.registration} — no perf data for type ${icao || reg.aircraftTypeId}`);
    skipped++;
    continue;
  }

  const fuelRate = varyFuelBurn(base.fuelBurnRateKgPerHour);
  const variancePct = ((fuelRate - base.fuelBurnRateKgPerHour) / base.fuelBurnRateKgPerHour * 100).toFixed(1);
  fuelLog.push({ reg: reg.registration, icao, base: base.fuelBurnRateKgPerHour, actual: fuelRate, pct: variancePct });

  const body = {
    performance: vary(base.performance, 0.015),
    fuelBurnRateKgPerHour: fuelRate,
    etopsCapable: base.etopsCapable,
    etopsRatingMinutes: base.etopsRatingMinutes,
    noiseCategory: null,
    emissionsCategory: null,
  };

  const r = await fetch(BASE + '/aircraft-registrations/' + reg._id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (r.ok) {
    ok++;
    if (ok % 10 === 0) process.stdout.write('.');
  } else {
    const err = await r.text();
    console.error(`\n  FAIL ${reg.registration}: ${r.status} ${err}`);
  }
}

console.log(`\n\nDone: ${ok} seeded, ${skipped} skipped`);

// Print fuel burn distribution summary
if (fuelLog.length) {
  const hungry = fuelLog.filter(f => f.pct >= 6);
  const above  = fuelLog.filter(f => f.pct >= 3 && f.pct < 6);
  const normal = fuelLog.filter(f => f.pct > -2 && f.pct < 3);
  const efficient = fuelLog.filter(f => f.pct <= -2);

  console.log('\n── Fuel Burn Distribution ──');
  console.log(`  Fuel-hungry  (+6% to +9%): ${hungry.length} aircraft`);
  console.log(`  Above-avg    (+3% to +5%): ${above.length} aircraft`);
  console.log(`  Normal    (−1.5% to +2%):  ${normal.length} aircraft`);
  console.log(`  Efficient (−2% to −3.5%):  ${efficient.length} aircraft`);

  if (hungry.length) {
    console.log('\n  🔥 Fuel-hungry:');
    hungry.sort((a, b) => b.pct - a.pct).forEach(f => console.log(`     ${f.reg} (${f.icao}): ${f.actual} kg/h  → +${f.pct}%`));
  }
  if (efficient.length) {
    console.log('\n  ✅ Fuel-efficient:');
    efficient.sort((a, b) => a.pct - b.pct).forEach(f => console.log(`     ${f.reg} (${f.icao}): ${f.actual} kg/h  → ${f.pct}%`));
  }
}
