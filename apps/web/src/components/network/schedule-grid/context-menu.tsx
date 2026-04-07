"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Copy, Scissors, ClipboardPaste, SplitSquareVertical, ChevronRight, Circle } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export interface ContextMenuState {
  x: number;
  y: number;
  rowIdx: number;
  colKey: string;
}

type FlightStatus = "draft" | "active" | "suspended" | "cancelled";

const STATUS_OPTIONS: { value: FlightStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "#E67A00" },
  { value: "active", label: "Active", color: "#06C270" },
  { value: "suspended", label: "Suspended", color: "#8F90A6" },
  { value: "cancelled", label: "Cancelled", color: "#E63535" },
];

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onInsertRow: () => void;
  onDeleteRow: () => void;
  onSeparateCycle: () => void;
  onRemoveSeparator?: () => void;
  hasSeparator: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  hasSelection: boolean;
  currentStatus?: FlightStatus;
  onChangeStatus?: (status: FlightStatus) => void;
}

export function GridContextMenu({
  state, onClose, onInsertRow, onDeleteRow, onSeparateCycle, onRemoveSeparator,
  hasSeparator, onCopy, onCut, onPaste, hasSelection, currentStatus, onChangeStatus,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [showStatusSub, setShowStatusSub] = useState(false);
  const statusBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // Use mousedown so left-click AND right-click outside both close the menu
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleEsc, { capture: true });
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleEsc, { capture: true });
    };
  }, [onClose]);

  // Position menu within viewport
  const menuW = 220;
  const menuH = 320;
  let mx = state.x, my = state.y;
  if (mx + menuW > window.innerWidth - 8) mx = window.innerWidth - menuW - 8;
  if (my + menuH > window.innerHeight - 8) my = window.innerHeight - menuH - 8;

  // Inverted: dark bg on light mode, light bg on dark mode (tooltip-style)
  const bg = isDark ? "#F2F2F5" : "#1C1C28";
  const border = isDark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const hoverBg = isDark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const destructiveHover = "rgba(239,68,68,0.15)";
  const textColor = isDark ? "#1C1C28" : "#E4E4EB";
  const secondaryText = isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";

  const MenuItem = ({ label, shortcut, onClick, destructive, icon: Icon }: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    destructive?: boolean;
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  }) => (
    <button
      onClick={(ev) => { ev.stopPropagation(); onClick(); onClose(); }}
      className="w-full text-left px-3 py-1.5 text-[13px] rounded-lg transition-colors flex items-center justify-between gap-4"
      style={{ color: destructive ? "#E63535" : textColor }}
      onMouseEnter={(ev) => { ev.currentTarget.style.background = destructive ? destructiveHover : hoverBg; setShowStatusSub(false); }}
      onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
    >
      <span className="flex items-center gap-2">
        <Icon size={14} className="opacity-60" />
        {label}
      </span>
      {shortcut && <span className="text-[11px] font-mono" style={{ color: secondaryText }}>{shortcut}</span>}
    </button>
  );

  const Divider = () => (
    <div className="h-px my-1 mx-2" style={{ background: border }} />
  );

  return (
    <div ref={menuRef} className="fixed z-[9999]" style={{ left: mx, top: my }}>
      <div
        className="rounded-xl overflow-visible py-1.5 min-w-[220px]"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.15)"
            : "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Row info */}
        <div className="px-3 py-1 text-[11px] font-mono font-medium" style={{ color: secondaryText }}>
          Row {state.rowIdx + 1}
        </div>
        <Divider />

        <MenuItem label="Copy" shortcut="Ctrl+C" icon={Copy} onClick={onCopy} />
        <MenuItem label="Cut" shortcut="Ctrl+X" icon={Scissors} onClick={onCut} />
        <MenuItem label="Paste" shortcut="Ctrl+V" icon={ClipboardPaste} onClick={onPaste} />

        <Divider />

        <MenuItem label="Insert Row" shortcut="Insert" icon={Plus} onClick={onInsertRow} />

        {hasSeparator ? (
          <MenuItem label="Remove Separator" icon={SplitSquareVertical} onClick={() => onRemoveSeparator?.()} />
        ) : (
          <MenuItem label="Separate Cycle" icon={SplitSquareVertical} onClick={onSeparateCycle} />
        )}

        {/* Change Status — submenu */}
        {onChangeStatus && (
          <>
            <Divider />
            <div
              ref={statusBtnRef}
              className="relative"
              onMouseEnter={() => setShowStatusSub(true)}
              onMouseLeave={() => setShowStatusSub(false)}
            >
              <button
                className="w-full text-left px-3 py-1.5 text-[13px] rounded-lg transition-colors flex items-center justify-between gap-4"
                style={{ color: textColor }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = hoverBg; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
                onClick={(ev) => { ev.stopPropagation(); setShowStatusSub((s) => !s); }}
              >
                <span className="flex items-center gap-2">
                  <Circle size={14} className="opacity-60" style={{ fill: STATUS_OPTIONS.find((s) => s.value === currentStatus)?.color, color: STATUS_OPTIONS.find((s) => s.value === currentStatus)?.color }} />
                  Change Status
                </span>
                <ChevronRight size={12} style={{ color: secondaryText }} />
              </button>

              {/* Submenu — auto-flip if overflows viewport */}
              {showStatusSub && (() => {
                const subW = 160, subH = 140;
                const rect = statusBtnRef.current?.getBoundingClientRect();
                const flipH = rect ? (rect.right + subW + 8 > window.innerWidth) : false;
                const flipV = rect ? (rect.top + subH > window.innerHeight - 8) : false;
                return (
                <div
                  className="absolute rounded-xl py-1.5 min-w-[160px]"
                  style={{
                    [flipH ? "right" : "left"]: "100%",
                    [flipH ? "marginRight" : "marginLeft"]: 4,
                    [flipV ? "bottom" : "top"]: 0,
                    background: bg,
                    border: `1px solid ${border}`,
                    boxShadow: isDark
                      ? "0 8px 32px rgba(0,0,0,0.15)"
                      : "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={(ev) => { ev.stopPropagation(); onChangeStatus(opt.value); onClose(); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] rounded-lg transition-colors flex items-center gap-2"
                      style={{ color: textColor, fontWeight: currentStatus === opt.value ? 600 : 400 }}
                      onMouseEnter={(ev) => { ev.currentTarget.style.background = hoverBg; }}
                      onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
                    >
                      <Circle size={10} style={{ fill: opt.color, color: opt.color }} />
                      {opt.label}
                      {currentStatus === opt.value && (
                        <span className="text-[10px] font-mono ml-auto" style={{ color: secondaryText }}>current</span>
                      )}
                    </button>
                  ))}
                </div>
                );
              })()}
            </div>
          </>
        )}

        <Divider />

        <MenuItem label="Delete Row" shortcut="Ctrl+Del" icon={Trash2} onClick={onDeleteRow} destructive />
      </div>
    </div>
  );
}
