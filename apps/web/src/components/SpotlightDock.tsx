"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Globe,
  Plane,
  Truck,
  Users,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "./theme-provider";

const ACCENT_DEFAULT = "#1e40af";

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const TABS: Tab[] = [
  { key: "home",      label: "Home",       icon: Home,     href: "/" },
  { key: "network",   label: "Network",    icon: Globe,    href: "/network" },
  { key: "flightops", label: "Flight Ops", icon: Plane,    href: "/flight-ops" },
  { key: "groundops", label: "Ground Ops", icon: Truck,    href: "/ground-ops" },
  { key: "crewops",   label: "Crew Ops",   icon: Users,    href: "/crew-ops" },
  { key: "settings",  label: "Settings",   icon: Settings, href: "/settings" },
];

function getActiveIndex(pathname: string): number {
  if (pathname === "/") return 0;
  const idx = TABS.findIndex((t) => t.href !== "/" && pathname.startsWith(t.href));
  return idx >= 0 ? idx : 0;
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function useIsDesktop() {
  if (typeof window === "undefined") return true;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [desktop, setDesktop] = __useState(window.innerWidth >= 1024);
  __useEffect(() => {
    const onResize = () => setDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return desktop;
}

// Avoid import collision with React hooks
import { useState as __useState, useEffect as __useEffect } from "react";

export function SpotlightDock() {
  const pathname = usePathname();
  const { theme, moduleTheme } = useTheme();
  const isDark = theme === "dark";
  const accent = moduleTheme?.accent ?? ACCENT_DEFAULT;
  const activeIndex = getActiveIndex(pathname);
  const isDesktop = useIsDesktop();

  // Glow + indicator colors
  const indicatorColor = isDark ? "#ffffff" : accent;
  const glowColor = isDark ? "rgba(255,255,255,0.25)" : hexToRgba(accent, 0.20);
  const activeIconColor = isDark ? "#ffffff" : accent;
  const inactiveIconColor = isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.26)";
  const activeLabelColor = isDark ? "rgba(255,255,255,0.90)" : accent;
  const inactiveLabelColor = isDark ? "rgba(255,255,255,0.26)" : "rgba(0,0,0,0.30)";

  const dockStyle: React.CSSProperties = isDesktop
    ? {
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        height: 76,
        borderRadius: 22,
        padding: "0 16px",
        background: isDark ? "rgba(18,18,22,0.78)" : "rgba(255,255,255,0.62)",
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        border: `0.5px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        boxShadow: isDark
          ? "0 8px 32px rgba(0,0,0,0.30), inset 0 0.5px 0 rgba(255,255,255,0.06)"
          : "0 8px 32px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.9)",
      }
    : {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 76,
        borderRadius: 0,
        background: isDark ? "rgba(18,18,22,0.78)" : "rgba(255,255,255,0.62)",
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderTop: `0.5px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
      };

  return (
    <nav className="flex items-center" style={dockStyle}>
      {TABS.map((tab, index) => {
        const Icon = tab.icon;
        const active = index === activeIndex;
        const btnWidth = isDesktop ? 76 : undefined;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="relative flex flex-col items-center justify-center overflow-hidden"
            style={{
              width: btnWidth,
              flex: isDesktop ? undefined : 1,
              height: 76,
              gap: 3,
            }}
          >
            {/* Indicator line — active only */}
            {active && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2"
                style={{
                  width: 28,
                  height: 2.5,
                  borderRadius: "0 0 3px 3px",
                  backgroundColor: indicatorColor,
                }}
              />
            )}

            {/* Spotlight glow — active only */}
            {active && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                  width: 56,
                  height: 48,
                  background: `radial-gradient(ellipse 100% 90% at 50% 0%, ${glowColor} 0%, transparent 65%)`,
                  filter: "blur(4px)",
                }}
              />
            )}

            {/* Icon */}
            <Icon
              style={{
                width: 24,
                height: 24,
                color: active ? activeIconColor : inactiveIconColor,
                position: "relative",
              }}
              strokeWidth={1.75}
            />

            {/* Label */}
            <span
              style={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: 0.1,
                color: active ? activeLabelColor : inactiveLabelColor,
                lineHeight: 1,
                position: "relative",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
