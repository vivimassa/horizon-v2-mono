'use client'

import Link from 'next/link'
import { ExternalLink, Shield, Users } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

const POSITION_COLORS: Record<string, string> = {
  CP: '#3B82F6',
  FO: '#3B82F6',
  SO: '#3B82F6',
  FE: '#3B82F6',
  PU: '#14B8A6',
  CA: '#14B8A6',
  FA: '#14B8A6',
}

const COCKPIT_ROLES = new Set(['CP', 'FO', 'SO', 'FE'])

type CrewEntry = FlightDetail['crew'][number]

export function CrewTab({ data }: { data: FlightDetail }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'

  const cockpitReq = data.cockpitCrewRequired ?? 2
  const cabinReq = data.cabinCrewRequired ?? 0
  const cockpitCrew = data.crew.filter((c) => COCKPIT_ROLES.has(c.role))
  const cabinCrew = data.crew.filter((c) => !COCKPIT_ROLES.has(c.role))

  return (
    <div>
      {/* Summary chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <span
          className="rounded-full px-3 py-1 text-[13px] font-bold"
          style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.15)' }}
        >
          Cockpit: {cockpitCrew.length} / {cockpitReq}
        </span>
        <span
          className="rounded-full px-3 py-1 text-[13px] font-bold"
          style={{ background: 'rgba(20,184,166,0.10)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.15)' }}
        >
          Cabin: {cabinCrew.length} / {cabinReq}
        </span>
        {data.pairings.map((p) => (
          <Link
            key={p.id}
            href={`/crew-ops/control/pairing?pairingId=${encodeURIComponent(p.id)}`}
            className="rounded-full px-3 py-1 text-[13px] font-medium inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{
              background: 'rgba(99,102,241,0.10)',
              color: accent,
              border: '1px solid rgba(99,102,241,0.20)',
            }}
            title="Open pairing in Crew Ops"
          >
            Pairing {p.code}
            <ExternalLink size={12} />
          </Link>
        ))}
      </div>

      {/* Flight Crew */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: muted }}>
          Flight Crew
        </h3>
        {cockpitCrew.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {cockpitCrew.map((c, i) => (
              <CrewCard
                key={`${c.crewId ?? c.employeeId}-${i}`}
                crew={c}
                operatingDate={data.operatingDate}
                isDark={isDark}
                textPrimary={textPrimary}
                muted={muted}
                cardBorder={cardBorder}
              />
            ))}
          </div>
        ) : (
          <EmptyRow icon={<Shield size={16} style={{ color: muted }} />} muted={muted}>
            No crew assigned — open Crew Ops → Auto-Roster to publish a roster
          </EmptyRow>
        )}
      </div>

      {/* Cabin Crew */}
      <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: muted }}>
          Cabin Crew
        </h3>
        {cabinCrew.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {cabinCrew.map((c, i) => (
              <CrewCard
                key={`${c.crewId ?? c.employeeId}-${i}`}
                crew={c}
                operatingDate={data.operatingDate}
                isDark={isDark}
                textPrimary={textPrimary}
                muted={muted}
                cardBorder={cardBorder}
              />
            ))}
          </div>
        ) : (
          <EmptyRow icon={<Users size={16} style={{ color: muted }} />} muted={muted}>
            No cabin crew assigned
          </EmptyRow>
        )}
      </div>
    </div>
  )
}

function EmptyRow({ icon, muted, children }: { icon: React.ReactNode; muted: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center py-6 opacity-50">
      <span className="mr-2">{icon}</span>
      <span className="text-[13px]" style={{ color: muted }}>
        {children}
      </span>
    </div>
  )
}

function CrewCard({
  crew,
  operatingDate,
  isDark,
  textPrimary,
  muted,
  cardBorder,
}: {
  crew: CrewEntry
  operatingDate: string
  isDark: boolean
  textPrimary: string
  muted: string
  cardBorder: string
}) {
  const color = POSITION_COLORS[crew.role] ?? '#6B7280'
  const sourceLabel = crew.source === 'operational' ? 'CHECKED IN' : 'ROSTERED'
  const sourceColor = crew.source === 'operational' ? '#06C270' : 'var(--module-accent, #1e40af)'
  const sourceBg = crew.source === 'operational' ? 'rgba(6,194,112,0.10)' : 'rgba(99,102,241,0.10)'

  const inner = (
    <div
      className="flex items-center gap-3 rounded-xl p-3 transition-colors"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${cardBorder}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
        style={{ background: color }}
      >
        {crew.role}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium truncate" style={{ color: textPrimary }}>
          {crew.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="text-[13px] font-bold rounded px-1.5 py-px"
            style={{ color: sourceColor, background: sourceBg }}
          >
            {sourceLabel}
          </span>
          {crew.pairingCode && (
            <span className="text-[13px] truncate" style={{ color: muted }}>
              · {crew.pairingCode}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (!crew.crewId) return inner
  const href = `/crew-ops/control/crew-schedule?crewId=${encodeURIComponent(crew.crewId)}&from=${encodeURIComponent(operatingDate)}`
  return (
    <Link href={href} className="block hover:opacity-90 transition-opacity" title="Open crew schedule">
      {inner}
    </Link>
  )
}
