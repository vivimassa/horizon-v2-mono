"use client";

import type { ScheduledFlightRef } from "@skyhub/api";
import { GRID_COLUMNS, fmtMinutes, calcBlockMinutes } from "./grid-columns";
import { X, Printer } from "lucide-react";

interface PrintLayoutProps {
  rows: ScheduledFlightRef[];
  seasonCode: string;
  onClose: () => void;
}

export function PrintLayout({ rows, seasonCode, onClose }: PrintLayoutProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-hz-bg overflow-auto">
      {/* Print controls — hidden in print */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 border-b border-hz-border bg-hz-card">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-bold">Print Preview</h2>
          <span className="text-[13px] text-hz-text-secondary">{rows.length} flights — Season {seasonCode}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-colors">
            <Printer size={14} /> Print
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-hz-border/30 transition-colors">
            <X size={16} className="text-hz-text-secondary" />
          </button>
        </div>
      </div>

      {/* Print content */}
      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-4 print:mb-2">
          <h1 className="text-[18px] font-bold">Flight Schedule — {seasonCode}</h1>
          <p className="text-[12px] text-hz-text-secondary mt-0.5">
            Generated {new Date().toLocaleDateString()} · {rows.length} flights
          </p>
        </div>

        {/* Table */}
        <table className="w-full text-[11px] border-collapse" style={{ fontFamily: "Consolas, monospace" }}>
          <thead>
            <tr>
              <th className="px-1 py-1.5 text-left font-semibold border-b-2 border-hz-text text-[10px] uppercase tracking-wider">#</th>
              {GRID_COLUMNS.map((col) => (
                <th key={col.key} className="px-1 py-1.5 text-center font-semibold border-b-2 border-hz-text text-[10px] uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const block = row.blockMinutes ?? calcBlockMinutes(row.stdUtc, row.staUtc);
              return (
                <tr key={row._id} className={i % 2 === 1 ? "bg-gray-50 dark:bg-gray-900/20" : ""}>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-hz-text-tertiary">{i + 1}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.rotationLabel ?? row.aircraftTypeIcao ?? "—"}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.aircraftTypeIcao}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.effectiveFrom}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.effectiveUntil}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center font-semibold">{row.depStation}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center font-semibold">{row.arrStation}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center" style={{ color: "#E63535", fontWeight: 600 }}>{row.airlineCode}{row.flightNumber}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.stdUtc}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.staUtc}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.serviceType}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{row.daysOfWeek}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">{fmtMinutes(block)}</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center">—</td>
                  <td className="px-1 py-1 border-b border-hz-border/30 text-center capitalize">{row.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-hz-border text-[10px] text-hz-text-tertiary flex justify-between print:mt-2">
          <span>SkyHub — Network Scheduling XL</span>
          <span>Page 1</span>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:mb-2 { margin-bottom: 0.5rem !important; }
          .print\\:mt-2 { margin-top: 0.5rem !important; }
        }
      `}</style>
    </div>
  );
}
