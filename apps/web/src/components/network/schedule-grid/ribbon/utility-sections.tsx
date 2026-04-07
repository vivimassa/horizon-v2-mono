"use client";

import { Search, Replace, Upload, Download, Save, SaveAll, GitBranch, MessageSquare } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";

interface Props {
  onSave: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onScenario?: () => void;
  onMessage?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onSaveAs?: () => void;
  hasDirty: boolean;
  saving: boolean;
}

export function UtilitySections({ onSave, onImport, onExport, onScenario, onMessage, onFind, onReplace, onSaveAs, hasDirty, saving }: Props) {
  return (
    <>
      <RibbonSection label="Editing">
        <RibbonButton icon={Search} label="Find" shortcut="Ctrl+F" onClick={onFind} small />
        <RibbonButton icon={Replace} label="Replace" shortcut="Ctrl+H" onClick={onReplace} small />
      </RibbonSection>

      <div className="w-px self-stretch bg-hz-border/30 shrink-0" />

      <RibbonSection label="Import">
        <RibbonButton icon={Upload} label="Upload" onClick={onImport} />
        <RibbonButton icon={Download} label="Download" onClick={onExport} />
      </RibbonSection>

      <div className="w-px self-stretch bg-hz-border/30 shrink-0" />

      <RibbonSection label="Record">
        <RibbonButton icon={Save} label="Save" onClick={onSave} disabled={!hasDirty || saving} shortcut="Ctrl+S" />
        <RibbonButton icon={SaveAll} label="Save As" shortcut="F12" onClick={onSaveAs} />
      </RibbonSection>

      <div className="w-px self-stretch bg-hz-border/30 shrink-0" />

      <RibbonSection label="Scenario">
        <RibbonButton icon={GitBranch} label="Scenario" onClick={onScenario} />
      </RibbonSection>

      <div className="w-px self-stretch bg-hz-border/30 shrink-0" />

      <RibbonSection label="Message">
        <RibbonButton icon={MessageSquare} label="ASM" onClick={onMessage} />
      </RibbonSection>
    </>
  );
}
