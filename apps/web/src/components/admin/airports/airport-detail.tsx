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
import { CountryFlag } from "@/components/ui/country-flag";

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
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {airport.isActive ? (
              <span className="text-[13px] font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                Active
              </span>
            ) : (
              <span className="text-[13px] font-semibold px-3 py-1 rounded-full bg-red-50 text-red-600">
                Inactive
              </span>
            )}
          </div>
        </div>

        {airport.isCrewBase && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-[13px] font-medium text-purple-700 dark:bg-purple-500/15 dark:border-purple-500/25 dark:text-purple-400">
              <Users className="h-3 w-3" />
              Crew Base
            </span>
          </div>
        )}
      </div>

      {/* Map with code overlay */}
      {hasCoords && (
        <div className="h-[300px] shrink-0 border-b border-hz-border relative">
          <AirportMap
            latitude={airport.latitude!}
            longitude={airport.longitude!}
            name={airport.name}
          />
          {/* IATA / ICAO / Flag overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.82)",
                border: "0.5px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <span style={{ color: "#666" }}>IATA:</span>
              <span className="font-bold" style={{ color: "#111" }}>{airport.iataCode ?? "—"}</span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.82)",
                border: "0.5px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <span style={{ color: "#666" }}>ICAO:</span>
              <span className="font-bold" style={{ color: "#111" }}>{airport.icaoCode}</span>
            </span>
            {airport.countryIso2 && (
              <span
                className="inline-flex items-center justify-center px-1.5 py-1 rounded-lg backdrop-blur-md"
                style={{
                  background: "rgba(255,255,255,0.82)",
                  border: "0.5px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <CountryFlag iso2={airport.countryIso2} size={28} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-hz-border shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium transition-colors duration-150 shrink-0 ${
                active
                  ? "bg-module-accent/15 text-module-accent"
                  : "text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text"
              }`}
            >
              <Icon className="h-4 w-4" />
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
