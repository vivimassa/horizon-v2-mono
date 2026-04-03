// ── Station Board Types ──

export interface StationFlight {
  id: string;
  dep: string;
  arr: string;
  std: string;
  sta: string;
  etd: string | null;
  eta: string | null;
  atd: string | null;
  ata: string | null;
  door: string | null;
  reg: string;
  type: string;
  gate: string;
  status: FlightStatus;
  pax: { booked: number; onboard: number };
  cargo: { loaded: number; capacity: number };
  phase: FlightPhase;
  tat: number | null;
  delays: Delay[];
}

export type FlightStatus = "boarding" | "loading" | "scheduled" | "departed" | "delayed";
export type FlightPhase = "pre_load" | "loading" | "load_control" | "captain_accept" | "departed";

export interface Delay {
  code: string;
  mins: number;
  reason: string;
}

export interface HoldData {
  name: string;
  weight: number;
  capacity: number;
  pct: number;
}

export interface ZoneData {
  zone: string;
  rows: string;
  pax: number;
  weight: number;
}

export interface WeightRow {
  label: string;
  value: string;
  ok: boolean | null;
  max?: string;
}

export interface DocItem {
  key: string;
  label: string;
  status: DocStatus;
  iconName: string;
}

export type DocStatus = "generated" | "sent" | "pending" | "not_req" | "n/a";

export interface MessageItem {
  key: string;
  label: string;
  status: DocStatus;
  desc: string;
}

export interface StatusConfig {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

export interface PhaseConfig {
  label: string;
  pct: number;
}

export const STATUS_CONFIG: Record<FlightStatus, StatusConfig> = {
  boarding:  { label: "Boarding",  bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  loading:   { label: "Loading",   bg: "rgba(5,150,105,0.1)", text: "#059669", dot: "#059669" },
  scheduled: { label: "Scheduled", bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  departed:  { label: "Departed",  bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  delayed:   { label: "Delayed",   bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
};

export const PHASE_CONFIG: Record<FlightPhase, PhaseConfig> = {
  pre_load:        { label: "Pre-Load",  pct: 0 },
  loading:         { label: "Loading",   pct: 40 },
  load_control:    { label: "Load Ctrl", pct: 70 },
  captain_accept:  { label: "Captain",   pct: 90 },
  departed:        { label: "Departed",  pct: 100 },
};

export const DOC_STATUS_CONFIG: Record<DocStatus, { bg: string; text: string; label: string }> = {
  generated: { bg: "#dcfce7", text: "#166534", label: "Generated" },
  sent:      { bg: "#dbeafe", text: "#1e40af", label: "Sent" },
  pending:   { bg: "#fef3c7", text: "#92400e", label: "Pending" },
  not_req:   { bg: "#f3f4f6", text: "#9ca3af", label: "N/A" },
  "n/a":     { bg: "#f3f4f6", text: "#9ca3af", label: "N/A" },
};
