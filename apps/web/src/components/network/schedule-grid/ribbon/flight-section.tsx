"use client";

import { Plus, Trash2 } from "lucide-react";
import { RibbonButton } from "./ribbon-button";

interface Props {
  onAdd: () => void;
  onRemove: () => void;
  hasSelection: boolean;
}

export function FlightSection({ onAdd, onRemove, hasSelection }: Props) {
  return (
    <RibbonSection label="Flight">
      <RibbonButton icon={Plus} label="Add" onClick={onAdd} shortcut="Insert" />
      <RibbonButton icon={Trash2} label="Remove" onClick={onRemove} disabled={!hasSelection} shortcut="Ctrl+Del" />
    </RibbonSection>
  );
}

export function RibbonSection({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col items-center self-stretch justify-between pt-3 pb-1.5 ${wide ? "px-4 min-w-[280px]" : "px-3"}`}>
      <div className="flex items-center justify-center gap-2 flex-1">
        {children}
      </div>
      <div className="w-full text-center border-t border-hz-border/20 pt-1 mt-1">
        <span className="text-[11px] text-hz-text-tertiary/50 font-medium leading-none whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
}
