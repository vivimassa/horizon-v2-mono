"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Globe,
  Plane,
  TowerControl,
  Users,
  Settings,
  ChevronUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "./theme-provider";

const ACCENT = "#1e40af";

interface Tab {
  name: string;
  title: string;
  icon: LucideIcon;
  href: string;
}

const TABS: Tab[] = [
  { name: "home",       title: "Home",       icon: Home,         href: "/" },
  { name: "network",    title: "Network",    icon: Globe,        href: "/network" },
  { name: "flight-ops", title: "Flight Ops", icon: Plane,        href: "/flight-ops" },
  { name: "ground-ops", title: "Ground Ops", icon: TowerControl, href: "/ground-ops" },
  { name: "crew-ops",   title: "Crew Ops",   icon: Users,        href: "/crew-ops" },
  { name: "settings",   title: "Settings",   icon: Settings,     href: "/settings" },
];

function getActiveIndex(pathname: string): number {
  if (pathname === "/") return 0;
  const idx = TABS.findIndex((t) => t.href !== "/" && pathname.startsWith(t.href));
  return idx >= 0 ? idx : 0;
}

const TAB_WIDTH = 76;
const DOCK_PADDING = 16; // px-4

export function BottomDock() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [collapsed, setCollapsed] = useState(false);

  const activeIndex = getActiveIndex(pathname);

  useEffect(() => {
    // Auto-collapse on fullscreen-style pages (Gantt, Scheduling XL)
    const fullscreenPaths = ['/network/schedule/gantt', '/network/schedule/grid'];
    if (fullscreenPaths.some(p => pathname.startsWith(p))) {
      setCollapsed(true);
      return;
    }
    const saved = localStorage.getItem("skyhub-dock-collapsed");
    if (saved === "true") setCollapsed(true);
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("skyhub-dock-collapsed", String(next));
  };

  // Indicator line position
  const indicatorLeft = DOCK_PADDING + activeIndex * TAB_WIDTH + (TAB_WIDTH - 46) / 2;

  if (collapsed) {
    return (
      <button
        onClick={toggleCollapsed}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full px-4 py-2 cursor-pointer transition-all hover:scale-105"
        style={{
          background: isDark
            ? "rgba(30,30,30,0.80)"
            : "rgba(255,255,255,0.80)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.06)"
            : "0 8px 32px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.8)",
          border: `0.5px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
        }}
      >
        <ChevronUp className="h-3.5 w-3.5" style={{ color: ACCENT }} />
        <span className="text-[11px] font-semibold" style={{ color: ACCENT }}>
          Navigation
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <nav
        className="relative flex items-center px-4"
        style={{
          height: 76,
          borderRadius: 22,
          background: isDark
            ? "rgba(30,30,30,0.80)"
            : "rgba(255,255,255,0.80)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.06)"
            : "0 8px 32px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.8)",
        }}
      >
        {/* Sliding top indicator line */}
        <div
          className="absolute top-0 h-[2px] rounded-full transition-all duration-300 ease-in-out"
          style={{
            left: indicatorLeft,
            width: 46,
            backgroundColor: ACCENT,
            transform: "translateY(-1px)",
          }}
        />

        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const active = index === activeIndex;
          const distance = Math.abs(activeIndex - index);
          // Limelight fades on neighbors
          const spotlightOpacity = active ? 1 : Math.max(0, 1 - distance * 0.7);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className="relative flex flex-col items-center justify-center transition-all duration-200"
              style={{ width: TAB_WIDTH }}
            >
              {/* Limelight — light from above pooling down into the dock */}
              <div
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-300"
                style={{
                  top: -10,
                  width: 80,
                  height: 100,
                  background: `radial-gradient(ellipse at 50% 0%, ${ACCENT}80 0%, ${ACCENT}40 30%, transparent 70%)`,
                  filter: "blur(14px)",
                  opacity: spotlightOpacity * (isDark ? 0.9 : 0.65),
                  transitionDelay: active ? "0.1s" : "0s",
                }}
              />

              {/* Icon container */}
              <div
                className="relative flex items-center justify-center transition-all duration-150"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  ...(active
                    ? {}
                    : {}),
                }}
              >
                <Icon
                  style={{
                    width: 24,
                    height: 24,
                    color: active ? ACCENT : isDark ? "#777777" : "#888888",
                    transition: "color 0.15s",
                  }}
                  strokeWidth={active ? 2.25 : 1.75}
                />
              </div>

              {/* Label */}
              <span
                className="text-[11px] mt-1 leading-tight whitespace-nowrap transition-all duration-150"
                style={{
                  color: active
                    ? isDark ? "#f0f0f0" : "#111111"
                    : isDark ? "#777777" : "#888888",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab.title}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Subtle collapse handle */}
      <button
        onClick={toggleCollapsed}
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
        title="Collapse navigation"
      >
        <div
          className="w-8 h-1 rounded-full"
          style={{
            backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.10)",
          }}
        />
      </button>
    </div>
  );
}

export function useDockHeight() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const check = () => {
      setCollapsed(localStorage.getItem("skyhub-dock-collapsed") === "true");
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  return collapsed ? 0 : 76;
}
