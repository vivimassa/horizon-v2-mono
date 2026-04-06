"use client";

import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Palette } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { useTheme } from "@/components/theme-provider";

interface Props {
  hasSelection: boolean;
}

export function FontSection({ hasSelection }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const inputBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";
  const inputBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

  return (
    <div className="flex flex-col self-stretch justify-between py-2 px-4">
      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        {/* Row 1: Font family + size (full width) */}
        <div className="flex items-center gap-1.5">
          <select
            className="h-8 px-2 rounded-lg text-[12px] outline-none flex-1"
            style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            defaultValue="Mono"
            disabled={!hasSelection}
          >
            <option value="Mono">Mono</option>
            <option value="System">System</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
          </select>
          <select
            className="h-8 px-2 rounded-lg text-[12px] outline-none w-16"
            style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            defaultValue="11"
            disabled={!hasSelection}
          >
            {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 36].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Row 2: B/I/U + Color + Fill + Alignment */}
        <div className="flex items-center gap-1">
          <RibbonButton icon={Bold} label="Bold" shortcut="Ctrl+B" disabled={!hasSelection} small />
          <RibbonButton icon={Italic} label="Italic" shortcut="Ctrl+I" disabled={!hasSelection} small />
          <RibbonButton icon={Underline} label="Underline" shortcut="Ctrl+U" disabled={!hasSelection} small />
          <MiniDivider isDark={isDark} />
          <RibbonButton icon={Type} label="Color" disabled={!hasSelection} small />
          <RibbonButton icon={Palette} label="Fill" disabled={!hasSelection} small />
          <MiniDivider isDark={isDark} />
          <RibbonButton icon={AlignLeft} label="Left" disabled={!hasSelection} small />
          <RibbonButton icon={AlignCenter} label="Center" disabled={!hasSelection} small />
          <RibbonButton icon={AlignRight} label="Right" disabled={!hasSelection} small />
        </div>
      </div>

      {/* Section label */}
      <div className="w-full text-center border-t border-hz-border/20 pt-1.5 mt-1.5">
        <span className="text-[11px] text-hz-text-tertiary/50 font-medium leading-none">Font & Alignment</span>
      </div>
    </div>
  );
}

function MiniDivider({ isDark }: { isDark: boolean }) {
  return <div className="h-5 mx-0.5 shrink-0" style={{ width: 1, background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }} />;
}
