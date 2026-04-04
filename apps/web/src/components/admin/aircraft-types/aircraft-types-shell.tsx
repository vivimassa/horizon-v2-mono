"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type AircraftTypeRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { AircraftTypeList } from "./aircraft-type-list";
import { AircraftTypeDetail } from "./aircraft-type-detail";

setApiBaseUrl("http://localhost:3002");

const CATEGORY_ORDER: Record<string, number> = {
  narrow_body: 0,
  wide_body: 1,
  regional: 2,
  turboprop: 3,
};

const CATEGORY_LABELS: Record<string, string> = {
  narrow_body: "Narrow Body",
  wide_body: "Wide Body",
  regional: "Regional",
  turboprop: "Turboprop",
};

export function AircraftTypesShell() {
  const [types, setTypes] = useState<AircraftTypeRef[]>([]);
  const [selected, setSelected] = useState<AircraftTypeRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTypes = useCallback(() => {
    setLoading(true);
    api
      .getAircraftTypes()
      .then((data) => {
        setTypes(data);
        setSelected((prev) => {
          if (prev) {
            const found = data.find((t) => t._id === prev._id);
            if (found) return found;
          }
          return data.length > 0 ? data[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleSave = useCallback(async (id: string, data: Partial<AircraftTypeRef>) => {
    await api.updateAircraftType(id, data);
    fetchTypes();
  }, [fetchTypes]);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteAircraftType(id);
    setSelected(null);
    fetchTypes();
  }, [fetchTypes]);

  const handleCreate = useCallback(async (data: Partial<AircraftTypeRef>) => {
    const created = await api.createAircraftType(data);
    fetchTypes();
    setTimeout(() => setSelected(created), 300);
  }, [fetchTypes]);

  // Group by category
  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? types.filter(
          (t) =>
            t.icaoType.toLowerCase().includes(q) ||
            (t.iataType?.toLowerCase().includes(q) ?? false) ||
            t.name.toLowerCase().includes(q) ||
            (t.family?.toLowerCase().includes(q) ?? false) ||
            (t.manufacturer?.toLowerCase().includes(q) ?? false) ||
            t.category.toLowerCase().replace("_", " ").includes(q)
        )
      : types;

    const map = new Map<string, AircraftTypeRef[]>();
    for (const t of filtered) {
      const key = t.category || "narrow_body";
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }

    const groups = Array.from(map.entries()).sort(
      ([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
    );
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.icaoType.localeCompare(b.icaoType));
    }

    return { filtered, groups };
  }, [types, search]);

  return (
    <MasterDetailLayout
      left={
        <AircraftTypeList
          groups={groups}
          categoryLabels={CATEGORY_LABELS}
          totalCount={types.length}
          filteredCount={filtered.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={() => setSelected(null)}
        />
      }
      center={
        selected ? (
          <AircraftTypeDetail
            aircraftType={selected}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        ) : (
          <AircraftTypeDetail
            aircraftType={null}
            onCreate={handleCreate}
            onCancelCreate={() => { if (types.length > 0) setSelected(types[0]); }}
          />
        )
      }
    />
  );
}
