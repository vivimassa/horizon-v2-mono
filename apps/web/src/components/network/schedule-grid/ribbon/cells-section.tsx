"use client";

import { Plus, Minus, LayoutGrid } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";

interface Props {
  onInsert: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

export function CellsSection({ onInsert, onDelete, hasSelection }: Props) {
  return (
    <RibbonSection label="Cells">
      <RibbonButton icon={Plus} label="Insert" onClick={onInsert} shortcut="Ctrl+Shift+=" small />
      <RibbonButton icon={Minus} label="Delete" onClick={onDelete} disabled={!hasSelection} shortcut="Ctrl+-" small />
      <RibbonButton icon={LayoutGrid} label="Format" disabled={!hasSelection} small />
    </RibbonSection>
  );
}
