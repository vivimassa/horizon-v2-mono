"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveModule, MODULE_THEMES } from "@skyhub/constants";

type Theme = "light" | "dark";
type ModuleKey = "network" | "operations" | "ground" | "workforce" | "integration" | "admin" | null;

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  moduleKey: ModuleKey;
  moduleTheme: { accent: string; bg: string; bgSubtle: string } | null;
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
  moduleKey: null,
  moduleTheme: null,
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const pathname = usePathname();

  // Resolve current module
  const currentModule = resolveModule(pathname);
  const moduleKey = (currentModule?.module ?? null) as ModuleKey;
  const moduleTheme = moduleKey ? MODULE_THEMES[moduleKey] ?? null : null;

  // Apply module theme CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    if (moduleTheme) {
      root.style.setProperty("--module-accent", moduleTheme.accent);
      root.style.setProperty("--module-bg", moduleTheme.bg);
      root.style.setProperty("--module-bg-subtle", moduleTheme.bgSubtle);

      // For dark mode, adjust the bg colors to be more subtle/transparent
      if (theme === "dark") {
        root.style.setProperty("--module-bg", hexToRgba(moduleTheme.accent, 0.12));
        root.style.setProperty("--module-bg-subtle", hexToRgba(moduleTheme.accent, 0.06));
      }
    } else {
      root.style.setProperty("--module-accent", "#1e40af");
      root.style.setProperty("--module-bg", theme === "dark" ? "rgba(30, 64, 175, 0.12)" : "#dbeafe");
      root.style.setProperty("--module-bg-subtle", theme === "dark" ? "rgba(30, 64, 175, 0.06)" : "#eff6ff");
    }
  }, [moduleKey, moduleTheme, theme]);

  // Init theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("hz-theme") as Theme | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("hz-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <ThemeCtx.Provider value={{ theme, toggle, moduleKey, moduleTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
