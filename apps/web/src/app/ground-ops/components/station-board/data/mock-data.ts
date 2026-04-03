import type { StationFlight, HoldData, ZoneData, WeightRow, DocItem, MessageItem } from "../types";

export const MOCK_FLIGHTS: StationFlight[] = [
  {
    id: "SH123", dep: "SGN", arr: "HAN", std: "06:30", sta: "08:35",
    etd: "06:28", eta: "08:30", atd: null, ata: null, door: null,
    reg: "VN-A601", type: "A321", gate: "A12", status: "boarding",
    pax: { booked: 195, onboard: 142 }, cargo: { loaded: 2840, capacity: 4200 },
    phase: "loading", tat: 45, delays: [],
  },
  {
    id: "SH456", dep: "SGN", arr: "DAD", std: "07:15", sta: "08:30",
    etd: null, eta: null, atd: null, ata: null, door: null,
    reg: "VN-A588", type: "A320", gate: "B03", status: "scheduled",
    pax: { booked: 180, onboard: 0 }, cargo: { loaded: 0, capacity: 3800 },
    phase: "pre_load", tat: 40, delays: [],
  },
  {
    id: "SH789", dep: "SGN", arr: "PQC", std: "08:00", sta: "09:05",
    etd: "07:58", eta: "09:02", atd: "07:58", ata: null, door: "07:52",
    reg: "VN-A612", type: "A321", gate: "C07", status: "departed",
    pax: { booked: 195, onboard: 195 }, cargo: { loaded: 3950, capacity: 4200 },
    phase: "departed", tat: null, delays: [],
  },
  {
    id: "SH234", dep: "SGN", arr: "CXR", std: "09:45", sta: "10:55",
    etd: "10:10", eta: "11:20", atd: null, ata: null, door: null,
    reg: "VN-A595", type: "A320", gate: "\u2014", status: "delayed",
    pax: { booked: 162, onboard: 0 }, cargo: { loaded: 310, capacity: 3800 },
    phase: "pre_load", tat: 40,
    delays: [{ code: "81", mins: 25, reason: "ATC flow control" }],
  },
  {
    id: "SH567", dep: "SGN", arr: "HPH", std: "10:30", sta: "12:40",
    etd: null, eta: null, atd: null, ata: null, door: null,
    reg: "VN-A603", type: "A321", gate: "A08", status: "scheduled",
    pax: { booked: 210, onboard: 0 }, cargo: { loaded: 0, capacity: 4200 },
    phase: "pre_load", tat: 45, delays: [],
  },
  {
    id: "SH890", dep: "SGN", arr: "VII", std: "11:00", sta: "12:15",
    etd: null, eta: null, atd: null, ata: null, door: null,
    reg: "VN-A577", type: "A320", gate: "B11", status: "scheduled",
    pax: { booked: 155, onboard: 0 }, cargo: { loaded: 0, capacity: 3800 },
    phase: "pre_load", tat: 40, delays: [],
  },
  {
    id: "SH345", dep: "SGN", arr: "UIH", std: "11:30", sta: "12:45",
    etd: null, eta: null, atd: null, ata: null, door: null,
    reg: "VN-A622", type: "A321", gate: "C12", status: "scheduled",
    pax: { booked: 188, onboard: 0 }, cargo: { loaded: 0, capacity: 4200 },
    phase: "pre_load", tat: 45, delays: [],
  },
  {
    id: "SH678", dep: "SGN", arr: "DLI", std: "12:00", sta: "12:55",
    etd: null, eta: null, atd: null, ata: null, door: null,
    reg: "VN-A591", type: "A320", gate: "\u2014", status: "scheduled",
    pax: { booked: 170, onboard: 0 }, cargo: { loaded: 0, capacity: 3800 },
    phase: "pre_load", tat: 40, delays: [],
  },
];

export const HOLD_DATA: HoldData[] = [
  { name: "FWD Hold", weight: 1200, capacity: 1500, pct: 80 },
  { name: "AFT Hold", weight: 1340, capacity: 2000, pct: 67 },
  { name: "Bulk",     weight: 300,  capacity: 700,  pct: 43 },
];

export const ZONE_DATA: ZoneData[] = [
  { zone: "A", rows: "1\u201310",  pax: 58, weight: 4640 },
  { zone: "B", rows: "11\u201320", pax: 72, weight: 5760 },
  { zone: "C", rows: "21\u201330", pax: 45, weight: 3600 },
  { zone: "D", rows: "31\u201337", pax: 20, weight: 1600 },
];

export const WEIGHT_DATA: WeightRow[] = [
  { label: "Dry Operating Weight", value: "48,200", ok: null },
  { label: "Zero Fuel Weight",     value: "72,340", ok: true, max: "73,500" },
  { label: "Takeoff Weight",       value: "88,140", ok: true, max: "93,500" },
  { label: "Landing Weight",       value: "83,940", ok: true, max: "77,800" },
];

export const DOCUMENTS: DocItem[] = [
  { key: "loadsheet", label: "Loadsheet",      status: "pending",   iconName: "FileBarChart" },
  { key: "ldm",       label: "LDM",            status: "generated", iconName: "FileText" },
  { key: "cpm",       label: "CPM",            status: "n/a",       iconName: "FileText" },
  { key: "notoc",     label: "NOTOC",          status: "not_req",   iconName: "AlertTriangle" },
  { key: "pax",       label: "Pax Manifest",   status: "pending",   iconName: "Users" },
  { key: "cargo",     label: "Cargo Manifest",  status: "generated", iconName: "Package" },
  { key: "gendec",    label: "Gendec",         status: "pending",   iconName: "ShieldCheck" },
];

export const MESSAGES: MessageItem[] = [
  { key: "ldm",   label: "LDM",   status: "generated", desc: "Load Distribution Message" },
  { key: "cpm",   label: "CPM",   status: "n/a",       desc: "Container/Pallet Message" },
  { key: "notoc", label: "NOTOC", status: "pending",    desc: "Dangerous Goods Notification" },
  { key: "ucm",   label: "UCM",   status: "n/a",       desc: "ULD Control Message" },
];

export const LDM_PREVIEW = `LDM
SH123/01.VNA601.Y220
-HAN.195/195/0/0.T.8460
 .1/1200.3/1340
 5/300
PAX/195 B/5500 C/2840 M/120
SI SPML 2WCHC 1UM 1PETC`;
