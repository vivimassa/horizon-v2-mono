"use client";

import { Scissors, Copy, ClipboardPaste, Paintbrush } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";

interface Props {
  hasSelection: boolean;
}

export function ClipboardSection({ hasSelection }: Props) {
  const copyCell = useScheduleGridStore((s) => s.copyCell);
  const cutCell = useScheduleGridStore((s) => s.cutCell);
  const pasteCell = useScheduleGridStore((s) => s.pasteCell);
  const activateFormatPainter = useScheduleGridStore((s) => s.activateFormatPainter);
  const formatPainterSource = useScheduleGridStore((s) => s.formatPainterSource);

  return (
    <RibbonSection label="Clipboard">
      <RibbonButton icon={Scissors} label="Cut" shortcut="Ctrl+X" disabled={!hasSelection} onClick={cutCell} small />
      <RibbonButton icon={Copy} label="Copy" shortcut="Ctrl+C" disabled={!hasSelection} onClick={copyCell} small />
      <RibbonButton icon={ClipboardPaste} label="Paste" shortcut="Ctrl+V" onClick={() => pasteCell()} small />
      <RibbonButton icon={Paintbrush} label="Format Painter" disabled={!hasSelection} onClick={activateFormatPainter} active={formatPainterSource !== null} small />
    </RibbonSection>
  );
}
