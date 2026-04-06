"use client";

import { Scissors, Copy, ClipboardPaste, Paintbrush } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";

interface Props {
  hasSelection: boolean;
}

export function ClipboardSection({ hasSelection }: Props) {
  return (
    <RibbonSection label="Clipboard">
      <RibbonButton icon={Scissors} label="Cut" shortcut="Ctrl+X" disabled={!hasSelection} small />
      <RibbonButton icon={Copy} label="Copy" shortcut="Ctrl+C" disabled={!hasSelection} small />
      <RibbonButton icon={ClipboardPaste} label="Paste" shortcut="Ctrl+V" small />
      <RibbonButton icon={Paintbrush} label="Format" disabled={!hasSelection} small />
    </RibbonSection>
  );
}
