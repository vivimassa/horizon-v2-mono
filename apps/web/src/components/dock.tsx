"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  Plane,
  Warehouse,
  Users,
  ArrowLeftRight,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTopLevelModules, MODULE_THEMES, resolveModule } from "@skyhub/constants";
import { useTheme } from "./theme-provider";

const ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  Plane,
  Warehouse,
  Users,
  ArrowLeftRight,
  Settings,
};

export function Dock() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const topModules = getTopLevelModules();
  const currentModule = resolveModule(pathname);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className="flex items-center gap-1.5 px-3 rounded-2xl shadow-lg border border-black/10 dark:border-white/10"
        style={{
          height: 64,
          background: theme === "dark"
            ? "rgba(30, 30, 30, 0.80)"
            : "rgba(255, 255, 255, 0.80)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        }}
      >
        {topModules.map((mod) => {
          const Icon = ICON_MAP[mod.icon] ?? Globe;
          const isActive = currentModule?.module === mod.module;
          const themeColors = MODULE_THEMES[mod.module];

          return (
            <Link
              key={mod.code}
              href={mod.route}
              className="flex flex-col items-center justify-center transition-colors duration-150"
              style={{ width: 56 }}
            >
              <div
                className={`flex items-center justify-center rounded-xl transition-all duration-150 ${
                  isActive
                    ? "shadow-sm"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                style={{
                  width: 40,
                  height: 40,
                  ...(isActive
                    ? { backgroundColor: themeColors.accent }
                    : {}),
                }}
              >
                <Icon
                  className={`h-[18px] w-[18px] ${
                    isActive
                      ? "text-white"
                      : "text-hz-text-secondary"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 leading-tight ${
                  isActive
                    ? "font-semibold text-hz-text"
                    : "text-hz-text-secondary"
                }`}
              >
                {mod.name}
              </span>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="w-px h-8 bg-hz-border mx-1" />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-hz-text-secondary hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150"
        >
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
