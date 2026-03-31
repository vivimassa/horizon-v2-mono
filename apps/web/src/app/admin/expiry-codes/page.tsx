"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type ExpiryCodeRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3001");

const columns: Column<ExpiryCodeRef>[] = [
  {
    key: "code",
    label: "Code",
    render: (r) => <span className="font-bold">{r.code}</span>,
    sortValue: (r) => r.code,
  },
  {
    key: "name",
    label: "Name",
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: "crewCategory",
    label: "Category",
    render: (r) => (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 capitalize">
        {r.crewCategory}
      </span>
    ),
    sortValue: (r) => r.crewCategory,
  },
  {
    key: "formula",
    label: "Validity Period",
    render: (r) => <span className="text-hz-text-secondary text-xs">{r.formula}</span>,
    sortValue: (r) => r.formula,
  },
];

const filterFn = (r: ExpiryCodeRef, q: string) =>
  r.code.toLowerCase().includes(q) ||
  r.name.toLowerCase().includes(q) ||
  r.crewCategory.toLowerCase().includes(q);

export default function ExpiryCodesPage() {
  const [data, setData] = useState<ExpiryCodeRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExpiryCodes().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: ExpiryCodeRef) => r._id, []);

  return (
    <DataTable
      title="Expiry Codes"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search code, name, category…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
