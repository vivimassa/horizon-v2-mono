"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileSpreadsheet, AlertCircle, Check } from "lucide-react";
import { api } from "@skyhub/api";

interface ImportDialogProps {
  seasonCode: string;
  scenarioId?: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportDialog({ seasonCode, scenarioId, onClose, onImported }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors?: { row: number; message: string }[] } | null>(null);
  const [error, setError] = useState("");

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = `http://localhost:3002/ssim/import?operatorId=horizon&seasonCode=${seasonCode}${scenarioId ? `&scenarioId=${scenarioId}` : ""}`;
      const res = await fetch(url, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      onImported();
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [file, seasonCode, scenarioId, onImported]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Import Schedule</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors"><X size={16} className="text-hz-text-secondary" /></button>
        </div>

        {!result ? (
          <>
            <div
              className="border-2 border-dashed border-hz-border rounded-xl p-8 text-center cursor-pointer hover:border-module-accent/30 transition-colors"
              onClick={() => document.getElementById("ssim-file-input")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            >
              <input id="ssim-file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet size={20} className="text-module-accent" />
                  <span className="text-[14px] font-medium">{file.name}</span>
                  <span className="text-[12px] text-hz-text-tertiary">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto text-hz-text-tertiary mb-2" />
                  <p className="text-[14px] text-hz-text-secondary">Drop .xlsx file here or click to browse</p>
                  <p className="text-[12px] text-hz-text-tertiary mt-1">Columns: AC Type, From, To, DEP, ARR, Flight, STD, STA, SVC, Freq</p>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(255,59,59,0.08)" }}>
                <AlertCircle size={14} style={{ color: "#E63535" }} />
                <span className="text-[13px]" style={{ color: "#E63535" }}>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={!file || importing}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50 transition-colors">
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(6,194,112,0.12)" }}>
                <Check size={20} style={{ color: "#06C270" }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold">{result.imported} flights imported</p>
                {result.errors && result.errors.length > 0 && (
                  <p className="text-[13px] text-hz-text-secondary">{result.errors.length} rows skipped</p>
                )}
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-hz-border p-2 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-[12px] text-hz-text-secondary">Row {e.row}: {e.message}</p>
                ))}
              </div>
            )}
            <button onClick={onClose} className="w-full py-2 rounded-lg text-[13px] font-medium text-white bg-module-accent hover:opacity-90 transition-colors">Done</button>
          </>
        )}
      </div>
    </div>
  );
}
