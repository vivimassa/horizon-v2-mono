"use client";

import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Palette } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";
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
    <RibbonSection label="Font & Alignment">
      {/* Font family + size */}
      <select
        className="h-7 px-1 rounded text-[11px] outline-none w-16"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        defaultValue="Mono"
        disabled={!hasSelection}
      >
        <option value="Mono">Mono</option>
        <option value="System">System</option>
        <option value="Arial">Arial</option>
      </select>
      <select
        className="h-7 px-1 rounded text-[11px] outline-none w-10"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        defaultValue="11"
        disabled={!hasSelection}
      >
        {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 36].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <MiniDivider isDark={isDark} />
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
    </RibbonSection>
  );
}

function MiniDivider({ isDark }: { isDark: boolean }) {
  return <div className="h-5 mx-0.5 shrink-0" style={{ width: 1, background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }} />;
}
