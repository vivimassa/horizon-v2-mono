"use client";

import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface RibbonButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  shortcut?: string;
  /** Small = 32x32 icon-only. Large (default) = 58x52 icon+label */
  small?: boolean;
}

export function RibbonButton({ icon: Icon, label, onClick, disabled, active, shortcut, small }: RibbonButtonProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const hoverBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const activeBg = isDark ? "rgba(62,123,250,0.20)" : "rgba(30,64,175,0.12)";

  if (small) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={shortcut ? `${label} (${shortcut})` : label}
        className={`flex items-center justify-center rounded transition-all duration-150 ${
          disabled ? "opacity-30 pointer-events-none" : ""
        }`}
        style={{
          width: 32, height: 32,
          background: active ? activeBg : undefined,
          color: active ? (isDark ? "#5B8DEF" : "#1e40af") : undefined,
        }}
        onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? activeBg : "transparent"; }}
      >
        <Icon size={16} strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg transition-all duration-150 ${
        disabled ? "opacity-30 pointer-events-none" : ""
      }`}
      style={{
        width: 58, height: 52,
        background: active ? activeBg : undefined,
        color: active ? (isDark ? "#5B8DEF" : "#1e40af") : undefined,
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? activeBg : "transparent"; }}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
