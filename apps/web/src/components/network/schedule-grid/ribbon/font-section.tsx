"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Palette } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { Dropdown } from "@/components/ui/dropdown";
import { useTheme } from "@/components/theme-provider";
import { useScheduleGridStore } from "@/stores/use-schedule-grid-store";
import { GRID_COLUMNS } from "../grid-columns";

interface Props {
  hasSelection: boolean;
}

export function FontSection({ hasSelection }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const inputBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";
  const inputBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

  const toggleBold = useScheduleGridStore((s) => s.toggleBold);
  const toggleItalic = useScheduleGridStore((s) => s.toggleItalic);
  const toggleUnderline = useScheduleGridStore((s) => s.toggleUnderline);
  const setCellFormat = useScheduleGridStore((s) => s.setCellFormat);
  const selectedCell = useScheduleGridStore((s) => s.selectedCell);
  const rows = useScheduleGridStore((s) => s.rows);
  const newRowIds = useScheduleGridStore((s) => s.newRowIds);

  const deletedIds = useScheduleGridStore((s) => s.deletedIds);
  const selectionRange = useScheduleGridStore((s) => s.selectionRange);

  const forEachCell = (fn: (rowId: string, colKey: string) => void) => {
    const allRows = rows.filter((r) => !deletedIds.has(r._id));
    if (selectionRange) {
      const r1 = Math.min(selectionRange.startRow, selectionRange.endRow);
      const r2 = Math.max(selectionRange.startRow, selectionRange.endRow);
      const c1 = Math.min(selectionRange.startCol, selectionRange.endCol);
      const c2 = Math.max(selectionRange.startCol, selectionRange.endCol);
      for (let ri = r1; ri <= r2; ri++) {
        const row = allRows[ri];
        if (!row) continue;
        for (let ci = c1; ci <= c2; ci++) {
          const col = GRID_COLUMNS[ci];
          if (col) fn(row._id, col.key);
        }
      }
    } else if (selectedCell) {
      const row = allRows[selectedCell.rowIdx];
      if (row) fn(row._id, selectedCell.colKey);
    }
  };

  const handleAlign = (align: "left" | "center" | "right") => {
    forEachCell((rowId, colKey) => setCellFormat(rowId, colKey, { textAlign: align }));
  };

  const [fontFamily, setFontFamily] = useState("Mono");
  const [fontSize, setFontSize] = useState("13");

  const handleFontFamily = (family: string) => {
    setFontFamily(family);
    forEachCell((rowId, colKey) => setCellFormat(rowId, colKey, { fontFamily: family }));
  };

  const handleFontSize = (sizeStr: string) => {
    setFontSize(sizeStr);
    forEachCell((rowId, colKey) => setCellFormat(rowId, colKey, { fontSize: Number(sizeStr) }));
  };

  const FONT_OPTIONS = [
    { value: "Mono", label: "JetBrains Mono" },
    { value: "Inter", label: "Inter" },
    { value: "SF Pro", label: "SF Pro" },
    { value: "Roboto", label: "Roboto" },
    { value: "Helvetica Neue", label: "Helvetica Neue" },
    { value: "Arial", label: "Arial" },
    { value: "Segoe UI", label: "Segoe UI" },
  ];

  const SIZE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 36].map(s => ({
    value: String(s), label: String(s),
  }));

  return (
    <div className="flex flex-col self-stretch justify-between pt-3 pb-1.5 px-4">
      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        {/* Row 1: Font family + size (full width) */}
        <div className="flex items-center gap-1.5">
          <Dropdown
            options={FONT_OPTIONS}
            value={fontFamily}
            onChange={handleFontFamily}
            size="sm"
            disabled={!hasSelection}
            className="flex-1"
          />
          <Dropdown
            options={SIZE_OPTIONS}
            value={fontSize}
            onChange={handleFontSize}
            size="sm"
            disabled={!hasSelection}
            className="w-16"
          />
        </div>

        {/* Row 2: B/I/U + Color + Fill + Alignment */}
        <div className="flex items-center gap-1">
          <RibbonButton icon={Bold} label="Bold" shortcut="Ctrl+B" disabled={!hasSelection} onClick={toggleBold} small />
          <RibbonButton icon={Italic} label="Italic" shortcut="Ctrl+I" disabled={!hasSelection} onClick={toggleItalic} small />
          <RibbonButton icon={Underline} label="Underline" shortcut="Ctrl+U" disabled={!hasSelection} onClick={toggleUnderline} small />
          <MiniDivider isDark={isDark} />
          <ColorPickerButton
            icon={Type} label="Font Color" disabled={!hasSelection} isDark={isDark}
            onPick={(color) => forEachCell((rowId, colKey) => setCellFormat(rowId, colKey, { textColor: color }))}
          />
          <ColorPickerButton
            icon={Palette} label="Fill Color" disabled={!hasSelection} isDark={isDark}
            onPick={(color) => forEachCell((rowId, colKey) => setCellFormat(rowId, colKey, { bgColor: color }))}
          />
          <MiniDivider isDark={isDark} />
          <RibbonButton icon={AlignLeft} label="Left" disabled={!hasSelection} onClick={() => handleAlign("left")} small />
          <RibbonButton icon={AlignCenter} label="Center" disabled={!hasSelection} onClick={() => handleAlign("center")} small />
          <RibbonButton icon={AlignRight} label="Right" disabled={!hasSelection} onClick={() => handleAlign("right")} small />
        </div>
      </div>

      {/* Section label */}
      <div className="w-full text-center border-t border-hz-border/20 pt-1 mt-1">
        <span className="text-[11px] text-hz-text-tertiary/50 font-medium leading-none">Font & Alignment</span>
      </div>
    </div>
  );
}

