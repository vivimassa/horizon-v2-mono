"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type CrewPositionRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { accentTint } from "@skyhub/ui/theme";
import { Users, Plus, Sparkles } from "lucide-react";
import { CrewPositionList } from "./crew-position-list";
import { CrewPositionDetail } from "./crew-position-detail";

setApiBaseUrl("http://localhost:3002");

export const ACCENT = "#7c3aed"; // Crew Ops purple

export function CrewPositionsShell() {
  const [positions, setPositions] = useState<CrewPositionRef[]>([]);
  const [selected, setSelected] = useState<CrewPositionRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.getCrewPositions(getOperatorId(), true)
      .then((data) => {
        setPositions(data);
        setSelected((prev) => {
          if (prev) { const f = data.find((p) => p._id === prev._id); if (f) return f; }
          return data.length > 0 ? data[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = useCallback(async (data: Partial<CrewPositionRef>) => {
    await api.createCrewPosition({ ...data, operatorId: getOperatorId() });
    setShowCreate(false);
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(async (id: string, data: Partial<CrewPositionRef>) => {
    await api.updateCrewPosition(id, data);
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteCrewPosition(id);
    setSelected(null);
    fetchData();
  }, [fetchData]);

  const handleDeactivate = useCallback(async (id: string) => {
    await api.updateCrewPosition(id, { isActive: false });
    fetchData();
  }, [fetchData]);

  const handleSeed = useCallback(async () => {
    await api.seedCrewPositions(getOperatorId());
    fetchData();
  }, [fetchData]);

  const handleSelect = useCallback((pos: CrewPositionRef) => {
    setSelected(pos);
    setShowCreate(false);
  }, []);

  // Group by category
  const { groups, totalCount } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? positions.filter((p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
      : positions;
    const categoryLabels: Record<string, string> = { cockpit: "Flight Deck", cabin: "Cabin Crew" };
    const map = new Map<string, CrewPositionRef[]>();
    for (const p of filtered) {
      const key = categoryLabels[p.category] ?? p.category;
      const arr = map.get(key);
      if (arr) arr.push(p);
      else map.set(key, [p]);
    }
    // Flight Deck first, then Cabin Crew
    const order = ["Flight Deck", "Cabin Crew"];
    const groups = Array.from(map.entries()).sort(
      ([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
    );
    return { groups, totalCount: filtered.length };
  }, [positions, search]);

  return (
    <MasterDetailLayout
      left={
        <CrewPositionList
          groups={groups}
          totalCount={totalCount}
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
          <CrewPositionDetail
            position={null}
            onCreate={handleCreate}
            onCancel={() => { setShowCreate(false); if (positions.length > 0) setSelected(positions[0]); }}
          />
        ) : selected ? (
          <CrewPositionDetail
            position={selected}
            onSave={handleSave}
            onDelete={handleDelete}
            onDeactivate={handleDeactivate}
          />
        ) : !loading && positions.length === 0 ? (
          <EmptyState onSeed={handleSeed} onAdd={() => setShowCreate(true)} />
        ) : null
      }
    />
  );
}

// ── Empty State ──

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
        <h2 className="text-[17px] font-semibold text-hz-text mb-1">No Crew Positions Configured</h2>
        <p className="text-[13px] text-hz-text-secondary max-w-sm">
          Crew positions define the rank hierarchy for flight deck and cabin crew.
          Seed defaults for a quick start, or add positions manually.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSeed} disabled={seeding}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}>
          <Sparkles className="h-4 w-4" /> {seeding ? "Seeding..." : "Seed Default Positions"}
        </button>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border border-hz-border text-hz-text-secondary hover:bg-hz-border/30 transition-colors">
          <Plus className="h-4 w-4" /> Add Manually
        </button>
      </div>
    </div>
  );
import { getOperatorId } from "@/stores/use-operator-store"
}
