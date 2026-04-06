"use client";

import { ArrowUpDown, Search, Upload, Download, Save, SaveAll, GitBranch, MessageSquare } from "lucide-react";
import { RibbonButton } from "./ribbon-button";

interface Props {
  onSave: () => void;
  hasDirty: boolean;
  saving: boolean;
}

export function UtilitySections({ onSave, hasDirty, saving }: Props) {
  return (
    <>
      {/* Sort & Filter */}
      <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
        <div className="flex items-center gap-0.5">
          <RibbonButton icon={ArrowUpDown} label="Sort" small />
          <RibbonButton icon={Search} label="Find" shortcut="Ctrl+F" small />
        </div>
        <span className="text-[10px] text-hz-text-tertiary font-medium">Editing</span>
      </div>

      <div className="w-px bg-hz-border/50 self-stretch" />

      {/* Import & Export */}
      <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
        <div className="flex items-center gap-0.5">
          <RibbonButton icon={Upload} label="Upload" small />
          <RibbonButton icon={Download} label="Download" small />
        </div>
        <span className="text-[10px] text-hz-text-tertiary font-medium">Import</span>
      </div>

      <div className="w-px bg-hz-border/50 self-stretch" />

      {/* Record */}
      <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
        <div className="flex items-center gap-0.5">
          <RibbonButton
            icon={Save}
            label="Save"
            onClick={onSave}
            disabled={!hasDirty || saving}
            shortcut="Ctrl+S"
            small
          />
          <RibbonButton icon={SaveAll} label="Save As" shortcut="F12" small />
        </div>
        <span className="text-[10px] text-hz-text-tertiary font-medium">Record</span>
      </div>

      <div className="w-px bg-hz-border/50 self-stretch" />

      {/* Scenario */}
      <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
        <div className="flex items-center gap-0.5">
          <RibbonButton icon={GitBranch} label="Scenario" small />
        </div>
        <span className="text-[10px] text-hz-text-tertiary font-medium">Scenario</span>
      </div>

      <div className="w-px bg-hz-border/50 self-stretch" />

      {/* Message */}
      <div className="flex flex-col items-center px-2 py-1.5 gap-0.5">
        <div className="flex items-center gap-0.5">
          <RibbonButton icon={MessageSquare} label="ASM" small />
        </div>
        <span className="text-[10px] text-hz-text-tertiary font-medium">Message</span>
      </div>
    </>
  );
}
