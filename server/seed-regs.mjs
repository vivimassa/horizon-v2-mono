const BASE = 'http://localhost:3002';
const SL = 'ABCDEFGHJKLMPQRS'.split('');
const used = new Set();
function sc() {
  let s;
  do {
    const p = () => SL[Math.floor(Math.random() * SL.length)];
    let a = p(), b = p(); while (b <= a) b = p();
    let c = p(), d = p(); while (d <= c) d = p();
    s = a + b + '-' + c + d;
  } while (used.has(s));
  used.add(s);
  return s;
}
const V = { A320: ['A320-214','A320-232','A320-251N','A320-271N'], A321: ['A321-231','A321-251NX','A321-271NX','A321-211'], A350: ['A350-1041','A350-1041'], A380: ['A380-841','A380-861'] };
const M = { A320: 3200, A321: 5400, A350: 300, A380: 100 };

const res = await fetch(BASE + '/aircraft-registrations?operatorId=20169cc0-c914-4662-a300-1dbbe20d1416');
const regs = await res.json();
console.log(regs.length + ' remaining to seed');

const bt = {};
for (const r of regs) {
  let t;
  if (r.registration.startsWith('SK-H9')) t = 'A380';
  else if (r.registration.startsWith('SK-H8')) t = 'A350';
  else { const n = parseInt(r.registration.replace('SK-H4', '')); t = n <= 10 ? 'A320' : 'A321'; }
  if (!bt[t]) bt[t] = [];
  bt[t].push(r);
}

let ok = 0;
for (const [type, tr] of Object.entries(bt)) {
  tr.sort((a, b) => a.registration.localeCompare(b.registration));
  const n = tr.length, p = Math.floor(n * 0.4);
  for (let i = 0; i < n; i++) {
    let y, m, dy;
    if (i < p) { y = 2008 + Math.floor(i / p * 10); m = 1 + Math.floor(Math.random() * 12); dy = 1 + Math.floor(Math.random() * 28); }
    else { const pos = (i - p) / (n - p); const yf = 2018 + pos * 7.5; y = Math.floor(yf); m = Math.min(1 + Math.floor((yf - y) * 12), 12); dy = 1 + Math.floor(Math.random() * 28); }
    const dom = y + '-' + String(m).padStart(2, '0') + '-' + String(dy).padStart(2, '0');
    const body = JSON.stringify({ serialNumber: String(M[type] + i), variant: V[type][i % V[type].length], selcal: sc(), dateOfManufacture: dom });
    const r2 = await fetch(BASE + '/aircraft-registrations/' + tr[i]._id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    if (r2.ok) ok++;
    else console.error('FAIL', tr[i].registration);
  }
  console.log(type + ': ' + n + ' done');
}
console.log('Total: ' + ok + ' seeded');
