const BASE = 'http://localhost:3002';

// AHM 732 Triple-A mapping for legacy IATA delay codes
// Process (P): what part of the turn | Reason (R): specific cause | Stakeholder (S): who
const mappings = {
  // Airline Internal (00-09)
  "00": { p: "T", r: "P", s: "A" },  // Turnaround / Planning / Airline
  "01": { p: "T", r: "P", s: "A" },
  "02": { p: "T", r: "P", s: "A" },
  "03": { p: "T", r: "P", s: "A" },
  "04": { p: "T", r: "P", s: "A" },
  "05": { p: "T", r: "P", s: "A" },
  "06": { p: "T", r: "N", s: "H" },  // Turnaround / Not available / Airport
  "07": { p: "M", r: "L", s: "M" },  // Maintenance / Late arrival / Maintenance provider
  "08": { p: "T", r: "L", s: "A" },  // Turnaround / Late arrival / Airline
  "09": { p: "T", r: "P", s: "A" },  // Turnaround / Planning / Airline

  // Passenger & Baggage (11-19)
  "11": { p: "P", r: "L", s: "P" },  // Passenger handling / Late / Passenger
  "12": { p: "P", r: "C", s: "H" },  // Passenger handling / Congestion / Airport
  "13": { p: "P", r: "E", s: "G" },  // Passenger handling / Error / Ground handler
  "14": { p: "P", r: "O", s: "A" },  // Passenger handling / Oversale / Airline
  "15": { p: "B", r: "M", s: "P" },  // Boarding / Missing / Passenger
  "16": { p: "P", r: "S", s: "A" },  // Passenger handling / Special / Airline
  "17": { p: "P", r: "F", s: "N" },  // Passenger handling / Late delivery / Service provider
  "18": { p: "P", r: "F", s: "G" },  // Passenger handling / Late delivery / Ground handler
  "19": { p: "B", r: "S", s: "G" },  // Boarding / Special / Ground handler

  // Cargo & Mail (21-29)
  "21": { p: "C", r: "E", s: "G" },  // Cargo / Error / Ground handler
  "22": { p: "C", r: "L", s: "G" },  // Cargo / Late / Ground handler
  "23": { p: "C", r: "L", s: "N" },  // Cargo / Late / Service provider
  "24": { p: "C", r: "E", s: "N" },  // Cargo / Error / Service provider
  "25": { p: "C", r: "O", s: "A" },  // Cargo / Oversale / Airline
  "26": { p: "C", r: "F", s: "G" },  // Cargo / Late delivery / Ground handler
  "27": { p: "C", r: "E", s: "N" },  // Cargo (mail) / Error / Service provider
  "28": { p: "C", r: "L", s: "N" },  // Cargo (mail) / Late / Service provider
  "29": { p: "C", r: "L", s: "N" },  // Cargo (mail) / Late / Service provider

  // Aircraft Handling (31-39)
  "31": { p: "D", r: "E", s: "G" },  // Departure / Error / Ground handler
  "32": { p: "L", r: "F", s: "G" },  // Loading / Late delivery / Ground handler
  "33": { p: "L", r: "B", s: "G" },  // Loading / Breakdown / Ground handler
  "34": { p: "G", r: "B", s: "G" },  // Ground handling / Breakdown / Ground handler
  "35": { p: "G", r: "F", s: "G" },  // Ground handling / Late delivery / Ground handler
  "36": { p: "F", r: "F", s: "N" },  // Fuelling / Late delivery / Service provider
  "37": { p: "G", r: "F", s: "N" },  // Ground handling / Late delivery / Service provider
  "38": { p: "L", r: "N", s: "G" },  // Loading / Not available / Ground handler
  "39": { p: "G", r: "B", s: "G" },  // Ground handling / Breakdown / Ground handler

  // Technical (41-48)
  "41": { p: "M", r: "D", s: "A" },  // Maintenance / Defect / Airline
  "42": { p: "M", r: "L", s: "M" },  // Maintenance / Late / Maintenance provider
  "43": { p: "M", r: "U", s: "M" },  // Maintenance / Unscheduled / Maintenance provider
  "44": { p: "M", r: "N", s: "M" },  // Maintenance / Not available / Maintenance provider
  "45": { p: "M", r: "N", s: "M" },  // Maintenance / Not available / Maintenance provider
  "46": { p: "M", r: "T", s: "A" },  // Maintenance / Technical / Airline
  "47": { p: "M", r: "N", s: "A" },  // Maintenance / Not available / Airline
  "48": { p: "M", r: "K", s: "A" },  // Maintenance / Configuration / Airline

  // Damage & EDP (51-58)
  "51": { p: "M", r: "D", s: "X" },  // Maintenance / Damage / External
  "52": { p: "M", r: "D", s: "G" },  // Maintenance / Damage / Ground handler
  "55": { p: "D", r: "B", s: "A" },  // Departure / Breakdown / Airline
  "56": { p: "C", r: "B", s: "A" },  // Cargo / Breakdown / Airline
  "57": { p: "N", r: "B", s: "A" },  // Navigation / Breakdown / Airline
  "58": { p: "D", r: "B", s: "A" },  // Departure / Breakdown / Airline

  // Operations & Crew (61-69)
  "61": { p: "N", r: "L", s: "A" },  // Navigation / Late / Airline
  "62": { p: "N", r: "P", s: "A" },  // Navigation / Planning / Airline
  "63": { p: "B", r: "L", s: "C" },  // Boarding / Late / Crew
  "64": { p: "D", r: "A", s: "C" },  // Departure / Absence / Crew
  "65": { p: "D", r: "S", s: "C" },  // Departure / Special / Crew
  "66": { p: "B", r: "L", s: "C" },  // Boarding / Late / Crew
  "67": { p: "D", r: "A", s: "C" },  // Departure / Absence / Crew
  "68": { p: "D", r: "S", s: "C" },  // Departure / Special / Crew
  "69": { p: "S", r: "R", s: "C" },  // Security / Request / Crew

  // Weather (71-77)
  "71": { p: "D", r: "W", s: "W" },  // Departure / Weather / Weather
  "72": { p: "A", r: "W", s: "W" },  // Arrival / Weather / Weather
  "73": { p: "N", r: "W", s: "W" },  // Navigation / Weather / Weather
  "75": { p: "G", r: "W", s: "G" },  // Ground handling / Weather / Ground handler
  "76": { p: "G", r: "W", s: "H" },  // Ground handling / Weather / Airport
  "77": { p: "G", r: "W", s: "G" },  // Ground handling / Weather / Ground handler

  // ATC & Airport (81-89)
  "81": { p: "N", r: "R", s: "H" },  // Navigation / Restriction / Airport/Authority
  "82": { p: "N", r: "A", s: "H" },  // Navigation / Absence / Airport/Authority
  "83": { p: "A", r: "R", s: "H" },  // Arrival / Restriction / Airport/Authority
  "84": { p: "A", r: "W", s: "H" },  // Arrival / Weather / Airport/Authority
  "85": { p: "S", r: "R", s: "S" },  // Security / Restriction / Security
  "86": { p: "S", r: "G", s: "H" },  // Security / Government / Airport/Authority
  "87": { p: "T", r: "C", s: "H" },  // Turnaround / Congestion / Airport
  "88": { p: "A", r: "R", s: "H" },  // Arrival / Restriction / Airport/Authority
  "89": { p: "D", r: "R", s: "H" },  // Departure / Restriction / Airport/Authority

  // Reactionary & Misc (91-99)
  "91": { p: "D", r: "L", s: "A" },  // Departure / Late / Airline
  "92": { p: "P", r: "E", s: "A" },  // Passenger / Error / Airline
  "93": { p: "T", r: "L", s: "A" },  // Turnaround / Late arrival / Airline
  "94": { p: "D", r: "L", s: "C" },  // Departure / Late / Crew
  "95": { p: "D", r: "L", s: "C" },  // Departure / Late / Crew
  "96": { p: "N", r: "P", s: "A" },  // Navigation / Planning / Airline
  "97": { p: "D", r: "I", s: "A" },  // Departure / Industrial / Airline
  "98": { p: "D", r: "I", s: "X" },  // Departure / Industrial / External
  "99": { p: "D", r: "O", s: "X" },  // Departure / Other / External
};

(async () => {
  // Fetch all codes
  const res = await fetch(BASE + '/delay-codes?operatorId=horizon');
  const codes = await res.json();
  console.log(codes.length + ' codes to map');

  let ok = 0;
  for (const code of codes) {
    const m = mappings[code.code];
    if (!m) continue;

    const r = await fetch(BASE + '/delay-codes/' + code._id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ahm732Process: m.p,
        ahm732Reason: m.r,
        ahm732Stakeholder: m.s,
      }),
    });
    if (r.ok) ok++;
    else console.error(code.code + ': failed');
  }
  console.log(ok + ' codes mapped to AHM 732');
})();
