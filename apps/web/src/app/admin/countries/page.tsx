"use client";

import { useEffect, useState, useCallback } from "react";
import { api, setApiBaseUrl, type CountryRef } from "@skyhub/api";
import { DataTable, type Column } from "@/components/admin/data-table";

setApiBaseUrl("http://localhost:3002");

const columns: Column<CountryRef>[] = [
  {
    key: "flag",
    label: "",
    render: (r) => <span className="text-lg">{r.flagEmoji ?? ""}</span>,
  },
  {
    key: "name",
    label: "Country Name",
    render: (r) => <span className="font-medium">{r.name}</span>,
    sortValue: (r) => r.name,
  },
  {
    key: "iso2",
    label: "ISO 2",
    render: (r) => <span className="font-mono font-bold">{r.isoCode2}</span>,
    sortValue: (r) => r.isoCode2,
  },
  {
    key: "iso3",
    label: "ISO 3",
    render: (r) => <span className="font-mono text-hz-text-secondary">{r.isoCode3}</span>,
    sortValue: (r) => r.isoCode3,
  },
  {
    key: "region",
    label: "Region",
    render: (r) => <span className="text-hz-text-secondary">{r.region ?? "—"}</span>,
    sortValue: (r) => r.region ?? "",
  },
];

const filterFn = (r: CountryRef, q: string) =>
  r.name.toLowerCase().includes(q) ||
  r.isoCode2.toLowerCase().includes(q) ||
  r.isoCode3.toLowerCase().includes(q) ||
  (r.region?.toLowerCase().includes(q) ?? false);

export default function CountriesPage() {
  const [data, setData] = useState<CountryRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCountries().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const keyFn = useCallback((r: CountryRef) => r._id, []);

  return (
    <DataTable
      title="Countries"
      data={data}
      columns={columns}
      loading={loading}
      searchPlaceholder="Search name, ISO code, region…"
      filterFn={filterFn}
      keyFn={keyFn}
    />
  );
}
