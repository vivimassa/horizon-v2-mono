"use client";

import { Search, Replace, Upload, Download, Save, SaveAll, GitBranch, MessageSquare, FileText } from "lucide-react";
import { RibbonButton } from "./ribbon-button";
import { RibbonSection } from "./flight-section";
import { useTheme } from "@/components/theme-provider";

function Divider() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="self-stretch shrink-0 flex items-center py-4">
      <div style={{ width: 1, height: '60%', background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }} />
    </div>
  );
}

interface Props {
  onSave: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onScenario?: () => void;
  onMessage?: () => void;
  onSsimExport?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onSaveAs?: () => void;
  hasDirty: boolean;
  saving: boolean;
}

export function UtilitySections({ onSave, onImport, onExport, onScenario, onMessage, onSsimExport, onFind, onReplace, onSaveAs, hasDirty, saving }: Props) {
  return (
    <>
      <RibbonSection label="Editing">
        <RibbonButton icon={Search} label="Find" shortcut="Ctrl+F" onClick={onFind} small />
        <RibbonButton icon={Replace} label="Replace" shortcut="Ctrl+H" onClick={onReplace} small />
      </RibbonSection>

      <Divider />

      <RibbonSection label="Import">
        <RibbonButton icon={Upload} label="Upload" onClick={onImport} />
        <RibbonButton icon={Download} label="Download" onClick={onExport} />
      </RibbonSection>

      <Divider />

      <RibbonSection label="Record">
        <RibbonButton icon={Save} label="Save" onClick={onSave} disabled={!hasDirty || saving} shortcut="Ctrl+S" />
        <RibbonButton icon={SaveAll} label="Save As" shortcut="F12" onClick={onSaveAs} />
      </RibbonSection>

      <Divider />

      <RibbonSection label="Scenario">
        <RibbonButton icon={GitBranch} label="Scenario" onClick={onScenario} />
      </RibbonSection>

      <Divider />

      <RibbonSection label="Message">
        <RibbonButton icon={MessageSquare} label="ASM/SSM" onClick={onMessage} />
        <RibbonButton icon={FileText} label="SSIM" onClick={onSsimExport} />
      </RibbonSection>
    </>
  );
}
