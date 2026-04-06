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
  onImport?: () => void;
  onExport?: () => void;
  onScenario?: () => void;
  onMessage?: () => void;
  onFind?: () => void;
  hasDirty: boolean;
  hasSelection: boolean;
  saving: boolean;
}

export function RibbonToolbar({
  onAddFlight, onDeleteFlight, onSave,
  onImport, onExport, onScenario, onMessage, onFind,
  hasDirty, hasSelection, saving,
}: RibbonToolbarProps) {
  return (
    <div className="flex items-stretch gap-0 border border-hz-border rounded-xl bg-hz-card overflow-hidden shrink-0">
      <FlightSection onAdd={onAddFlight} onRemove={onDeleteFlight} hasSelection={hasSelection} />
      <Divider />
      <ClipboardSection hasSelection={hasSelection} />
      <Divider />
      <FontSection hasSelection={hasSelection} />
      <Divider />
      <CellsSection onInsert={onAddFlight} onDelete={onDeleteFlight} hasSelection={hasSelection} />
      <Divider />
      <UtilitySections
        onSave={onSave}
        onImport={onImport}
        onExport={onExport}
        onScenario={onScenario}
        onMessage={onMessage}
        onFind={onFind}
        hasDirty={hasDirty}
        saving={saving}
      />
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-hz-border/50 self-stretch" />;
}
