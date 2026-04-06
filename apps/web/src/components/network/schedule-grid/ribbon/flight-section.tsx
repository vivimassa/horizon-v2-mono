"use client";

import { PlaneTakeoff, Trash2 } from "lucide-react";
import { RibbonButton } from "./ribbon-button";

interface Props {
  onAdd: () => void;
  onRemove: () => void;
  hasSelection: boolean;
}

export function FlightSection({ onAdd, onRemove, hasSelection }: Props) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 gap-0.5">
      <div className="flex items-center gap-1">
        <RibbonButton icon={PlaneTakeoff} label="Add" onClick={onAdd} shortcut="Ctrl+N" />
        <RibbonButton icon={Trash2} label="Remove" onClick={onRemove} disabled={!hasSelection} shortcut="Ctrl+Del" />
      </div>
      <span className="text-[10px] text-hz-text-tertiary font-medium">Flight</span>
    </div>
  );
}