function MiniDivider({ isDark }: { isDark: boolean }) {
  return <div className="h-5 mx-0.5 shrink-0" style={{ width: 1, background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }} />;
}

// ─── Color Palette ──────────────────────────────────────────────────────────

const PALETTE = [
  // Row 1: theme colors
  "#000000", "#1C1C28", "#555770", "#8F90A6", "#C7C9D9", "#E4E4EB", "#F2F2F5", "#FFFFFF",
  // Row 2: vivid
  "#FF3B3B", "#FF8800", "#FFCC00", "#06C270", "#0063F7", "#6B4EFF", "#E63535", "#00B7C4",
  // Row 3: pastel
  "#FFE5E5", "#FFF3D6", "#FFF8CC", "#D6F5E8", "#D6E4FF", "#EDE5FF", "#FCE4E4", "#D6F7FA",
  // Row 4: mid-tone
  "#FF7A7A", "#FFB347", "#FFE066", "#57D9A3", "#5B8DEF", "#9B8AFF", "#F06060", "#73DFE7",
  // Row 5: dark
  "#B71C1C", "#E65100", "#F57F17", "#1B5E20", "#0D47A1", "#4A148C", "#880E4F", "#006064",
];

interface ColorPickerButtonProps {
  icon: typeof Type;
  label: string;
  disabled: boolean;
  isDark: boolean;
  onPick: (color: string) => void;
}

function ColorPickerButton({ icon: Icon, label, disabled, isDark, onPick }: ColorPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hoverBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const panelBg = isDark ? "rgba(25,25,33,0.95)" : "rgba(255,255,255,0.98)";
  const panelBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  return (
    <>
      <Tooltip content={label}>
        <button
          ref={btnRef}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`flex items-center justify-center rounded transition-all duration-150 ${disabled ? "opacity-30 pointer-events-none" : ""}`}
          style={{ width: 40, height: 40 }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Icon size={20} strokeWidth={1.6} />
        </button>
      </Tooltip>
      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] rounded-xl p-3 select-none"
          style={{
            top: pos.top, left: pos.left, width: 220,
            background: panelBg, border: `1px solid ${panelBorder}`,
            backdropFilter: "blur(20px)",
            boxShadow: isDark
              ? "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)"
              : "0 8px 32px rgba(96,97,112,0.14), 0 2px 8px rgba(96,97,112,0.08)",
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: isDark ? "#8F90A6" : "#555770" }}>
            {label}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => { onPick(color); setOpen(false); }}
                className="rounded transition-transform hover:scale-125"
                style={{
                  width: 22, height: 22,
                  background: color,
                  border: color === "#FFFFFF" ? `1px solid ${panelBorder}` : "1px solid transparent",
                }}
                title={color}
              />
            ))}
          </div>
          <button
            onClick={() => { onPick(""); setOpen(false); }}
            className="mt-2 text-[11px] font-medium w-full text-center py-1 rounded-md transition-colors"
            style={{ color: isDark ? "#8F90A6" : "#555770" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            No Color
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
