"use client";

import { useEffect, useState } from "react";
import { api, setApiBaseUrl, type Flight } from "@horizon/api";

setApiBaseUrl("http://localhost:3001");

const STATUS_COLORS: Record<string, string> = {
  departed: "bg-blue-50 text-blue-700 border-blue-200",
  onTime: "bg-green-50 text-green-700 border-green-200",
  delayed: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-gray-50 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  diverted: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_BADGE: Record<string, string> = {
  departed: "bg-blue-100 text-blue-700",
  onTime: "bg-green-100 text-green-700",
  delayed: "bg-amber-100 text-amber-700",
  scheduled: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  diverted: "bg-purple-100 text-purple-700",
};

function formatTime(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function FlightCard({ flight }: { flight: Flight }) {
  const colors = STATUS_COLORS[flight.status] ?? STATUS_COLORS.scheduled;
  const badge = STATUS_BADGE[flight.status] ?? STATUS_BADGE.scheduled;

  return (
    <div className={`rounded-xl border p-4 ${colors} transition-shadow hover:shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold">{flight.flightNumber}</span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${badge}`}>
          {flight.status}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold">{flight.dep.iata}</div>
          <div className="text-xs opacity-70">
            {formatTime(flight.schedule.stdUtc)}
          </div>
        </div>
        <div className="flex-1 border-t border-current opacity-20" />
        <div className="text-center">
          <div className="text-lg font-bold">{flight.arr.iata}</div>
          <div className="text-xs opacity-70">
            {formatTime(flight.schedule.staUtc)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs opacity-70">
        <span>{flight.tail.registration ?? "—"}</span>
        <span>{flight.tail.icaoType ?? "—"}</span>
      </div>

      {flight.delays.length > 0 && (
        <div className="mt-2 text-xs opacity-80">
          {flight.delays.map((d, i) => (
            <span key={i}>
              Delay: {d.minutes}min ({d.reason})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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
    return <div className="text-sm text-gray-400">Loading flights…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{flights.length} flights</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {flights.map((f) => (
          <FlightCard key={f._id} flight={f} />
        ))}
      </div>
    </div>
  );
}
