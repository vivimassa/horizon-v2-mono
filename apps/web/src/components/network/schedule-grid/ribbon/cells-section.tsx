"use client";

import { Plus, Minus, LayoutGrid } from "lucide-react";
import { RibbonButton } from "./ribbon-button";

interface Props {
  onInsert: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

export function CellsSection({ onInsert, onDelete, hasSelection }: Props) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
      <div className="flex items-center gap-0.5">
        <RibbonButton icon={Plus} label="Insert" onClick={onInsert} shortcut="Ctrl+Shift+=" small />
        <RibbonButton icon={Minus} label="Delete" onClick={onDelete} disabled={!hasSelection} shortcut="Ctrl+-" small />
        <RibbonButton icon={LayoutGrid} label="Format" disabled={!hasSelection} small />
      </div>
      <span className="text-[10px] text-hz-text-tertiary font-medium">Cells</span>
    </div>
  );
}
