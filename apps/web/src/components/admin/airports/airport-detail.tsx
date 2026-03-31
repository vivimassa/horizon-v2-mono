"use client";

import { useState } from "react";
import type { AirportRef } from "@skyhub/api";
import { AirportMap } from "./airport-map";
import { AirportBasicTab } from "./airport-basic-tab";
import { AirportRunwayTab } from "./airport-runway-tab";
import { AirportOperationsTab } from "./airport-operations-tab";
import { AirportCrewTab } from "./airport-crew-tab";
import {
  MapPin,
  Info,
  Plane,
  Radio,
  Users,
} from "lucide-react";

const TABS = [
  { key: "basic", label: "Basic", icon: Info },
  { key: "runway", label: "Runway & Facilities", icon: Plane },
  { key: "operations", label: "Operations", icon: Radio },
  { key: "crew", label: "Crew", icon: Users },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface AirportDetailProps {
  airport: AirportRef;
}

export function AirportDetail({ airport }: AirportDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  const hasCoords = airport.latitude != null && airport.longitude != null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{airport.name}</h1>
            <p className="text-[13px] text-hz-text-secondary mt-0.5">
              {[airport.city, airport.country].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {airport.isActive ? (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                Active
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Code pills */}
        <div className="flex items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-hz-card border border-hz-border text-[12px] font-medium">
            <span className="text-hz-text-secondary">IATA:</span>
            <span className="font-bold">{airport.iataCode ?? "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-hz-card border border-hz-border text-[12px] font-medium">
            <span className="text-hz-text-secondary">ICAO:</span>
            <span className="font-bold">{airport.icaoCode}</span>
          </span>
          {airport.isCrewBase && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-[12px] font-medium text-purple-700 dark:bg-purple-500/15 dark:border-purple-500/25 dark:text-purple-400">
              <Users className="h-3 w-3" />
              Crew Base
            </span>
          )}
          {airport.countryFlag && (
            <span className="text-lg">{airport.countryFlag}</span>
          )}
        </div>
      </div>

      {/* Map */}
      {hasCoords && (
        <div className="h-[200px] shrink-0 border-b border-hz-border">
          <AirportMap
            latitude={airport.latitude!}
            longitude={airport.longitude!}
            name={airport.name}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-hz-border shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 shrink-0 ${
                active
                  ? "bg-module-accent/15 text-module-accent"
                  : "text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "basic" && <AirportBasicTab airport={airport} />}
        {activeTab === "runway" && <AirportRunwayTab airport={airport} />}
        {activeTab === "operations" && <AirportOperationsTab airport={airport} />}
        {activeTab === "crew" && <AirportCrewTab airport={airport} />}
      </div>
    </div>
  );
}
