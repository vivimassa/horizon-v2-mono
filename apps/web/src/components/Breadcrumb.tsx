"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  resolveNavPath,
  buildBreadcrumbs,
  type BreadcrumbSegment,
} from "@skyhub/ui/navigation";
import { useTheme } from "./theme-provider";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";
import {
  Home, Globe, Plane, Truck, Users, Settings,
  Calendar, Clock, Handshake, Send,
  Radar, Wrench, ShieldCheck,
  CalendarDays, BarChart3, Database,
  UserCircle,
  FileText, GanttChart, Repeat, CalendarRange,
  Info, MessageSquare, Map, AlertTriangle,
  DoorOpen, LayoutGrid,
  PlaneTakeoff, Lock, Bell, Palette,
  ArrowLeftRight, Building2,
  ChevronRight, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Icon resolver ──
const ICON_MAP: Record<string, LucideIcon> = {
  Home, Globe, Plane, Truck, Users, Settings,
  Calendar, Clock, Handshake, Send,
  Radar, Wrench, ShieldCheck,
  CalendarDays, BarChart3, Database,
  UserCircle,
  FileText, GanttChart, Repeat, CalendarRange,
  Info, MessageSquare, Map, AlertTriangle,
  DoorOpen, LayoutGrid,
  PlaneTakeoff, Lock, Bell, Palette,
  ArrowLeftRight, Building2,
};

function NavIcon({ name, size = 15, color, className }: { name: string; size?: number; color?: string; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} className={className} strokeWidth={1.8} />;
}

// ── Main Breadcrumb ──
export function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, moduleTheme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const accent = "#1e40af"; // Global user accent — consistent across all modules

  const navPath = resolveNavPath(pathname);
  const segments = navPath ? buildBreadcrumbs(navPath) : [];

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openIndex]);

  const handleSegmentClick = useCallback((idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const handleNavigate = useCallback((route: string) => {
    setOpenIndex(null);
    router.push(route);
  }, [router]);

  // Close dropdown on route change
  useEffect(() => { setOpenIndex(null); }, [pathname]);

  if (segments.length === 0) return null;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <nav
      ref={containerRef}
      aria-label="Breadcrumb"
      className="relative z-10 flex items-center justify-between px-5 pt-0 pb-1 select-none"
    >
      {/* Left: breadcrumb trail in glass pill */}
      <ol
        className="flex items-center gap-1 list-none m-0 px-2 h-[40px] rounded-xl"
        style={{
          background: isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.55)",
          backdropFilter: "blur(12px) saturate(150%)",
          WebkitBackdropFilter: "blur(12px) saturate(150%)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
          boxShadow: isDark
            ? "0 1px 3px rgba(0,0,0,0.2)"
            : "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const isOpen = openIndex === i;
          const hasSiblings = seg.siblings.length > 1;

          return (
            <li key={seg.num} className="flex items-center">
              {/* Chevron separator */}
              {i > 0 && (
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className="mx-1 flex-shrink-0"
                  style={{ color: isDark ? "#444" : "#ccc" }}
                />
              )}

              {/* Segment pill */}
              <div className="relative">
                <button
                  onClick={() => hasSiblings ? handleSegmentClick(i) : handleNavigate(seg.route)}
                  aria-expanded={isOpen}
                  aria-haspopup={hasSiblings ? "listbox" : undefined}
                  className="breadcrumb-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{
                    background: isOpen
                      ? accentTint(accent, isDark ? 0.15 : 0.1)
                      : isLast
                        ? accentTint(accent, isDark ? 0.1 : 0.06)
                        : "transparent",
                    border: isOpen
                      ? `1px solid ${accentTint(accent, isDark ? 0.3 : 0.2)}`
                      : `1px solid transparent`,
                    boxShadow: isOpen
                      ? `0 2px 8px ${accentTint(accent, 0.12)}`
                      : "none",
                  }}
                >
                  {/* Icon */}
                  <NavIcon
                    name={seg.iconName}
                    size={isLast ? 15 : 14}
                    color={isLast ? accent : (isDark ? "#888" : "#999")}
                  />

                  {/* Label */}
                  <span
                    className="text-[13px] whitespace-nowrap"
                    style={{
                      fontWeight: isLast ? 600 : 450,
                      color: isLast ? palette.text : palette.textSecondary,
                    }}
                  >
                    {seg.label}
                  </span>

                  {/* Dropdown arrow */}
                  {hasSiblings && (
                    <ChevronDown
                      size={12}
                      strokeWidth={2}
                      className="transition-transform duration-150 ml-0.5"
                      style={{
                        color: isOpen ? accent : palette.textTertiary,
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  )}
                </button>

                {/* Dropdown */}
                {isOpen && (
                  <SegmentDropdown
                    segment={seg}
                    palette={palette}
                    accent={accent}
                    isDark={isDark}
                    currentRoute={pathname}
                    onItemClick={handleNavigate}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Right: SkyHub logo */}
      <img
        src="/skyhub-logo.png"
        alt="Sky Hub"
        className="ml-4 h-[80px] w-auto object-contain select-none"
        draggable={false}
        style={{
          opacity: isDark ? 0.85 : 1,
          filter: isDark ? "brightness(1.8)" : "none",
        }}
      />

      {/* Hover styles */}
      <style>{`
        .breadcrumb-pill:hover {
          background: ${accentTint(accent, isDark ? 0.1 : 0.06)} !important;
          box-shadow: 0 1px 4px ${accentTint(accent, 0.08)};
        }
      `}</style>
    </nav>
  );
}

// ── Dropdown panel ──
function SegmentDropdown({
  segment,
  palette,
  accent,
  isDark,
  currentRoute,
  onItemClick,
}: {
  segment: BreadcrumbSegment;
  palette: PaletteType;
  accent: string;
  isDark: boolean;
  currentRoute: string;
  onItemClick: (route: string) => void;
}) {
  return (
    <div
      role="listbox"
      className="absolute top-full left-0 mt-1.5"
      style={{
        minWidth: 260,
        borderRadius: 14,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
        background: isDark
          ? "rgba(24,24,27,0.95)"
          : "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: isDark
          ? "0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)"
          : "0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)",
        padding: 6,
        zIndex: 200,
        animation: "bc-dropdown-in 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Section header with accent bar */}
      {segment.parentLabel && (
        <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-2 mb-0.5">
          <div
            className="w-0.5 h-3.5 rounded-full"
            style={{ background: accent }}
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: palette.textTertiary }}
          >
            {segment.parentLabel}
          </span>
        </div>
      )}

      {/* Items */}
      {segment.siblings.map((item) => {
        const isCurrent = item.num === segment.num;

        return (
          <button
            key={item.key}
            role="option"
            aria-selected={isCurrent}
            className="flex items-center gap-2.5 w-full px-2.5 py-[9px] rounded-[10px] transition-all duration-100 cursor-pointer group"
            style={{
              background: isCurrent
                ? accentTint(accent, isDark ? 0.12 : 0.08)
                : "transparent",
            }}
            onClick={() => onItemClick(item.route)}
            onMouseEnter={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Icon with accent bg for current */}
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors duration-100"
              style={{
                background: isCurrent
                  ? accentTint(accent, isDark ? 0.2 : 0.12)
                  : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.04)",
              }}
            >
              <NavIcon
                name={item.iconName}
                size={14}
                color={isCurrent ? accent : palette.textSecondary}
              />
            </div>

            {/* Label */}
            <span
              className="text-[13px] flex-1 text-left"
              style={{
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? accent : palette.text,
              }}
            >
              {item.label}
            </span>

            {/* Active indicator dot */}
            {isCurrent && (
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: accent }}
              />
            )}
          </button>
        );
      })}

      <style>{`
        @keyframes bc-dropdown-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
