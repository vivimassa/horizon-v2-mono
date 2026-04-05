"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, setApiBaseUrl, type AircraftRegistrationRef, type AircraftTypeRef } from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { AircraftRegistrationList } from "./aircraft-registration-list";
import { AircraftRegistrationDetail } from "./aircraft-registration-detail";

setApiBaseUrl("http://localhost:3002");

export function AircraftRegistrationsShell() {
  const [registrations, setRegistrations] = useState<AircraftRegistrationRef[]>([]);
  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeRef[]>([]);
  const [selected, setSelected] = useState<AircraftRegistrationRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getAircraftRegistrations(),
      api.getAircraftTypes(),
    ])
      .then(([regs, types]) => {
        setRegistrations(regs);
        setAircraftTypes(types);
        setSelected((prev: AircraftRegistrationRef | null) => {
          if (prev) {
            const found = regs.find((r) => r._id === prev._id);
            if (found) return found;
          }
          return regs.length > 0 ? regs[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async (id: string, data: Partial<AircraftRegistrationRef>) => {
    await api.updateAircraftRegistration(id, data);
    // Optimistically merge the update into local state to avoid a full refetch
    // which causes scroll reset and visual blink in the detail panel
    setRegistrations((prev) =>
      prev.map((r) => (r._id === id ? { ...r, ...data } : r))
    );
    setSelected((prev) =>
      prev && prev._id === id ? { ...prev, ...data } : prev
    );
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteAircraftRegistration(id);
    setSelected(null);
    fetchData();
  }, [fetchData]);

  const handleCreate = useCallback(async (data: Partial<AircraftRegistrationRef>) => {
    const created = await api.createAircraftRegistration(data);
    fetchData();
    setTimeout(() => setSelected(created), 300);
  }, [fetchData]);

  // Build type lookup
  const typeMap = useMemo(() => {
    const m = new Map<string, AircraftTypeRef>();
    for (const t of aircraftTypes) m.set(t._id, t);
    return m;
  }, [aircraftTypes]);

  // Group by aircraft type ICAO
  const { filtered, groups } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? registrations.filter((r) => {
          const t = typeMap.get(r.aircraftTypeId);
          return (
            r.registration.toLowerCase().includes(q) ||
            (r.serialNumber?.toLowerCase().includes(q) ?? false) ||
            (r.variant?.toLowerCase().includes(q) ?? false) ||
            r.status.toLowerCase().includes(q) ||
            (r.homeBaseIcao?.toLowerCase().includes(q) ?? false) ||
            (t?.icaoType.toLowerCase().includes(q) ?? false) ||
            (t?.name.toLowerCase().includes(q) ?? false)
          );
        })
      : registrations;

    const map = new Map<string, AircraftRegistrationRef[]>();
    for (const r of filtered) {
      const t = typeMap.get(r.aircraftTypeId);
      const key = t?.icaoType ?? "Unknown";
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }

    const groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [, arr] of groups) {
      arr.sort((a, b) => a.registration.localeCompare(b.registration));
    }

    return { filtered, groups };
  }, [registrations, search, typeMap]);

  return (
    <MasterDetailLayout
      left={
        <AircraftRegistrationList
          groups={groups}
          totalCount={registrations.length}
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
          <AircraftRegistrationDetail
            registration={selected}
            aircraftTypes={aircraftTypes}
            typeMap={typeMap}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        ) : (
          <AircraftRegistrationDetail
            registration={null}
            aircraftTypes={aircraftTypes}
            typeMap={typeMap}
            onCreate={handleCreate}
            onCancelCreate={() => { if (registrations.length > 0) setSelected(registrations[0]); }}
          />
        )
      }
    />
  );
}
