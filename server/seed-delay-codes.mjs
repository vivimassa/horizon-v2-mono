const BASE = 'http://localhost:3002';

// Accept --operator=<id> or fall back to discovering the first active operator.
// A hardcoded string like "horizon" creates rows no tenant can read.
const operatorArg = process.argv.find((a) => a.startsWith('--operator='));
let OPERATOR_ID;
if (operatorArg) {
  OPERATOR_ID = operatorArg.split('=')[1];
} else {
  const r = await fetch(BASE + '/operators');
  if (!r.ok) { console.error('GET /operators failed — pass --operator=<id>'); process.exit(1); }
  const ops = await r.json();
  if (!ops.length) { console.error('No operators in DB — seed one first'); process.exit(1); }
  OPERATOR_ID = ops[0]._id;
}
console.log('Seeding delay codes for operator:', OPERATOR_ID);

const codes = [
  // Airline Internal (00-09)
  { code: "00", alphaCode: null, category: "Airline Internal", name: "Airline Internal", description: "Airline-specific internal use", color: "#6b7280" },
  { code: "01", alphaCode: null, category: "Airline Internal", name: "Airline Internal (01)", description: "Airline-specific internal use", color: "#6b7280" },
  { code: "02", alphaCode: null, category: "Airline Internal", name: "Airline Internal (02)", description: "Airline-specific internal use", color: "#6b7280" },
  { code: "03", alphaCode: null, category: "Airline Internal", name: "Airline Internal (03)", description: "Airline-specific internal use", color: "#6b7280" },
  { code: "04", alphaCode: null, category: "Airline Internal", name: "Airline Internal (04)", description: "Airline-specific internal use", color: "#6b7280" },
  { code: "05", alphaCode: null, category: "Airline Internal", name: "Airline Internal (05)", description: "Airline-specific internal use", color: "#6b7280" },
  { code: "06", alphaCode: "OA", category: "Airline Internal", name: "No Gate/Stand Availability", description: "Due to own airline activity", color: "#6b7280" },
  { code: "07", alphaCode: null, category: "Airline Internal", name: "Aircraft Connection (Maintenance)", description: "Waiting for aircraft from maintenance", color: "#6b7280" },
  { code: "08", alphaCode: null, category: "Airline Internal", name: "Aircraft Connection (Ops)", description: "Miscellaneous operational connection", color: "#6b7280" },
  { code: "09", alphaCode: "SG", category: "Airline Internal", name: "Scheduled Ground Time", description: "Scheduled ground time less than declared minimum", color: "#6b7280" },

  // Passenger & Baggage (11-19)
  { code: "11", alphaCode: "PD", category: "Passenger & Baggage", name: "Late Check-in", description: "Acceptance after deadline", color: "#3b82f6" },
  { code: "12", alphaCode: "PL", category: "Passenger & Baggage", name: "Check-in Congestion", description: "Excessive check-in queues or congestion", color: "#3b82f6" },
  { code: "13", alphaCode: "PE", category: "Passenger & Baggage", name: "Check-in Error", description: "Error in check-in process, weight or documentation", color: "#3b82f6" },
  { code: "14", alphaCode: "PO", category: "Passenger & Baggage", name: "Oversales / Booking Error", description: "Oversold flights or booking discrepancies", color: "#3b82f6" },
  { code: "15", alphaCode: "PH", category: "Passenger & Baggage", name: "Boarding Discrepancy", description: "Passengers missing after check-in, missing from gate", color: "#3b82f6" },
  { code: "16", alphaCode: "PS", category: "Passenger & Baggage", name: "Commercial Publicity / VIP", description: "Passenger convenience, VIP, press, ground arrangements", color: "#3b82f6" },
  { code: "17", alphaCode: "PC", category: "Passenger & Baggage", name: "Catering Order", description: "Late or incorrect catering orders", color: "#3b82f6" },
  { code: "18", alphaCode: "PB", category: "Passenger & Baggage", name: "Baggage Processing", description: "Sorting, loading, delivery, claims", color: "#3b82f6" },
  { code: "19", alphaCode: "PW", category: "Passenger & Baggage", name: "Reduced Mobility", description: "Boarding/deboarding of passengers with reduced mobility", color: "#3b82f6" },

  // Cargo & Mail (21-29)
  { code: "21", alphaCode: "CD", category: "Cargo & Mail", name: "Cargo Documentation", description: "Documentation errors, incomplete paperwork", color: "#10b981" },
  { code: "22", alphaCode: "CP", category: "Cargo & Mail", name: "Late Positioning", description: "Late cargo positioning to aircraft", color: "#10b981" },
  { code: "23", alphaCode: "CC", category: "Cargo & Mail", name: "Late Acceptance", description: "Cargo accepted after cut-off time", color: "#10b981" },
  { code: "24", alphaCode: "CI", category: "Cargo & Mail", name: "Inadequate Packing", description: "Cargo repacked or refused due to packing", color: "#10b981" },
  { code: "25", alphaCode: "CO", category: "Cargo & Mail", name: "Cargo Oversales", description: "Oversales, booking errors", color: "#10b981" },
  { code: "26", alphaCode: "CU", category: "Cargo & Mail", name: "Late Warehouse", description: "Late preparation in warehouse", color: "#10b981" },
  { code: "27", alphaCode: "CE", category: "Cargo & Mail", name: "Mail (Packing)", description: "Documentation, packing errors", color: "#10b981" },
  { code: "28", alphaCode: "CL", category: "Cargo & Mail", name: "Mail Late Positioning", description: "Late delivery of mail to aircraft", color: "#10b981" },
  { code: "29", alphaCode: "CA", category: "Cargo & Mail", name: "Mail Late Acceptance", description: "Mail accepted after cut-off", color: "#10b981" },

  // Aircraft Handling (31-39)
  { code: "31", alphaCode: "GD", category: "Aircraft Handling", name: "Aircraft Documentation", description: "Weight and balance, general declaration, pax manifest", color: "#f59e0b" },
  { code: "32", alphaCode: "GL", category: "Aircraft Handling", name: "Loading/Unloading", description: "Slow or late loading/unloading", color: "#f59e0b" },
  { code: "33", alphaCode: "GE", category: "Aircraft Handling", name: "Loading Equipment", description: "Lack or breakdown of loading equipment", color: "#f59e0b" },
  { code: "34", alphaCode: "GS", category: "Aircraft Handling", name: "Servicing Equipment", description: "Lack or breakdown of servicing equipment", color: "#f59e0b" },
  { code: "35", alphaCode: "GC", category: "Aircraft Handling", name: "Aircraft Cleaning", description: "Cabin cleaning, toilet/water servicing", color: "#f59e0b" },
  { code: "36", alphaCode: "GF", category: "Aircraft Handling", name: "Fuelling/Defuelling", description: "Fuel supplier delay or fuelling error", color: "#f59e0b" },
  { code: "37", alphaCode: "GB", category: "Aircraft Handling", name: "Catering", description: "Late delivery or loading of catering", color: "#f59e0b" },
  { code: "38", alphaCode: "GU", category: "Aircraft Handling", name: "ULD/Container", description: "Shortage of ULDs, containers, pallets", color: "#f59e0b" },
  { code: "39", alphaCode: "GT", category: "Aircraft Handling", name: "Technical Equipment", description: "Lack or breakdown of technical equipment (GPU, ASU)", color: "#f59e0b" },

  // Technical (41-48)
  { code: "41", alphaCode: "TD", category: "Technical", name: "Aircraft Defects", description: "Items requiring immediate rectification, unscheduled component changes", color: "#ef4444" },
  { code: "42", alphaCode: "TM", category: "Technical", name: "Scheduled Maintenance", description: "Late release from scheduled maintenance", color: "#ef4444" },
  { code: "43", alphaCode: "TN", category: "Technical", name: "Non-Scheduled Maintenance", description: "Non-scheduled maintenance, special checks, or campaign work", color: "#ef4444" },
  { code: "44", alphaCode: "TS", category: "Technical", name: "Spares & Maintenance Equipment", description: "Lack of spares, tools, or maintenance equipment", color: "#ef4444" },
  { code: "45", alphaCode: "TA", category: "Technical", name: "AOG Spares", description: "Awaiting spares for another station (AOG transfer)", color: "#ef4444" },
  { code: "46", alphaCode: "TC", category: "Technical", name: "Aircraft Change (Technical)", description: "Substitution of aircraft for technical reasons", color: "#ef4444" },
  { code: "47", alphaCode: "TL", category: "Technical", name: "Standby Aircraft", description: "No planned standby aircraft available", color: "#ef4444" },
  { code: "48", alphaCode: "TV", category: "Technical", name: "Cabin Configuration", description: "Scheduled cabin configuration/version adjustment", color: "#ef4444" },

  // Damage & EDP (51-58)
  { code: "51", alphaCode: "DF", category: "Damage & EDP", name: "Damage During Flight Ops", description: "Bird strike, lightning, turbulence damage", color: "#e11d48" },
  { code: "52", alphaCode: "DG", category: "Damage & EDP", name: "Damage During Ground Ops", description: "Towing, loading, ground vehicle collision", color: "#e11d48" },
  { code: "55", alphaCode: "ED", category: "Damage & EDP", name: "Departure Control System", description: "Check-in, weight & balance computer failure", color: "#e11d48" },
  { code: "56", alphaCode: "EC", category: "Damage & EDP", name: "Cargo System", description: "Cargo documentation/preparation system failure", color: "#e11d48" },
  { code: "57", alphaCode: "EF", category: "Damage & EDP", name: "Flight Plan System", description: "Computerized flight planning system failure", color: "#e11d48" },
  { code: "58", alphaCode: "EO", category: "Damage & EDP", name: "Other Systems", description: "Other EDP/computer system failures", color: "#e11d48" },

  // Operations & Crew (61-69)
  { code: "61", alphaCode: "FP", category: "Operations & Crew", name: "Flight Plan", description: "Late completion or change of flight plan", color: "#8b5cf6" },
  { code: "62", alphaCode: "FF", category: "Operations & Crew", name: "Operational Requirements", description: "Fuel, load alteration, ATC slot change", color: "#8b5cf6" },
  { code: "63", alphaCode: "FT", category: "Operations & Crew", name: "Late Crew Boarding", description: "Flight crew late boarding or departure procedures", color: "#8b5cf6" },
  { code: "64", alphaCode: "FS", category: "Operations & Crew", name: "Flight Crew Shortage", description: "Crew shortage or crew rest requirements", color: "#8b5cf6" },
  { code: "65", alphaCode: "FR", category: "Operations & Crew", name: "Flight Crew Request", description: "Captain's special request or crew error", color: "#8b5cf6" },
  { code: "66", alphaCode: "FL", category: "Operations & Crew", name: "Late Cabin Crew", description: "Cabin crew late boarding or departure procedures", color: "#8b5cf6" },
  { code: "67", alphaCode: "FC", category: "Operations & Crew", name: "Cabin Crew Shortage", description: "Cabin crew shortage or rest requirements", color: "#8b5cf6" },
  { code: "68", alphaCode: "FA", category: "Operations & Crew", name: "Cabin Crew Request", description: "Cabin crew error or special request", color: "#8b5cf6" },
  { code: "69", alphaCode: "FB", category: "Operations & Crew", name: "Captain Security", description: "Captain requested security check or inspection", color: "#8b5cf6" },

  // Weather (71-77)
  { code: "71", alphaCode: "WO", category: "Weather", name: "Departure Weather", description: "Weather at departure station (below limits)", color: "#0ea5e9" },
  { code: "72", alphaCode: "WT", category: "Weather", name: "Destination Weather", description: "Weather at destination station", color: "#0ea5e9" },
  { code: "73", alphaCode: "WR", category: "Weather", name: "En-Route / Alternate Weather", description: "Weather on route or at alternate airport", color: "#0ea5e9" },
  { code: "75", alphaCode: "WI", category: "Weather", name: "De-Icing", description: "De-icing of aircraft, removal of ice/snow/frost", color: "#0ea5e9" },
  { code: "76", alphaCode: "WS", category: "Weather", name: "Snow/Ice Removal", description: "Removal of snow, ice, water, sand from airport/runway", color: "#0ea5e9" },
  { code: "77", alphaCode: "WG", category: "Weather", name: "Ground Handling Weather", description: "Ground handling impaired by adverse weather", color: "#0ea5e9" },

  // ATC & Airport (81-89)
  { code: "81", alphaCode: "AT", category: "ATC & Airport", name: "ATC Restriction (En-Route)", description: "ATC en-route restriction, flow control, capacity", color: "#14B8A6" },
  { code: "82", alphaCode: "AX", category: "ATC & Airport", name: "ATC Staff/Equipment", description: "ATC staff shortage or equipment failure", color: "#14B8A6" },
  { code: "83", alphaCode: "AE", category: "ATC & Airport", name: "ATC Restriction (Destination)", description: "ATC restriction at destination", color: "#14B8A6" },
  { code: "84", alphaCode: "AW", category: "ATC & Airport", name: "ATC Weather Restriction", description: "ATC restriction due to weather at destination", color: "#14B8A6" },
  { code: "85", alphaCode: "AS", category: "ATC & Airport", name: "Mandatory Security", description: "Mandatory security measures", color: "#14B8A6" },
  { code: "86", alphaCode: "AG", category: "ATC & Airport", name: "Immigration/Customs/Health", description: "Government authority restrictions", color: "#14B8A6" },
  { code: "87", alphaCode: "AF", category: "ATC & Airport", name: "Airport Facilities", description: "Airport facilities, parking, ramp congestion", color: "#14B8A6" },
  { code: "88", alphaCode: "AD", category: "ATC & Airport", name: "Destination Restriction", description: "Airport restriction at destination (curfew, closure)", color: "#14B8A6" },
  { code: "89", alphaCode: "AM", category: "ATC & Airport", name: "Departure Restriction", description: "Airport restriction at departure (curfew, closure)", color: "#14B8A6" },

  // Reactionary & Misc (91-99)
  { code: "91", alphaCode: "RL", category: "Reactionary & Misc", name: "Passenger Connection", description: "Connecting passengers, crew, or baggage protection", color: "#a855f7" },
  { code: "92", alphaCode: "RT", category: "Reactionary & Misc", name: "Through Check-in Error", description: "Through check-in, connection error", color: "#a855f7" },
  { code: "93", alphaCode: "RA", category: "Reactionary & Misc", name: "Aircraft Rotation", description: "Late arrival of aircraft from previous sector", color: "#a855f7" },
  { code: "94", alphaCode: "RS", category: "Reactionary & Misc", name: "Cabin Crew Rotation", description: "Late cabin crew connection from previous flight", color: "#a855f7" },
  { code: "95", alphaCode: "RC", category: "Reactionary & Misc", name: "Crew Rotation", description: "Flight crew rotation, late connection", color: "#a855f7" },
  { code: "96", alphaCode: "RO", category: "Reactionary & Misc", name: "Operations Control", description: "Rerouting, diversion, consolidation, cancellation", color: "#a855f7" },
  { code: "97", alphaCode: "MI", category: "Reactionary & Misc", name: "Industrial Action (Own)", description: "Industrial action within own airline", color: "#a855f7" },
  { code: "98", alphaCode: "MO", category: "Reactionary & Misc", name: "Industrial Action (External)", description: "Industrial action outside own airline", color: "#a855f7" },
  { code: "99", alphaCode: "MX", category: "Reactionary & Misc", name: "Miscellaneous", description: "Not elsewhere specified", color: "#a855f7" },
];

(async () => {
  let ok = 0, skip = 0;
  for (const c of codes) {
    const body = JSON.stringify({ operatorId: OPERATOR_ID, ...c, isActive: true, isIataStandard: true });
    const r = await fetch(BASE + '/delay-codes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body
    });
    if (r.ok) ok++;
    else { const e = await r.json(); if (e.error?.includes('already exists')) skip++; else console.error(c.code + ': ' + e.error); }
  }
  console.log(`${ok} created, ${skip} skipped (existing). Total: ${codes.length}`);
})();
