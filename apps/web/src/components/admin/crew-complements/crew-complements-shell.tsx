"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  api,
  setApiBaseUrl,
  type AircraftTypeRef,
  type CrewComplementRef,
  type CrewPositionRef,
} from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { CrewComplementTypeList } from "./crew-complement-type-list";
import { CrewComplementTable } from "./crew-complement-table";
import { accentTint } from "@skyhub/ui/theme";
import { Users, Sparkles, Plus } from "lucide-react";

setApiBaseUrl("http://localhost:3002");

export const ACCENT = "#7c3aed"; // Crew Ops purple

export function CrewComplementsShell() {
  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeRef[]>([]);
  const [complements, setComplements] = useState<CrewComplementRef[]>([]);
  const [positions, setPositions] = useState<CrewPositionRef[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [types, comps, pos] = await Promise.all([
        api.getAircraftTypes(getOperatorId()),
        api.getCrewComplements(getOperatorId()),
        api.getCrewPositions(getOperatorId()),
      ]);
      setAircraftTypes(types.filter((t) => t.isActive));
      setComplements(comps);
      setPositions(pos);
      setSelectedType((prev) => {
        if (prev && types.some((t) => t.icaoType === prev)) return prev;
        return types.length > 0 ? types[0].icaoType : null;
      });
    } catch (err) {
      console.error("Failed to load crew complement data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group complements by aircraft type ICAO
  const byType = useMemo(() => {
    const map = new Map<string, CrewComplementRef[]>();
    for (const c of complements) {
      const arr = map.get(c.aircraftTypeIcao);
      if (arr) arr.push(c);
      else map.set(c.aircraftTypeIcao, [c]);
    }
    return map;
  }, [complements]);

  const selectedTypeInfo = useMemo(
    () => aircraftTypes.find((t) => t.icaoType === selectedType) ?? null,
    [aircraftTypes, selectedType]
  );

  const selectedComplements = useMemo(
    () => (selectedType ? byType.get(selectedType) ?? [] : []),
    [selectedType, byType]
  );

  const cockpitPositions = useMemo(
    () => positions.filter((p) => p.category === "cockpit"),
    [positions]
  );
  const cabinPositions = useMemo(
    () => positions.filter((p) => p.category === "cabin"),
    [positions]
  );

  // ── Handlers ──

  const handleCountChange = useCallback(
    async (complementId: string, counts: Record<string, number>) => {
      try {
        await api.updateCrewComplement(complementId, { counts });
        setComplements((prev) =>
          prev.map((c) => (c._id === complementId ? { ...c, counts } : c))
        );
      } catch (err) {
        console.error("Failed to update counts:", err);
      }
    },
    []
  );

  const handleNotesChange = useCallback(
    async (complementId: string, notes: string | null) => {
      try {
        await api.updateCrewComplement(complementId, { notes });
        setComplements((prev) =>
          prev.map((c) => (c._id === complementId ? { ...c, notes } : c))
        );
      } catch (err) {
        console.error("Failed to update notes:", err);
      }
    },
    []
  );

  const handleLabelChange = useCallback(
    async (complementId: string, templateKey: string) => {
      try {
        await api.updateCrewComplement(complementId, { templateKey });
        setComplements((prev) =>
          prev.map((c) =>
            c._id === complementId ? { ...c, templateKey } : c
          )
        );
      } catch (err) {
        console.error("Failed to update label:", err);
      }
    },
    []
  );

  const handleSeedForType = useCallback(
    async (icaoType: string) => {
      try {
        await api.seedCrewComplementDefaults(getOperatorId(), icaoType);
        fetchData();
      } catch (err) {
        console.error("Failed to seed:", err);
      }
    },
    [fetchData]
  );

  const handleSeedAll = useCallback(async () => {
    try {
      await api.seedCrewComplementDefaults(getOperatorId());
      fetchData();
    } catch (err) {
      console.error("Failed to seed all:", err);
    }
  }, [fetchData]);

  const handleAddRow = useCallback(
    async (icaoType: string, templateKey: string) => {
      try {
        await api.createCrewComplement({
          operatorId: getOperatorId(),
          aircraftTypeIcao: icaoType,
          templateKey,
          counts: {},
        });
        fetchData();
      } catch (err) {
        console.error("Failed to add row:", err);
      }
    },
    [fetchData]
  );

  const handleDeleteRow = useCallback(
    async (id: string) => {
      try {
        await api.deleteCrewComplement(id);
        setComplements((prev) => prev.filter((c) => c._id !== id));
      } catch (err: any) {
        const msg = err.message || "";
        const match = msg.match(/API \d+: (.+)/);
        const parsed = match ? JSON.parse(match[1]) : null;
        alert(parsed?.error || "Failed to delete row");
      }
    },
    []
  );

  // ── Render ──

  if (!loading && positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: accentTint(ACCENT, 0.1) }}
        >
          <Users size={24} color={ACCENT} strokeWidth={1.8} />
        </div>
        <div className="text-center">
          <h2 className="text-[17px] font-semibold text-hz-text mb-1">
            No Crew Positions Configured
          </h2>
          <p className="text-[13px] text-hz-text-secondary max-w-sm">
            Crew complements require crew positions to define the column
            structure. Go to{" "}
            <a
              href="/admin/crew-positions"
              className="font-semibold underline"
              style={{ color: ACCENT }}
            >
              5.4.2 Crew Positions
            </a>{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  if (!loading && aircraftTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: accentTint(ACCENT, 0.1) }}
        >
          <Users size={24} color={ACCENT} strokeWidth={1.8} />
        </div>
        <div className="text-center">
          <h2 className="text-[17px] font-semibold text-hz-text mb-1">
            No Aircraft Types Configured
          </h2>
          <p className="text-[13px] text-hz-text-secondary max-w-sm">
            Crew complements are defined per aircraft type. Go to{" "}
            <a
              href="/admin/aircraft-types"
              className="font-semibold underline"
              style={{ color: ACCENT }}
            >
              5.2.1 Aircraft Types
            </a>{" "}
            first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MasterDetailLayout
      left={
        <CrewComplementTypeList
          aircraftTypes={aircraftTypes}
          byType={byType}
          selectedType={selectedType}
          onSelect={setSelectedType}
          loading={loading}
        />
      }
      center={
        selectedType && selectedTypeInfo ? (
          <CrewComplementTable
            aircraftType={selectedTypeInfo}
            complements={selectedComplements}
            cockpitPositions={cockpitPositions}
            cabinPositions={cabinPositions}
            onCountChange={handleCountChange}
            onNotesChange={handleNotesChange}
            onLabelChange={handleLabelChange}
            onSeedForType={handleSeedForType}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />
        ) : !loading && complements.length === 0 ? (
          <EmptyState onSeedAll={handleSeedAll} />
        ) : null
      }
    />
  );
}

// ── Empty State ──

function EmptyState({ onSeedAll }: { onSeedAll: () => void }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedAll();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentTint(ACCENT, 0.1) }}
      >
        <Users size={24} color={ACCENT} strokeWidth={1.8} />
      </div>
      <div className="text-center">
        <h2 className="text-[17px] font-semibold text-hz-text mb-1">
          No Crew Complements Configured
        </h2>
        <p className="text-[13px] text-hz-text-secondary max-w-sm">
          Seed default complements (Standard, Aug 1, Aug 2) for all aircraft
          types, or click an aircraft type to configure individually.
        </p>
      </div>
      <button
        onClick={handleSeed}
        disabled={seeding}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: ACCENT }}
      >
        <Sparkles className="h-4 w-4" />
        {seeding ? "Seeding..." : "Seed All Defaults"}
      </button>
    </div>
  );
import { getOperatorId } from "@/stores/use-operator-store"
}
