'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, XCircle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { SsimParseResponse } from '@/lib/ssim-import-client'

interface ParsedPreviewProps {
  result: SsimParseResponse
}

/**
 * Right-pane preview rendered after /ssim/parse succeeds. Shows validation
 * checklist + stat cards + service-type breakdown + aircraft types + route
 * summary + expandable parse errors. Purely presentational — the Import
 * action sits in the setup panel footer.
 */
export function ParsedPreview({ result }: ParsedPreviewProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { carrier, flights, stats, errors, trailer, validation } = result

  const cardBg = isDark ? 'rgba(25,25,33,0.75)' : 'rgba(255,255,255,0.75)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Carrier banner */}
      {carrier && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            backdropFilter: 'blur(18px) saturate(150%)',
            WebkitBackdropFilter: 'blur(18px) saturate(150%)',
          }}
        >
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-hz-text-tertiary">Carrier</div>
            <div className="text-[18px] font-bold text-hz-text leading-tight">
              {carrier.airlineName || carrier.airlineCode}
            </div>
            <div className="text-[12px] text-hz-text-secondary">
              {carrier.airlineCode} · Season {carrier.seasonStart} → {carrier.seasonEnd}
            </div>
          </div>
          <StatPill label="Legs" value={stats.totalRecords} />
          <StatPill label="Unique flights" value={stats.uniqueFlightNumbers} />
          <StatPill label="Routes" value={stats.uniqueRoutes} />
        </div>
      )}

      {/* Validation checklist */}
      <Card title="Validation" isDark={isDark}>
        <ValidationRow ok={validation.airlineMatch} label="Airline code present" detail={carrier?.airlineCode ?? '—'} />
        <ValidationRow
          ok={validation.recordCountOk}
          label="Record count matches trailer"
          detail={trailer ? `Trailer ${trailer.recordCount} · parsed ${stats.totalRecords}` : 'No trailer present'}
        />
        <ValidationRow
          ok={validation.missingAirports.length === 0}
          label="All airports known"
          detail={
            validation.missingAirports.length === 0
              ? `${stats.stations.length} stations recognised`
              : `Missing: ${previewList(validation.missingAirports, 6)}`
          }
        />
        <ValidationRow
          ok={validation.missingCityPairs.length === 0}
          label="All city pairs known"
          detail={
            validation.missingCityPairs.length === 0
              ? `${stats.uniqueRoutes} routes`
              : `${validation.missingCityPairs.length} missing — will auto-create if enabled`
          }
        />
        <ValidationRow
          ok={validation.missingAircraftTypes.length === 0}
          label="All aircraft types configured"
          detail={
            validation.missingAircraftTypes.length === 0
              ? `${stats.aircraftTypes.length} types`
              : `Missing: ${previewList(validation.missingAircraftTypes, 6)}`
          }
        />
      </Card>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total legs" value={stats.totalRecords} isDark={isDark} />
        <StatCard label="Unique flights" value={stats.uniqueFlightNumbers} isDark={isDark} />
        <StatCard label="Aircraft types" value={stats.aircraftTypes.length} isDark={isDark} />
        <StatCard label="Stations" value={stats.stations.length} isDark={isDark} />
      </div>

      {/* Route split */}
      <Card title="Route split" isDark={isDark}>
        <div className="flex items-baseline gap-6">
          <SplitBar label="Domestic" value={stats.domesticRoutes} total={stats.uniqueRoutes} color="#06C270" />
          <SplitBar
            label="International"
            value={stats.internationalRoutes}
            total={stats.uniqueRoutes}
            color="#0063F7"
          />
        </div>
      </Card>

      {/* Aircraft breakdown */}
      {Object.keys(stats.aircraftTypeCounts).length > 0 && (
        <Card title="Aircraft types" isDark={isDark}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.aircraftTypeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <span className="font-mono text-hz-text">{code}</span>
                  <span className="text-hz-text-secondary">{count}</span>
                </span>
              ))}
          </div>
        </Card>
      )}

      {/* Service types */}
      {Object.keys(stats.serviceTypes).length > 0 && (
        <Card title="Service types" isDark={isDark}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.serviceTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <span className="font-mono text-hz-text">{code}</span>
                  <span className="text-hz-text-secondary">{count}</span>
                </span>
              ))}
          </div>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && <ErrorsCard errors={errors} isDark={isDark} />}

      {/* Tail spacer so the last card isn't flush with the filter Go button */}
      <div className="h-4" />

      {flights.length === 0 && (
        <div
          className="flex items-center gap-2 p-4 rounded-xl"
          style={{ background: 'rgba(255,136,0,0.10)', border: '1px solid rgba(255,136,0,0.25)' }}
        >
          <AlertTriangle size={16} style={{ color: '#FF8800' }} />
          <span className="text-[13px] text-hz-text">
            The file parsed but contains no Type-3 flight records — nothing to import.
          </span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Sub-components
 * ───────────────────────────────────────────────────────────── */

function Card({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: isDark ? 'rgba(25,25,33,0.75)' : 'rgba(255,255,255,0.75)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        backdropFilter: 'blur(18px) saturate(150%)',
        WebkitBackdropFilter: 'blur(18px) saturate(150%)',
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2.5">{title}</div>
      {children}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-end">
      <div className="text-[18px] font-bold text-hz-text leading-tight tabular-nums">{value}</div>
      <div className="text-[11px] text-hz-text-tertiary uppercase tracking-wide">{label}</div>
    </div>
  )
}

function StatCard({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: isDark ? 'rgba(25,25,33,0.75)' : 'rgba(255,255,255,0.75)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-1">{label}</div>
      <div className="text-[22px] font-bold text-hz-text tabular-nums leading-none">{value}</div>
    </div>
  )
}

function ValidationRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : Info
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color: ok ? '#06C270' : '#FF8800' }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-hz-text">{label}</div>
        <div className="text-[12px] text-hz-text-secondary truncate">{detail}</div>
      </div>
    </div>
  )
}

function SplitBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12px] font-medium text-hz-text-secondary">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-hz-text">
          {value} <span className="text-hz-text-tertiary">({pct}%)</span>
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(127,127,140,0.18)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ErrorsCard({ errors, isDark }: { errors: Array<{ line: number; message: string }>; isDark: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: isDark ? 'rgba(255,59,59,0.06)' : 'rgba(255,59,59,0.04)',
        border: `1px solid rgba(255,59,59,${isDark ? '0.20' : '0.12'})`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 focus:outline-none"
      >
        <XCircle size={16} style={{ color: '#FF3B3B' }} />
        <span className="flex-1 text-left text-[13px] font-semibold text-hz-text">
          {errors.length} parse issue{errors.length === 1 ? '' : 's'}
        </span>
        {open ? (
          <ChevronDown size={14} className="text-hz-text-tertiary" />
        ) : (
          <ChevronRight size={14} className="text-hz-text-tertiary" />
        )}
      </button>
      {open && (
        <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
          {errors.map((e, i) => (
            <div key={i} className="text-[12px] font-mono text-hz-text-secondary">
              <span className="text-hz-text-tertiary">Line {e.line}:</span> {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function previewList(items: string[], n: number): string {
  if (items.length <= n) return items.join(', ')
  return items.slice(0, n).join(', ') + ` (+${items.length - n} more)`
}
