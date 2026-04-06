"use client";

import type { LucideIcon } from "lucide-react";

interface RibbonButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  shortcut?: string;
  small?: boolean;
}

export function RibbonButton({ icon: Icon, label, onClick, disabled, active, shortcut, small }: RibbonButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex flex-col items-center justify-center rounded-lg transition-all duration-100 select-none ${
        small ? "w-8 h-8" : "w-12 h-12"
      } ${
        active
          ? "bg-module-accent/15 text-module-accent"
          : disabled
            ? "text-hz-text-tertiary/40 cursor-not-allowed"
            : "text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text active:scale-95"
      }`}
    >
      <Icon size={small ? 14 : 16} strokeWidth={1.8} />
      {!small && <span className="text-[10px] font-medium mt-0.5 leading-none">{label}</span>}
    </button>
  );
}
