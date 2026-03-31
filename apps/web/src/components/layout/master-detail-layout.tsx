"use client";

import { type ReactNode } from "react";

interface MasterDetailLayoutProps {
  /** Left panel content (list, search, filters) — always 300px */
  left: ReactNode;
  /** Center panel content — flex-1, always present */
  center: ReactNode;
  /** Optional right panel content (info, inspector) — 300px when present */
  right?: ReactNode;
}

/**
 * Shared master-detail layout shell used across all admin and data screens.
 *
 * Variants:
 *   - 2-panel: left (300px) + center (flex-1)
 *   - 3-panel: left (300px) + center (flex-1) + right (300px)
 */
export function MasterDetailLayout({
  left,
  center,
  right,
}: MasterDetailLayoutProps) {
  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      {/* Left panel — 300px */}
      <aside className="w-[300px] shrink-0 flex flex-col rounded-2xl border border-hz-border bg-hz-card overflow-hidden">
        {left}
      </aside>

      {/* Center panel — flex-1 */}
      <section className="flex-1 flex flex-col rounded-2xl border border-hz-border bg-white dark:bg-hz-card overflow-hidden">
        {center}
      </section>

      {/* Right panel — 300px, optional */}
      {right && (
        <aside className="w-[300px] shrink-0 flex flex-col rounded-2xl border border-hz-border bg-hz-card overflow-hidden">
          {right}
        </aside>
      )}
    </div>
  );
}
