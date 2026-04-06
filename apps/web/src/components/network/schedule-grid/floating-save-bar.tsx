"use client";

import { Save, X } from "lucide-react";

interface FloatingSaveBarProps {
  dirtyCount: number;
  newCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function FloatingSaveBar({ dirtyCount, newCount, saving, onSave, onDiscard }: FloatingSaveBarProps) {
  const total = dirtyCount + newCount;
  if (total === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl border border-hz-border shadow-xl backdrop-blur-lg"
      style={{ backgroundColor: "rgba(25,25,33,0.92)" }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#FF8800] animate-pulse" />
        <span className="text-[13px] font-medium text-white">
          {dirtyCount > 0 && `${dirtyCount} modified`}
          {dirtyCount > 0 && newCount > 0 && ", "}
          {newCount > 0 && `${newCount} new`}
        </span>
      </div>

      <div className="w-px h-5 bg-white/20" />

      <button
        onClick={onDiscard}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Discard
      </button>

      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: "#06C270" }}
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
