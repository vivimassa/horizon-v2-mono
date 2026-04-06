"use client";

import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Palette } from "lucide-react";
import { RibbonButton } from "./ribbon-button";

interface Props {
  hasSelection: boolean;
}

export function FontSection({ hasSelection }: Props) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
      <div className="flex items-center gap-0.5">
        {/* Font family + size (compact) */}
        <select
          className="h-7 px-1 rounded text-[11px] border border-hz-border bg-hz-bg text-hz-text outline-none w-16"
          defaultValue="Mono"
          disabled={!hasSelection}
        >
          <option value="Mono">Mono</option>
          <option value="System">System</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
        </select>
        <select
          className="h-7 px-1 rounded text-[11px] border border-hz-border bg-hz-bg text-hz-text outline-none w-11"
          defaultValue="11"
          disabled={!hasSelection}
        >
          {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-hz-border/50 mx-0.5" />

        {/* Formatting buttons */}
        <RibbonButton icon={Bold} label="Bold" shortcut="Ctrl+B" disabled={!hasSelection} small />
        <RibbonButton icon={Italic} label="Italic" shortcut="Ctrl+I" disabled={!hasSelection} small />
        <RibbonButton icon={Underline} label="Underline" shortcut="Ctrl+U" disabled={!hasSelection} small />

        <div className="w-px h-5 bg-hz-border/50 mx-0.5" />

        {/* Color */}
        <RibbonButton icon={Type} label="Color" disabled={!hasSelection} small />
        <RibbonButton icon={Palette} label="Fill" disabled={!hasSelection} small />

        <div className="w-px h-5 bg-hz-border/50 mx-0.5" />

        {/* Alignment */}
        <RibbonButton icon={AlignLeft} label="Left" disabled={!hasSelection} small />
        <RibbonButton icon={AlignCenter} label="Center" disabled={!hasSelection} small />
        <RibbonButton icon={AlignRight} label="Right" disabled={!hasSelection} small />
      </div>
      <span className="text-[10px] text-hz-text-tertiary font-medium">Font & Alignment</span>
    </div>
  );
}
