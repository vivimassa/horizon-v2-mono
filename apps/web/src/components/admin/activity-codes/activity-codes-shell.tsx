"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  setApiBaseUrl,
  type ActivityCodeGroupRef,
  type ActivityCodeRef,
} from "@skyhub/api";
import { MasterDetailLayout } from "@/components/layout";
import { getOperatorId } from "@/stores/use-operator-store";
import { ActivityCodeList } from "./activity-code-list";
import { ActivityCodeDetail } from "./activity-code-detail";

setApiBaseUrl("http://localhost:3002");

export function ActivityCodesShell() {
  const [groups, setGroups] = useState<ActivityCodeGroupRef[]>([]);
  const [codes, setCodes] = useState<ActivityCodeRef[]>([]);
  const [selected, setSelected] = useState<ActivityCodeRef | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createGroupId, setCreateGroupId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([api.getActivityCodeGroups(), api.getActivityCodes()])
      .then(([g, c]) => {
        setGroups(g);
        setCodes(c);
        setSelected((prev) => {
          if (prev) {
            const f = c.find((d) => d._id === prev._id);
            if (f) return f;
          }
          return c.length > 0 ? c[0] : null;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Group CRUD ──
  const handleCreateGroup = useCallback(
    async (data: Partial<ActivityCodeGroupRef>) => {
      await api.createActivityCodeGroup({ operatorId: getOperatorId(), ...data });
      fetchData();
    },
    [fetchData]
  );

  const handleUpdateGroup = useCallback(
    async (id: string, data: Partial<ActivityCodeGroupRef>) => {
      await api.updateActivityCodeGroup(id, data);
      fetchData();
    },
    [fetchData]
  );

  const handleDeleteGroup = useCallback(
    async (id: string) => {
      try {
        await api.deleteActivityCodeGroup(id);
        fetchData();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(msg);
      }
    },
    [fetchData]
  );

  // ── Code CRUD ──
  const handleCreateCode = useCallback(
    async (data: Partial<ActivityCodeRef>) => {
      const created = await api.createActivityCode({
        operatorId: getOperatorId(),
        ...data,
      });
      setCreating(false);
      setCreateGroupId(null);
      fetchData();
      setTimeout(() => setSelected(created), 300);
    },
    [fetchData]
  );

  const handleUpdateCode = useCallback(
    async (id: string, data: Partial<ActivityCodeRef>) => {
      await api.updateActivityCode(id, data);
      fetchData();
    },
    [fetchData]
  );

  const handleUpdateFlags = useCallback(
    async (id: string, flags: string[]) => {
      await api.updateActivityCodeFlags(id, flags);
      fetchData();
    },
    [fetchData]
  );

  const handleUpdatePositions = useCallback(
    async (id: string, positions: string[]) => {
      await api.updateActivityCodePositions(id, positions);
      fetchData();
    },
    [fetchData]
  );

  const handleDeleteCode = useCallback(
    async (id: string) => {
      try {
        await api.deleteActivityCode(id);
        setSelected(null);
        fetchData();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(msg);
      }
    },
    [fetchData]
  );

  const handleSeedDefaults = useCallback(async () => {
    await api.seedActivityCodeDefaults();
    fetchData();
  }, [fetchData]);

  return (
    <MasterDetailLayout
      left={
        <ActivityCodeList
          groups={groups}
          codes={codes}
          selected={selected}
          onSelect={(c) => {
            setSelected(c);
            setCreating(false);
          }}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={(groupId?: string) => {
            setCreating(true);
            setCreateGroupId(groupId ?? null);
            setSelected(null);
          }}
          onCreateGroup={handleCreateGroup}
          onUpdateGroup={handleUpdateGroup}
          onDeleteGroup={handleDeleteGroup}
          onSeedDefaults={handleSeedDefaults}
        />
      }
      center={
        creating ? (
          <ActivityCodeDetail
            code={null}
            groups={groups}
            defaultGroupId={createGroupId}
            onCreate={handleCreateCode}
            onCancelCreate={() => {
              setCreating(false);
              if (codes.length > 0) setSelected(codes[0]);
            }}
          />
        ) : selected ? (
          <ActivityCodeDetail
            code={selected}
            groups={groups}
            onSave={handleUpdateCode}
            onDelete={handleDeleteCode}
            onUpdateFlags={handleUpdateFlags}
            onUpdatePositions={handleUpdatePositions}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-hz-text-secondary text-[14px]">
            {groups.length === 0
              ? 'Click "Load Defaults" to seed activity codes'
              : "Select an activity code"}
          </div>
        )
      }
    />
  );
}
