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
    <RibbonSection label="Flight">
      <RibbonButton icon={PlaneTakeoff} label="Add" onClick={onAdd} shortcut="Ctrl+N" />
      <RibbonButton icon={Trash2} label="Remove" onClick={onRemove} disabled={!hasSelection} shortcut="Ctrl+Del" />
    </RibbonSection>
  );
}

export function RibbonSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="flex items-center gap-0.5">
        {children}
      </div>
      <span className="text-[10px] text-hz-text-tertiary/50 font-medium mt-0.5 leading-none">{label}</span>
    </div>
  );
}
