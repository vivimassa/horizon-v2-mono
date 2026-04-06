"use client";

import { Scissors, Copy, ClipboardPaste, Paintbrush } from "lucide-react";
import { RibbonButton } from "./ribbon-button";

interface Props {
  hasSelection: boolean;
}

export function ClipboardSection({ hasSelection }: Props) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
      <div className="flex items-center gap-0.5">
        <RibbonButton icon={Scissors} label="Cut" shortcut="Ctrl+X" disabled={!hasSelection} small />
        <RibbonButton icon={Copy} label="Copy" shortcut="Ctrl+C" disabled={!hasSelection} small />
        <RibbonButton icon={ClipboardPaste} label="Paste" shortcut="Ctrl+V" small />
        <RibbonButton icon={Paintbrush} label="Format" disabled={!hasSelection} small />
      </div>
      <span className="text-[10px] text-hz-text-tertiary font-medium">Clipboard</span>
    </div>
  );
}
