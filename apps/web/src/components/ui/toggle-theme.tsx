"use client";

import React from "react";
import { MonitorCogIcon, MoonStarIcon, SunIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { colors, type Palette as PaletteType } from "@skyhub/ui/theme";

type ThemeValue = "system" | "light" | "dark";

const THEME_OPTIONS: { icon: typeof SunIcon; value: ThemeValue }[] = [
  { icon: SunIcon, value: "light" },
  { icon: MoonStarIcon, value: "dark" },
];

export function ToggleTheme() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const palette: PaletteType = isDark ? colors.dark : colors.light;

  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="flex h-8 w-16" />;
  }

  return (
    <motion.div
      key={String(isMounted)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center overflow-hidden rounded-lg"
      style={{
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
      }}
      role="radiogroup"
    >
      {THEME_OPTIONS.map((option) => {
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            className={cn(
              "relative flex size-8 cursor-pointer items-center justify-center rounded-md transition-all",
              isActive ? "text-foreground" : "opacity-40 hover:opacity-70"
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={`Switch to ${option.value} theme`}
            onClick={() => {
              if (!isActive) toggle();
            }}
          >
            {isActive && (
              <motion.div
                layoutId="theme-option"
                transition={{
                  type: "spring",
                  bounce: 0.1,
                  duration: 0.75,
                }}
                className="absolute inset-0.5 rounded-md"
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.8)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
                  boxShadow: isDark
                    ? "none"
                    : "0 1px 3px rgba(0,0,0,0.08)",
                }}
              />
            )}
            <option.icon
              className="relative size-4"
              style={{
                color: isActive ? palette.text : palette.textTertiary,
              }}
              strokeWidth={1.8}
            />
          </button>
        );
      })}
    </motion.div>
  );
}
