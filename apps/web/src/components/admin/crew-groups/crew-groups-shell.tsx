"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type CrewGroupRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { accentTint } from "@skyhub/ui/theme";
import { Users, Plus, Sparkles } from "lucide-react";
import { CrewGroupList } from "./crew-group-list";
import { CrewGroupDetail } from "./crew-group-detail";

setApiBaseUrl("http://localhost:3002");

export const ACCENT = "#7c3aed"; // Crew Ops purple

export function CrewGroupsShell() {
  const [groups, setGroups] = useState<CrewGroupRef[]>([]);
  const [selected, setSelected] = useState<CrewGroupRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.getCrewGroups("horizon", true)
      .then((data) => {
        setGroups(data);
        setSelected((prev) => {
          if (prev) { const f = data.find((g) => g._id === prev._id); if (f) return f; }
          return data.length > 0 ? data[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = useCallback(async (data: Partial<CrewGroupRef>) => {
    await api.createCrewGroup({ ...data, operatorId: "horizon" });
    setShowCreate(false);
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(async (id: string, data: Partial<CrewGroupRef>) => {
    await api.updateCrewGroup(id, data);
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteCrewGroup(id);
    setSelected(null);
    fetchData();
  }, [fetchData]);

  const handleSeed = useCallback(async () => {
    await api.seedCrewGroups("horizon");
    fetchData();
  }, [fetchData]);

  const handleSelect = useCallback((g: CrewGroupRef) => {
    setSelected(g);
    setShowCreate(false);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;
    return groups.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q)
    );
  }, [groups, search]);

  return (
    <MasterDetailLayout
      left={
        <CrewGroupList
          groups={filtered}
          totalCount={filtered.length}
          selected={selected}
          onSelect={handleSelect}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onAddClick={() => { setShowCreate(true); setSelected(null); }}
        />
      }
      center={
        showCreate ? (
          <CrewGroupDetail
            group={null}
            onCreate={handleCreate}
            onCancel={() => { setShowCreate(false); if (groups.length > 0) setSelected(groups[0]); }}
          />
        ) : selected ? (
          <CrewGroupDetail
            group={selected}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ) : !loading && groups.length === 0 ? (
          <EmptyState onSeed={handleSeed} onAdd={() => setShowCreate(true)} />
        ) : null
      }
    />
  );
}

function EmptyState({ onSeed, onAdd }: { onSeed: () => void; onAdd: () => void }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try { await onSeed(); } finally { setSeeding(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentTint(ACCENT, 0.1) }}>
        <Users size={24} color={ACCENT} strokeWidth={1.8} />
      </div>
      <div className="text-center">
        <h2 className="text-[17px] font-semibold text-hz-text mb-1">No Crew Groups Configured</h2>
        <p className="text-[13px] text-hz-text-secondary max-w-sm">
          Crew groups classify crew members for scheduling, reporting, and bulk operations.
          Seed defaults for a quick start, or add groups manually.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSeed} disabled={seeding}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}>
          <Sparkles className="h-4 w-4" /> {seeding ? "Seeding..." : "Seed Default Groups"}
        </button>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border border-hz-border text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
          <Plus className="h-4 w-4" /> Add Manually
        </button>
      </div>
    </div>
  );
}
