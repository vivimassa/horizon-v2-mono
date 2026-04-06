"use client";

import { useState, useCallback } from "react";
import { Download, X, FileSpreadsheet } from "lucide-react";
import { api } from "@skyhub/api";

interface ExportDialogProps {
  seasonCode: string;
  scenarioId?: string;
  flightCount: number;
  onClose: () => void;
}

export function ExportDialog({ seasonCode, scenarioId, flightCount, onClose }: ExportDialogProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await api.exportSsim({ operatorId: "horizon", seasonCode, scenarioId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${seasonCode}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [seasonCode, scenarioId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Export Schedule</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors"><X size={16} className="text-hz-text-secondary" /></button>
        </div>

        <div className="flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-module-accent/10">
            <FileSpreadsheet size={20} className="text-module-accent" />
          </div>
          <div>
            <p className="text-[14px] font-medium">Season {seasonCode}</p>
            <p className="text-[13px] text-hz-text-secondary">{flightCount} flights will be exported</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">Cancel</button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50 transition-colors">
            <Download size={14} />
            {exporting ? "Exporting..." : "Download .xlsx"}
          </button>
        </div>
      </div>
    </div>
  );
}
