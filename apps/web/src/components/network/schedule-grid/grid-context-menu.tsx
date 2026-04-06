"use client";

import { useRef, useEffect } from "react";
import { Copy, Scissors, ClipboardPaste, Plus, Minus, Trash2, RotateCcw, Bold, Italic } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  rowIdx: number;
  colKey: string;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDeleteRow: () => void;
  onClearFormatting: () => void;
}

export function GridContextMenu({
  x, y, onClose,
  onCopy, onCut, onPaste,
  onInsertAbove, onInsertBelow, onDeleteRow,
  onClearFormatting,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const items: { icon: typeof Copy; label: string; shortcut?: string; onClick: () => void; danger?: boolean; divider?: boolean }[] = [
    { icon: Copy, label: "Copy", shortcut: "Ctrl+C", onClick: onCopy },
    { icon: Scissors, label: "Cut", shortcut: "Ctrl+X", onClick: onCut },
    { icon: ClipboardPaste, label: "Paste", shortcut: "Ctrl+V", onClick: onPaste },
    { icon: Copy, label: "", shortcut: "", onClick: () => {}, divider: true },
    { icon: Plus, label: "Insert Row Above", shortcut: "Ctrl+Shift+=", onClick: onInsertAbove },
    { icon: Plus, label: "Insert Row Below", onClick: onInsertBelow },
    { icon: Copy, label: "", shortcut: "", onClick: () => {}, divider: true },
    { icon: RotateCcw, label: "Clear Formatting", onClick: onClearFormatting },
    { icon: Trash2, label: "Delete Row", shortcut: "Ctrl+-", onClick: onDeleteRow, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 w-52 rounded-xl border border-hz-border bg-hz-card shadow-xl py-1.5 overflow-hidden"
      style={{ left: x, top: y, animation: "bc-dropdown-in 100ms ease-out" }}
    >
      {items.map((item, i) => {
        if (item.divider) return <div key={i} className="h-px bg-hz-border/50 my-1 mx-2" />;
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors ${
              item.danger
                ? "text-[#E63535] hover:bg-[rgba(255,59,59,0.08)]"
                : "text-hz-text hover:bg-hz-border/20"
            }`}
          >
            <Icon size={14} className="shrink-0" strokeWidth={1.8} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && <span className="text-[11px] text-hz-text-tertiary">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
