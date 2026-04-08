"use client"

import { Shield, Users } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

const POSITION_COLORS: Record<string, string> = {
  CP: '#3B82F6', FO: '#3B82F6', SO: '#3B82F6', FE: '#3B82F6',
  PU: '#14B8A6', CA: '#14B8A6', FA: '#14B8A6',
}

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
  const cockpitCrew = data.crew.filter(c => ['CP', 'FO', 'SO', 'FE'].includes(c.role))
  const cabinCrew = data.crew.filter(c => !['CP', 'FO', 'SO', 'FE'].includes(c.role))

  return (
    <div>
      {/* Summary chips */}
      <div className="flex gap-2 mb-5">
        <span className="rounded-full px-3 py-1 text-[11px] font-bold"
          style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.15)' }}>
          Cockpit: {cockpitCrew.length > 0 ? cockpitCrew.length : cockpitReq} required
        </span>
        <span className="rounded-full px-3 py-1 text-[11px] font-bold"
          style={{ background: 'rgba(20,184,166,0.10)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.15)' }}>
          Cabin: {cabinCrew.length > 0 ? cabinCrew.length : cabinReq} required
        </span>
      </div>

      {/* Flight Crew */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: muted }}>
          Flight Crew
        </h3>
        {cockpitCrew.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {cockpitCrew.map((c, i) => (
              <CrewCard key={i} name={c.name} role={c.role} isDark={isDark} textPrimary={textPrimary} muted={muted} cardBorder={cardBorder} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 opacity-50">
            <Shield size={16} style={{ color: muted }} className="mr-2" />
            <span className="text-[12px]" style={{ color: muted }}>No crew assigned — managed in GCS or rostering modules</span>
          </div>
        )}
      </div>

      {/* Cabin Crew */}
      <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: muted }}>
          Cabin Crew
        </h3>
        {cabinCrew.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {cabinCrew.map((c, i) => (
              <CrewCard key={i} name={c.name} role={c.role} isDark={isDark} textPrimary={textPrimary} muted={muted} cardBorder={cardBorder} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 opacity-50">
            <Users size={16} style={{ color: muted }} className="mr-2" />
            <span className="text-[12px]" style={{ color: muted }}>No cabin crew assigned</span>
          </div>
        )}
      </div>
    </div>
  )
}

function CrewCard({ name, role, isDark, textPrimary, muted, cardBorder }: {
  name: string; role: string; isDark: boolean; textPrimary: string; muted: string; cardBorder: string
}) {
  const color = POSITION_COLORS[role] ?? '#6B7280'
  return (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${cardBorder}` }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
        style={{ background: color }}>
        {role}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: textPrimary }}>{name}</div>
      </div>
    </div>
  )
}
