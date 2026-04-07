"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, LayoutGrid } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";

interface Props {
  onInsert: () => void;
  onDelete: () => void;
  hasSelection: boolean;
  rowHeight: number;
  onRowHeightChange: (h: number) => void;
}

const MIN_HEIGHT = 24;
const MAX_HEIGHT = 48;
const STEP = 4;

export function CellsSection({ onInsert, onDelete, hasSelection, rowHeight, onRowHeightChange }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
          dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const panelBg = isDark ? "#1C1C28" : "#FAFAFC";
  const panelBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const hoverBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const activeBg = isDark ? "rgba(62,123,250,0.20)" : "rgba(30,64,175,0.12)";

  return (
    <RibbonSection label="Cells">
      <RibbonButton icon={Plus} label="Insert" onClick={onInsert} shortcut="Ctrl+Shift+=" small />
      <RibbonButton icon={Minus} label="Delete" onClick={onDelete} disabled={!hasSelection} shortcut="Ctrl+-" small />
      <Tooltip content="Format">
        <button
          ref={btnRef}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center rounded transition-all duration-150"
          style={{ width: 40, height: 40, background: open ? activeBg : undefined }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = hoverBg; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = open ? activeBg : "transparent"; }}
        >
          <LayoutGrid size={20} strokeWidth={1.6} />
        </button>
      </Tooltip>

      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] rounded-xl p-3 select-none"
          style={{
            top: pos.top, left: pos.left, width: 160,
            background: panelBg, border: `1px solid ${panelBorder}`,
            boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(96,97,112,0.14)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div className="text-[11px] font-medium text-hz-text-secondary mb-2">Row Height</div>
          <div className="flex items-center gap-0">
            <button
              onClick={() => onRowHeightChange(Math.max(MIN_HEIGHT, rowHeight - STEP))}
              disabled={rowHeight <= MIN_HEIGHT}
              className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
              style={{ width: 32, height: 32, border: `1px solid ${panelBorder}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              −
            </button>
            <div
              className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
              style={{ width: 40, height: 32, borderTop: `1px solid ${panelBorder}`, borderBottom: `1px solid ${panelBorder}` }}
            >
              {rowHeight}
            </div>
            <button
              onClick={() => onRowHeightChange(Math.min(MAX_HEIGHT, rowHeight + STEP))}
              disabled={rowHeight >= MAX_HEIGHT}
              className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
              style={{ width: 32, height: 32, border: `1px solid ${panelBorder}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              +
            </button>
          </div>
        </div>,
        document.body
      )}
    </RibbonSection>
  );
}
