"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, setApiBaseUrl, type ReferenceStats } from "@skyhub/api";
import {
  PlaneTakeoff,
  Plane,
  Globe,
  Timer,
  UserRound,
  FileCheck,
  Tag,
  Building2,
  ChevronRight,
} from "lucide-react";

setApiBaseUrl("http://localhost:3001");

const CATEGORIES: {
  key: keyof ReferenceStats;
  label: string;
  icon: typeof Globe;
  bg: string;
  color: string;
  href: string;
}[] = [
  { key: "airports",           label: "Airports",        icon: PlaneTakeoff, bg: "bg-blue-50",    color: "text-blue-600",   href: "/admin/airports" },
  { key: "aircraftTypes",      label: "Aircraft Types",  icon: Plane,        bg: "bg-indigo-50",  color: "text-indigo-600", href: "/admin/aircraft-types" },
  { key: "countries",          label: "Countries",       icon: Globe,        bg: "bg-green-50",   color: "text-green-600",  href: "/admin/countries" },
  { key: "delayCodes",         label: "Delay Codes",     icon: Timer,        bg: "bg-amber-50",   color: "text-amber-600",  href: "/admin/delay-codes" },
  { key: "crewPositions",      label: "Crew Positions",  icon: UserRound,    bg: "bg-purple-50",  color: "text-purple-600", href: "/admin/crew-positions" },
  { key: "expiryCodes",        label: "Expiry Codes",    icon: FileCheck,    bg: "bg-red-50",     color: "text-red-600",    href: "/admin/expiry-codes" },
  { key: "flightServiceTypes", label: "Service Types",   icon: Tag,          bg: "bg-teal-50",    color: "text-teal-600",   href: "/admin/service-types" },
  { key: "operators",          label: "Operators",       icon: Building2,    bg: "bg-gray-100",   color: "text-gray-600",   href: "/admin/operators" },
];

export default function AdminPage() {
  const [stats, setStats] = useState<ReferenceStats | null>(null);

  useEffect(() => {
    api.getReferenceStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Master Data</h1>
      <p className="text-sm text-hz-text-secondary mb-6">
        {stats ? `${stats.total} total records` : "Loading…"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link key={cat.key} href={cat.href}>
              <div className="rounded-xl border border-hz-border bg-white p-5 transition-shadow hover:shadow-md cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cat.bg}`}>
                    <Icon className={`h-5 w-5 ${cat.color}`} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-hz-text-secondary/40 group-hover:text-hz-text-secondary transition-colors" />
                </div>
                <div className="text-2xl font-bold mb-0.5">
                  {stats ? stats[cat.key] : "—"}
                </div>
                <div className="text-[13px] text-hz-text-secondary font-medium">
                  {cat.label}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
