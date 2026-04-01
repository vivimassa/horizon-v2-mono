"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  resolveNavPath,
  buildBreadcrumbs,
  type BreadcrumbSegment,
} from "@skyhub/ui/navigation";
// Note: "@skyhub/ui/navigation" points to web-safe.ts (no RN deps)
import { useTheme } from "./theme-provider";
import { colors, accentTint, type Palette as PaletteType } from "@skyhub/ui/theme";

function ChevronDown({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 3 }}>
      <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, moduleTheme } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;
  const accent = moduleTheme?.accent ?? "#1e40af";

  const navPath = resolveNavPath(pathname);
  const segments = navPath ? buildBreadcrumbs(navPath) : [];

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
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

  // Close on Escape
  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openIndex]);

  const handleSegmentClick = useCallback(
    (idx: number) => {
      setOpenIndex((prev) => (prev === idx ? null : idx));
    },
    [],
  );

  const handleItemClick = useCallback(
    (route: string) => {
      setOpenIndex(null);
      router.push(route);
    },
    [router],
  );

  if (segments.length === 0) return null;

  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const separatorColor = isDark ? "#444444" : "#cccccc";

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-between px-6 min-h-[44px]"
    >
      {/* Left: breadcrumb segments */}
      <div className="flex items-center gap-0">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const isOpen = openIndex === i;
          const hasSiblings = seg.siblings.length > 1;

          return (
            <div key={seg.num} className="flex items-center">
              {i > 0 && (
                <span
                  className="mx-1.5 select-none"
                  style={{ color: separatorColor, fontSize: 13 }}
                >
                  ›
                </span>
              )}

              {/* Segment button */}
              <div className="relative">
                <button
                  onClick={() => hasSiblings && handleSegmentClick(i)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all duration-100 cursor-pointer"
                  style={{
                    border: isOpen
                      ? `1px solid ${accentTint(accent, 0.3)}`
                      : "1px solid transparent",
                    background: isOpen
                      ? accentTint(accent, 0.06)
                      : "transparent",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isOpen) e.currentTarget.style.background = accentTint(accent, 0.04);
                  }}
                  onMouseLeave={(e) => {
                    if (!isOpen) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      opacity: 0.5,
                      color: palette.text,
                    }}
                  >
                    {seg.num}
                  </span>
                  <span
                    style={{
                      color: isLast ? palette.text : palette.textSecondary,
                    }}
                  >
                    {seg.label}
                  </span>
                  {hasSiblings && (
                    <ChevronDown color={palette.textSecondary} />
                  )}
                </button>

                {/* Dropdown */}
                {isOpen && (
                  <Dropdown
                    segment={seg}
                    palette={palette}
                    accent={accent}
                    isDark={isDark}
                    currentRoute={pathname}
                    onItemClick={handleItemClick}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: date + operator */}
      <span
        className="text-xs whitespace-nowrap ml-4"
        style={{ color: palette.textTertiary }}
      >
        {today} — VietJet Air
      </span>
    </div>
  );
}

function Dropdown({
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
      className="absolute top-full left-0 mt-1"
      style={{
        minWidth: 240,
        borderRadius: 12,
        border: `1px solid ${palette.cardBorder}`,
        background: isDark ? "#1a1a1a" : "#ffffff",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
        padding: 5,
        zIndex: 200,
        animation: "breadcrumb-dropdown 120ms ease-out",
      }}
    >
      {/* Header */}
      {segment.parentLabel && (
        <div
          className="px-2.5 py-1.5"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: palette.textTertiary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {segment.parentLabel}
        </div>
      )}

      {/* Items */}
      {segment.siblings.map((item) => {
        const isActive = item.route === currentRoute ||
          (segment.level === 'module' && currentRoute.startsWith(item.route === '/' ? '/$' : item.route)) ||
          (segment.level === 'section' && currentRoute.startsWith(item.route));
        const isCurrent = item.num === segment.num;

        return (
          <button
            key={item.key}
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-colors cursor-pointer"
            style={{
              background: isCurrent
                ? accentTint(accent, 0.08)
                : "transparent",
            }}
            onClick={() => onItemClick(item.route)}
            onMouseEnter={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = palette.backgroundHover;
            }}
            onMouseLeave={(e) => {
              if (!isCurrent)
                e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: 600,
                color: isCurrent ? accent : palette.textTertiary,
                minWidth: 28,
              }}
            >
              {item.num}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? accent : palette.text,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}

      <style>{`
        @keyframes breadcrumb-dropdown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
