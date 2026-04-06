"use client";

import { FlightSection } from "./flight-section";
import { ClipboardSection } from "./clipboard-section";
import { FontSection } from "./font-section";
import { CellsSection } from "./cells-section";
import { UtilitySections } from "./utility-sections";

interface RibbonToolbarProps {
  onAddFlight: () => void;
  onDeleteFlight: () => void;
  onSave: () => void;
  hasDirty: boolean;
  hasSelection: boolean;
  saving: boolean;
}

export function RibbonToolbar({
  onAddFlight,
  onDeleteFlight,
  onSave,
  hasDirty,
  hasSelection,
  saving,
}: RibbonToolbarProps) {
  return (
    <div className="flex items-stretch gap-0 border border-hz-border rounded-xl bg-hz-card overflow-hidden shrink-0">
      {/* Flight */}
      <FlightSection onAdd={onAddFlight} onRemove={onDeleteFlight} hasSelection={hasSelection} />
      <Divider />

      {/* Clipboard */}
      <ClipboardSection hasSelection={hasSelection} />
      <Divider />

      {/* Font & Alignment */}
      <FontSection hasSelection={hasSelection} />
      <Divider />

      {/* Cells */}
      <CellsSection onInsert={onAddFlight} onDelete={onDeleteFlight} hasSelection={hasSelection} />
      <Divider />

      {/* Utility sections */}
      <UtilitySections onSave={onSave} hasDirty={hasDirty} saving={saving} />
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-hz-border/50 self-stretch" />;
}
