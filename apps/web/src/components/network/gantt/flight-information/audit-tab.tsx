'use client'

import { History } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

function fmtTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd} ${mon} ${d.getUTCFullYear()} ${hh}:${mm}z`
}

export function AuditTab({ data }: { data: FlightDetail }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'

  // Build minimal audit entries from available data
  const entries: { type: string; color: string; description: string; timestamp: string }[] = []

  if (data.createdAt) {
    entries.push({
      type: 'Created',
      color: '#22c55e',
      description: `Flight created via ${data.source}`,
      timestamp: fmtTimestamp(data.createdAt),
    })
  }

  if (data.updatedAt && data.updatedAt !== data.createdAt) {
    entries.push({
      type: 'Updated',
      color: '#3B82F6',
      description: 'Flight schedule updated',
      timestamp: fmtTimestamp(data.updatedAt),
    })
  }

  if (data.aircraftReg) {
    entries.push({
      type: 'Assigned',
      color: '#F59E0B',
      description: `Aircraft ${data.aircraftReg} assigned`,
      timestamp: fmtTimestamp(data.updatedAt),
    })
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] mb-5" style={{ color: `${accent}99` }}>
        Audit Trail
      </h3>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 opacity-50">
          <History size={28} style={{ color: muted }} className="mb-3" />
          <span className="text-[13px] font-medium" style={{ color: muted }}>
            No audit records
          </span>
        </div>
      ) : (
        <div className="relative pl-4">
          {/* Vertical line — centered on dots */}
          <div className="absolute left-[8px] top-2 bottom-2 w-[2px]" style={{ background: cardBorder }} />

          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                {/* Dot */}
                <div
                  className="absolute left-[-12px] top-[6px] w-[10px] h-[10px] rounded-full z-10"
                  style={{ background: entry.color, boxShadow: `0 0 6px ${entry.color}40` }}
                />
                {/* Card */}
                <div
                  className="flex-1 flex items-start gap-3 rounded-xl px-4 py-2.5 ml-2"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  <span
                    className="text-[11px] font-bold px-2 py-1 rounded-md text-center shrink-0"
                    style={{ background: `${entry.color}15`, color: entry.color, minWidth: 72 }}
                  >
                    {entry.type}
                  </span>
                  <span className="text-[13px] flex-1" style={{ color: textPrimary }}>
                    {entry.description}
                  </span>
                  <span className="text-[11px] font-mono shrink-0" style={{ color: `${muted}80` }}>
                    {entry.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
