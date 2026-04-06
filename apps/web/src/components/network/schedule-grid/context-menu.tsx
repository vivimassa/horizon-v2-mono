"use client";

import { useEffect, useRef } from "react";
import { Plus, Trash2, Copy, Scissors, ClipboardPaste, SplitSquareVertical, ArrowDown } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export interface ContextMenuState {
  x: number;
  y: number;
  rowIdx: number;
  colKey: string;
}

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
}

export function GridContextMenu({
  state, onClose, onInsertRow, onDeleteRow, onSeparateCycle, onRemoveSeparator,
  hasSeparator, onCopy, onCut, onPaste, hasSelection,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEsc, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEsc, { capture: true });
    };
  }, [onClose]);

  // Position menu within viewport
  const menuW = 220;
  const menuH = 260;
  let mx = state.x, my = state.y;
  if (mx + menuW > window.innerWidth - 8) mx = window.innerWidth - menuW - 8;
  if (my + menuH > window.innerHeight - 8) my = window.innerHeight - menuH - 8;

  const bg = isDark ? "#1C1C28" : "#FFFFFF";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const hoverBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const destructiveHover = "rgba(239,68,68,0.12)";
  const textColor = isDark ? "#E4E4EB" : "#1C1C28";
  const secondaryText = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  const MenuItem = ({ label, shortcut, onClick, destructive, icon: Icon }: {
    label: string;
    shortcut?: string;
    onClick: () => void;
    destructive?: boolean;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }) => (
    <button
      onClick={(ev) => { ev.stopPropagation(); onClick(); onClose(); }}
      className="w-full text-left px-3 py-1.5 text-[13px] rounded-lg transition-colors flex items-center justify-between gap-4"
      style={{ color: destructive ? "#E63535" : textColor }}
      onMouseEnter={(ev) => { ev.currentTarget.style.background = destructive ? destructiveHover : hoverBg; }}
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
        className="rounded-xl overflow-hidden py-1.5 min-w-[220px]"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.5)"
            : "0 8px 32px rgba(96,97,112,0.2)",
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

        <Divider />

        <MenuItem label="Delete Row" shortcut="Ctrl+Del" icon={Trash2} onClick={onDeleteRow} destructive />
      </div>
    </div>
  );
}
