"use client";

import { useState, useCallback } from "react";
import type { DutyPatternRef } from "@skyhub/api";
import { useTheme } from "@/components/theme-provider";
import { Pencil, Save, X, Trash2, Plus, Minus } from "lucide-react";

const ON_COLOR = "#06C270";
const OFF_COLOR = "#FF5C5C";
const OFF_CODES = ["DO", "RDO", "AO", "LV", "REST"];

interface DutyPatternDetailProps {
  pattern: DutyPatternRef;
  onSave?: (id: string, data: Partial<DutyPatternRef>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: (data: Partial<DutyPatternRef>) => Promise<void>;
}

function computeStats(sequence: number[]) {
  const cycleDays = sequence.reduce((a, b) => a + b, 0);
  const onDays = sequence.reduce((s, n, i) => i % 2 === 0 ? s + n : s, 0);
  const offDays = cycleDays - onDays;
  const ratio = cycleDays > 0 ? Math.round((onDays / cycleDays) * 100) : 0;
  return { cycleDays, onDays, offDays, ratio };
}

function buildBlocks(sequence: number[]): boolean[] {
  const blocks: boolean[] = [];
  sequence.forEach((count, i) => {
    for (let d = 0; d < count; d++) blocks.push(i % 2 === 0);
  });
  return blocks;
}

function seqLabel(sequence: number[]): string {
  return sequence.map((n, i) => `${n} ${i % 2 === 0 ? "ON" : "OFF"}`).join(" \u2192 ");
}

export function DutyPatternDetail({ pattern, onSave, onDelete, onCreate }: DutyPatternDetailProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Partial<DutyPatternRef>>({});
  const [errorMsg, setErrorMsg] = useState("");

  // Create flow
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    code: "", description: "", offCode: "DO", sequence: [5, 2] as number[],
  });

  const resetCreate = useCallback(() => {
    setShowCreate(false); setCreateError("");
    setCreateForm({ code: "", description: "", offCode: "DO", sequence: [5, 2] });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!onCreate) return;
    if (!createForm.code) { setCreateError("Code is required"); return; }
    if (createForm.sequence.length < 2 || createForm.sequence.length % 2 !== 0) {
      setCreateError("Sequence must have at least one ON/OFF pair"); return;
    }
    if (createForm.sequence.some(v => v < 1)) { setCreateError("Each segment must be at least 1 day"); return; }
    setCreating(true); setCreateError("");
    try {
      await onCreate({
        operatorId: "horizon",
        code: createForm.code.toUpperCase(),
        description: createForm.description || null,
        sequence: createForm.sequence,
        offCode: createForm.offCode,
        isActive: true,
      });
      resetCreate();
    } catch (err: any) {
      const msg = err.message || "Create failed";
      try {
        const match = msg.match(/API (\d+): (.+)/);
        if (match && Number(match[1]) === 409) setCreateError("This pattern code already exists");
        else setCreateError(msg);
      } catch { setCreateError(msg); }
    } finally { setCreating(false); }
  }, [onCreate, createForm, resetCreate]);

  const handleEdit = useCallback(() => { setDraft({}); setEditing(true); setConfirmDelete(false); }, []);
  const handleCancel = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(pattern._id, draft); setEditing(false); setDraft({}); }
    catch { setErrorMsg("Save failed"); }
    finally { setSaving(false); }
  }, [onSave, pattern._id, draft]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setSaving(true); setErrorMsg("");
    try { await onDelete(pattern._id); }
    catch (err: any) { setErrorMsg(err.message || "Delete failed"); }
    finally { setSaving(false); setConfirmDelete(false); }
  }, [onDelete, pattern._id]);

  const getVal = <K extends keyof DutyPatternRef>(key: K): DutyPatternRef[K] =>
    key in draft ? (draft as any)[key] : pattern[key];

  const currentSeq = getVal("sequence");
  const stats = computeStats(currentSeq);
  const blocks = buildBlocks(currentSeq);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold font-mono">{pattern.code}</h1>
            {pattern.isActive ? (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[rgba(6,194,112,0.12)] text-[#06C270] dark:bg-[rgba(57,217,138,0.15)] dark:text-[#39D98A]">
                Active
              </span>
            ) : (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={handleCancel} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent transition-colors">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-red-500 font-medium">Delete?</span>
                      <button onClick={handleDelete} disabled={saving}
                        className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Yes</button>
                      <button onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)}
                      className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete pattern">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
                {onSave && (
                  <button onClick={handleEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {onCreate && (
                  <button onClick={() => { resetCreate(); setShowCreate(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent transition-colors">
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {pattern.description && (
          <p className="text-[13px] text-hz-text-secondary mt-1">{pattern.description}</p>
        )}
        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400 flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {/* Create Panel */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Add New Pattern</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">Cancel</button>
          </div>
          <div className="flex gap-3">
            <div className="w-32">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Code *</label>
              <input type="text" value={createForm.code} maxLength={20}
                onChange={(e) => setCreateForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Description</label>
              <input type="text" value={createForm.description}
                onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div className="w-24">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Off Code</label>
              <select value={createForm.offCode}
                onChange={(e) => setCreateForm(p => ({ ...p, offCode: e.target.value }))}
                className="w-full mt-1 px-2 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none text-hz-text">
                {OFF_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Sequence</label>
            <SequenceEditor sequence={createForm.sequence}
              onChange={(seq) => setCreateForm(p => ({ ...p, sequence: seq }))} />
          </div>
          <button onClick={handleCreate} disabled={creating}
            className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent transition-colors disabled:opacity-50">
            {creating ? "Creating..." : "Add Pattern"}
          </button>
          {createError && <p className="text-[12px] text-red-500">{createError}</p>}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Stats Strip */}
        <div className="flex items-center gap-6">
          <StatBox label="Cycle" value={`${stats.cycleDays}d`} />
          <StatBox label="On Days" value={String(stats.onDays)} color={ON_COLOR} />
          <StatBox label="Off Days" value={String(stats.offDays)} color={OFF_COLOR} />
          <StatBox label="Off Code" value={getVal("offCode")} />
          <StatBox label="Ratio" value={`${stats.ratio}%`} />
        </div>

        {/* Sequence Section */}
        <div>
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-2 block">Sequence</label>
          {editing ? (
            <SequenceEditor sequence={currentSeq}
              onChange={(seq) => handleFieldChange("sequence", seq)} />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {currentSeq.map((n, i) => (
                <span key={i} className="text-[13px] font-bold font-mono px-2.5 py-1 rounded-lg"
                  style={{
                    backgroundColor: i % 2 === 0 ? "rgba(6,194,112,0.12)" : "rgba(255,92,92,0.12)",
                    color: i % 2 === 0 ? ON_COLOR : OFF_COLOR,
                  }}>
                  {n} {i % 2 === 0 ? "ON" : "OFF"}
                </span>
              ))}
            </div>
          )}
          <p className="text-[13px] text-hz-text-tertiary mt-2">{seqLabel(currentSeq)} (repeats every {stats.cycleDays} days)</p>
        </div>

        {/* Fields (edit mode) */}
        {editing && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Description</label>
              <input type="text" value={getVal("description") ?? ""}
                onChange={(e) => handleFieldChange("description", e.target.value || null)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text" />
            </div>
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Off Code</label>
              <select value={getVal("offCode")}
                onChange={(e) => handleFieldChange("offCode", e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none text-hz-text">
                {OFF_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Active</label>
              <button onClick={() => handleFieldChange("isActive", !getVal("isActive"))}
                className="mt-1 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                style={{ backgroundColor: getVal("isActive") ? ON_COLOR : "#8F90A6" }}>
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: getVal("isActive") ? "translateX(22px)" : "translateX(4px)" }} />
              </button>
            </div>
          </div>
        )}

        {/* Preview Bar — Single Cycle */}
        <div>
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-2 block">Single Cycle Preview</label>
          <div className="flex rounded-lg overflow-hidden h-8">
            {currentSeq.map((count, i) => {
              const isOn = i % 2 === 0;
              const total = stats.cycleDays;
              return (
                <div key={i} className="flex items-center justify-center text-[11px] font-bold text-white"
                  style={{
                    width: `${(count / total) * 100}%`,
                    backgroundColor: isOn ? ON_COLOR : OFF_COLOR,
                    opacity: isOn ? 0.8 : 0.45,
                  }}>
                  {count}
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview Bar — Two Cycles */}
        <div>
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-2 block">Two Cycles Preview</label>
          <div className="flex rounded-lg overflow-hidden h-6">
            {[...currentSeq, ...currentSeq].map((count, i) => {
              const isOn = i % 2 === 0;
              const total = stats.cycleDays * 2;
              return (
                <div key={i} className="flex items-center justify-center text-[11px] font-semibold text-white"
                  style={{
                    width: `${(count / total) * 100}%`,
                    backgroundColor: isOn ? ON_COLOR : OFF_COLOR,
                    opacity: isOn ? 0.8 : 0.45,
                  }}>
                  {count}
                </div>
              );
            })}
          </div>
        </div>

        {/* 30-Day Calendar */}
        <div>
          <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-2 block">30-Day Calendar</label>
          <div className="grid grid-cols-15 gap-1" style={{ gridTemplateColumns: "repeat(15, 1fr)" }}>
            {Array.from({ length: 30 }, (_, d) => {
              const isOn = blocks[d % blocks.length];
              return (
                <div key={d} className="flex items-center justify-center h-8 rounded text-[11px] font-semibold"
                  style={{
                    backgroundColor: isOn
                      ? isDark ? "rgba(6,194,112,0.20)" : "rgba(6,194,112,0.15)"
                      : isDark ? "rgba(255,92,92,0.20)" : "rgba(255,92,92,0.12)",
                    color: isOn ? ON_COLOR : OFF_COLOR,
                  }}>
                  {d + 1}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Box ── */
function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-hz-text-tertiary uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className="text-[20px] font-bold font-mono tabular-nums" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

/* ── Sequence Editor ── */
function SequenceEditor({ sequence, onChange }: { sequence: number[]; onChange: (seq: number[]) => void }) {
  const updateSeg = (idx: number, val: number) => {
    const next = [...sequence];
    next[idx] = Math.max(1, val);
    onChange(next);
  };
  const addPair = () => onChange([...sequence, 1, 1]);
  const removePair = () => {
    if (sequence.length > 2) onChange(sequence.slice(0, -2));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {sequence.map((n, i) => (
        <div key={i} className="flex items-center gap-1">
          <input type="number" min={1} value={n}
            onChange={(e) => updateSeg(i, parseInt(e.target.value) || 1)}
            className="w-14 h-8 text-center text-[13px] font-mono font-bold rounded-lg border-2 outline-none bg-hz-bg text-hz-text"
            style={{ borderColor: i % 2 === 0 ? ON_COLOR : OFF_COLOR }} />
          <span className="text-[11px] font-semibold" style={{ color: i % 2 === 0 ? ON_COLOR : OFF_COLOR }}>
            {i % 2 === 0 ? "ON" : "OFF"}
          </span>
          {i < sequence.length - 1 && <span className="text-hz-text-tertiary mx-0.5">&rarr;</span>}
        </div>
      ))}
      <button onClick={addPair} className="h-8 px-2 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 border border-hz-border transition-colors"
        title="Add ON/OFF pair">
        <Plus className="h-3 w-3" />
      </button>
      {sequence.length > 2 && (
        <button onClick={removePair} className="h-8 px-2 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 border border-hz-border transition-colors"
          title="Remove last pair">
          <Minus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
