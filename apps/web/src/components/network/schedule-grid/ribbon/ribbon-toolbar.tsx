"use client";

import { useTheme } from "@/components/theme-provider";
import { FlightSection } from "./flight-section";
import { ClipboardSection } from "./clipboard-section";
import { FontSection } from "./font-section";
import { CellsSection } from "./cells-section";
import { UtilitySections } from "./utility-sections";

interface RibbonToolbarProps {
  onAddFlight: () => void;
  onInsertFlight: () => void;
  onDeleteFlight: () => void;
  onSave: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onScenario?: () => void;
  onMessage?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onSaveAs?: () => void;
  hasDirty: boolean;
  hasSelection: boolean;
  saving: boolean;
  rowHeight: number;
  onRowHeightChange: (h: number) => void;
}

export function RibbonToolbar({
  onAddFlight, onInsertFlight, onDeleteFlight, onSave,
  onImport, onExport, onScenario, onMessage, onFind, onReplace, onSaveAs,
  hasDirty, hasSelection, saving, rowHeight, onRowHeightChange,
}: RibbonToolbarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassBg = isDark ? "rgba(25,25,33,0.85)" : "rgba(255,255,255,0.85)";
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  return (
    <div
      className="flex items-stretch gap-0 rounded-2xl shrink-0 overflow-x-auto"
      style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)", minHeight: 120 }}
    >
      <FlightSection onAdd={onAddFlight} onRemove={onDeleteFlight} hasSelection={hasSelection} />
      <Divider isDark={isDark} />
      <ClipboardSection hasSelection={hasSelection} />
      <Divider isDark={isDark} />
      <FontSection hasSelection={hasSelection} />
      <Divider isDark={isDark} />
      <CellsSection onInsert={onInsertFlight} onDelete={onDeleteFlight} hasSelection={hasSelection} rowHeight={rowHeight} onRowHeightChange={onRowHeightChange} />
      <Divider isDark={isDark} />
      <UtilitySections
        onSave={onSave} onImport={onImport} onExport={onExport}
        onScenario={onScenario} onMessage={onMessage} onFind={onFind} onReplace={onReplace} onSaveAs={onSaveAs}
        hasDirty={hasDirty} saving={saving}
      />
    </div>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="self-stretch shrink-0"
      style={{ width: 1, background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }}
    />
  );
}
