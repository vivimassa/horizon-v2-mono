"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type ScenarioRef } from "@skyhub/api";
import { GitBranch, Plus, Copy, Upload, Trash2, X } from "lucide-react";

interface ScenarioPanelProps {
  seasonCode: string;
  activeScenarioId: string | null;
  onSelectScenario: (id: string | null) => void;
  onClose: () => void;
}

export function ScenarioPanel({ seasonCode, activeScenarioId, onSelectScenario, onClose }: ScenarioPanelProps) {
  const [scenarios, setScenarios] = useState<ScenarioRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getScenarios({ operatorId: "horizon", seasonCode });
      setScenarios(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [seasonCode]);

  useEffect(() => { fetchScenarios(); }, [fetchScenarios]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    await api.createScenario({ operatorId: "horizon", seasonCode, name: createName.trim(), createdBy: "admin" });
    setCreateName("");
    setShowCreate(false);
    fetchScenarios();
  }, [createName, seasonCode, fetchScenarios]);

  const handleClone = useCallback(async (id: string, name: string) => {
    await api.cloneScenario(id, `${name} (copy)`, "admin");
    fetchScenarios();
  }, [fetchScenarios]);

  const handlePublish = useCallback(async (id: string) => {
    setPublishing(id);
    try {
      await api.publishScenario(id, "admin");
      fetchScenarios();
    } finally { setPublishing(null); }
  }, [fetchScenarios]);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteScenario(id);
    if (activeScenarioId === id) onSelectScenario(null);
    fetchScenarios();
  }, [activeScenarioId, onSelectScenario, fetchScenarios]);

  const statusColor: Record<string, string> = { draft: "#E67A00", review: "#0063F7", published: "#06C270", archived: "#8F90A6" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-module-accent" />
            <h2 className="text-[16px] font-bold">Scenarios — {seasonCode}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors"><X size={16} className="text-hz-text-secondary" /></button>
        </div>

        {/* Production row */}
        <button
          onClick={() => { onSelectScenario(null); onClose(); }}
          className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${activeScenarioId === null ? "border-module-accent bg-module-accent/[0.06]" : "border-hz-border hover:border-hz-border/80"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold">Production</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(6,194,112,0.12)", color: "#06C270" }}>Live</span>
          </div>
          <p className="text-[12px] text-hz-text-secondary mt-0.5">Active published schedule</p>
        </button>

        {/* Scenario list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-[13px] text-hz-text-secondary animate-pulse py-4 text-center">Loading...</p>
          ) : scenarios.length === 0 ? (
            <p className="text-[13px] text-hz-text-tertiary py-4 text-center">No scenarios yet</p>
          ) : scenarios.map((s) => (
            <div
              key={s._id}
              className={`px-4 py-3 rounded-xl border transition-colors ${activeScenarioId === s._id ? "border-module-accent bg-module-accent/[0.06]" : "border-hz-border"}`}
            >
              <div className="flex items-center justify-between">
                <button onClick={() => { onSelectScenario(s._id); onClose(); }} className="text-left flex-1">
                  <span className="text-[14px] font-medium">{s.name}</span>
                </button>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${statusColor[s.status]}15`, color: statusColor[s.status] }}>{s.status}</span>
              </div>
              {s.description && <p className="text-[12px] text-hz-text-secondary mt-0.5">{s.description}</p>}
              <div className="flex items-center gap-1 mt-2">
                <button onClick={() => handleClone(s._id, s.name)} className="p-1 rounded hover:bg-hz-border/30 transition-colors" title="Clone"><Copy size={12} className="text-hz-text-tertiary" /></button>
                {s.status === "draft" && (
                  <button onClick={() => handlePublish(s._id)} disabled={publishing === s._id} className="px-2 py-0.5 rounded text-[11px] font-medium text-white bg-module-accent hover:opacity-90 disabled:opacity-50 transition-colors">
                    {publishing === s._id ? "..." : "Publish"}
                  </button>
                )}
                <button onClick={() => handleDelete(s._id)} className="p-1 rounded hover:bg-hz-border/30 transition-colors ml-auto" title="Delete"><Trash2 size={12} className="text-hz-text-tertiary" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Create */}
        {showCreate ? (
          <div className="flex items-center gap-2 shrink-0">
            <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Scenario name"
              className="flex-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }} />
            <button onClick={handleCreate} className="px-3 py-2 rounded-lg text-[13px] font-medium text-white bg-module-accent hover:opacity-90 transition-colors">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-2 py-2 rounded-lg text-[13px] text-hz-text-secondary hover:bg-hz-border/30 transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-[13px] font-medium border border-dashed border-hz-border text-hz-text-secondary hover:text-hz-text hover:border-hz-text-secondary transition-colors shrink-0">
            <Plus size={14} /> New Scenario
          </button>
        )}
      </div>
    </div>
  );
}
