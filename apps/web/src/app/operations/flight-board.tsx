"use client";

import { useEffect, useState } from "react";
import { api, setApiBaseUrl, type Flight } from "@skyhub/api";

setApiBaseUrl("http://localhost:3002");

/* ── Status config ─────────────────────────────────── */

const STATUS_CONFIG: Record<
  string,
  { bar: string; badge: string; badgeText: string; label: string }
> = {
  onTime: {
    bar: "bg-hz-on-time",
    badge: "bg-hz-on-time-bg text-hz-on-time",
    badgeText: "On Time",
    label: "On Time",
  },
  delayed: {
    bar: "bg-hz-delayed",
    badge: "bg-hz-delayed-bg text-hz-delayed",
    badgeText: "Delayed",
    label: "Delayed",
  },
  cancelled: {
    bar: "bg-hz-cancelled",
    badge: "bg-hz-cancelled-bg text-hz-cancelled",
    badgeText: "Cancelled",
    label: "Cancelled",
  },
  departed: {
    bar: "bg-hz-departed",
    badge: "bg-hz-departed-bg text-hz-departed",
    badgeText: "Departed",
    label: "Departed",
  },
  diverted: {
    bar: "bg-hz-diverted",
    badge: "bg-hz-diverted-bg text-hz-diverted",
    badgeText: "Diverted",
    label: "Diverted",
  },
  scheduled: {
    bar: "bg-hz-scheduled",
    badge: "bg-hz-scheduled-bg text-hz-scheduled",
    badgeText: "Scheduled",
    label: "Scheduled",
  },
};

function cfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
}

/* ── Helpers ───────────────────────────────────────── */

function formatTime(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/* ── KPI strip ─────────────────────────────────────── */

function KpiPill({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number | string;
  colorClass: string;
}) {
  return (
    <div className={`flex-1 rounded-xl px-4 py-3 ${colorClass}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs font-medium opacity-70">{label}</div>
    </div>
  );
}

function KpiStrip({ flights }: { flights: Flight[] }) {
  const onTime = flights.filter(
    (f) => f.status === "onTime" || f.status === "departed"
  ).length;
  const delayed = flights.filter((f) => f.status === "delayed").length;
  const cancelled = flights.filter((f) => f.status === "cancelled").length;
  const total = flights.length;
  const otp = total > 0 ? Math.round((onTime / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <KpiPill
        label="On Time"
        value={onTime}
        colorClass="bg-hz-on-time-bg text-hz-on-time"
      />
      <KpiPill
        label="Delayed"
        value={delayed}
        colorClass="bg-hz-delayed-bg text-hz-delayed"
      />
      <KpiPill
        label="Cancelled"
        value={cancelled}
        colorClass="bg-hz-cancelled-bg text-hz-cancelled"
      />
      <KpiPill
        label="OTP"
        value={`${otp}%`}
        colorClass="bg-hz-accent-light text-hz-accent"
      />
    </div>
  );
}

/* ── Flight card ───────────────────────────────────── */

function FlightCard({ flight }: { flight: Flight }) {
  const s = cfg(flight.status);
  const isCancelled = flight.status === "cancelled";

  return (
    <div
      className={`flex rounded-xl border border-hz-border bg-hz-card overflow-hidden transition-shadow hover:shadow-md ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      {/* Left accent bar */}
      <div className={`w-1.5 shrink-0 ${s.bar}`} />

      <div className="flex-1 p-4">
        {/* Top row: flight number + badge */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-base font-bold">{flight.flightNumber}</span>
            <span className="text-xs text-hz-text-secondary ml-2">
              {flight.tail.icaoType ?? ""}
            </span>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.badge}`}
          >
            {s.badgeText}
          </span>
        </div>

        {/* Route row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-center">
            <div className="text-lg font-bold">{flight.dep.iata}</div>
            <div
              className={`text-xs text-hz-text-secondary ${
                isCancelled ? "line-through" : ""
              }`}
            >
              {formatTime(flight.schedule.stdUtc)}
            </div>
          </div>
          <div className="flex-1 flex items-center">
            <div className="flex-1 border-t border-hz-border" />
            <svg
              className="h-3 w-3 text-hz-text-secondary -ml-px"
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M8.5 6L5 3v2H2v2h3v2z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{flight.arr.iata}</div>
            <div
              className={`text-xs text-hz-text-secondary ${
                isCancelled ? "line-through" : ""
              }`}
            >
              {formatTime(flight.schedule.staUtc)}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-xs text-hz-text-secondary">
          <span>{flight.tail.registration ?? "—"}</span>
          {flight.delays.length > 0 && (
            <span className="text-hz-delayed">
              +{flight.delays.reduce((s, d) => s + d.minutes, 0)}min
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main board ────────────────────────────────────── */

export function FlightBoard() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFlights()
      .then(setFlights)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-hz-text-secondary animate-pulse">
        Loading flights…
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-hz-cancelled">Error: {error}</div>;
  }

  return (
    <div>
      <KpiStrip flights={flights} />

      <p className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-secondary mb-3">
        Active flights
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {flights.map((f) => (
          <FlightCard key={f._id} flight={f} />
        ))}
      </div>
    </div>
  );
}
