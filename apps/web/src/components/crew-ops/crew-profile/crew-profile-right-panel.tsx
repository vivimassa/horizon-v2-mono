'use client'

import { useMemo } from 'react'
import { CalendarClock, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import type { CrewMemberRef, FullCrewProfileRef } from '@skyhub/api'
import { useCrewPositions } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { getOperatorId } from '@/stores/use-operator-store'
import { crewAccent } from './common/draft-helpers'
import { CrewAvatarUpload } from './common/avatar-upload'

interface Props {
  crewId: string | null
  member: CrewMemberRef
  serverProfile: FullCrewProfileRef | null
  onAvatarChange: (newUrl: string | null) => void
}

export function CrewProfileRightPanel({ crewId, member, serverProfile, onAvatarChange }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const positionsQ = useCrewPositions(getOperatorId())
  const positionLabel = useMemo(() => {
    const p = positionsQ.data?.find((x) => x._id === member.position)
    return p ? `${p.code} · ${p.name}` : '—'
  }, [positionsQ.data, member.position])

  const health = useMemo(() => {
    const counts = { valid: 0, warning: 0, expired: 0, unknown: 0 }
    const upcoming: Array<{ codeLabel: string; name: string; days: number; date: string }> = []
    const today = new Date()
    if (!serverProfile) return { counts, upcoming }
    for (const e of serverProfile.expiryDates) {
      counts[e.status] = (counts[e.status] ?? 0) + 1
      if ((e.status === 'warning' || e.status === 'valid') && e.expiryDate) {
        const d = new Date(e.expiryDate)
        const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
        if (days <= 90) upcoming.push({ codeLabel: e.codeLabel, name: e.codeName, days, date: e.expiryDate })
      }
    }
    upcoming.sort((a, b) => a.days - b.days)
    return { counts, upcoming: upcoming.slice(0, 5) }
  }, [serverProfile])

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      {/* Hero */}
      <div
        className="rounded-xl p-5 mb-4 flex flex-col items-center"
        style={{
          background: isDark ? 'rgba(25,25,33,0.85)' : '#FFFFFF',
          backdropFilter: isDark ? 'blur(24px)' : undefined,
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 2px 8px rgba(96,97,112,0.08)',
        }}
      >
        <CrewAvatarUpload
          crewId={crewId}
          photoUrl={member.photoUrl}
          firstName={member.firstName}
          lastName={member.lastName}
          status={member.status}
          onChange={onAvatarChange}
        />
        <div className="text-center mt-3">
          <p className="text-[15px] font-semibold leading-tight" style={{ color: palette.text }}>
            {[member.firstName, member.lastName].filter(Boolean).join(' ') || '— —'}
          </p>
          <p className="text-[13px] mt-0.5" style={{ color: palette.textTertiary }}>
            {member.shortCode ?? member.employeeId}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="space-y-2 mb-4">
        <InfoRow label="Position" value={positionLabel} palette={palette} />
        <InfoRow label="Base" value={serverProfile?.baseLabel ?? '—'} palette={palette} />
        <InfoRow label="Seniority" value={member.seniority !== null ? `#${member.seniority}` : '—'} palette={palette} />
        <InfoRow label="Employment" value={member.employmentDate ?? '—'} palette={palette} />
      </div>

      {/* Expiry health */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[3px] h-4 rounded-full" style={{ background: crewAccent(isDark) }} />
          <h4 className="text-[13px] font-bold" style={{ color: palette.text }}>
            Expiry health
          </h4>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Pill label="Valid" value={health.counts.valid} color="#06C270" isDark={isDark} palette={palette} />
          <Pill label="Warn" value={health.counts.warning} color="#FF8800" isDark={isDark} palette={palette} />
          <Pill label="Expired" value={health.counts.expired} color="#E63535" isDark={isDark} palette={palette} />
          <Pill label="Unset" value={health.counts.unknown} color="#555770" isDark={isDark} palette={palette} />
        </div>
      </div>

      {/* Upcoming */}
      <div
        className="rounded-xl p-4"
        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={14} style={{ color: crewAccent(isDark) }} />
          <h4 className="text-[13px] font-bold" style={{ color: palette.text }}>
            Upcoming (≤90d)
          </h4>
        </div>
        {health.upcoming.length === 0 ? (
          <p className="text-[13px]" style={{ color: palette.textTertiary }}>
            No expiries in the next 90 days.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {health.upcoming.map((u, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: palette.text }}>
                    {u.codeLabel} · {u.name}
                  </p>
                  <p className="text-[13px] truncate" style={{ color: palette.textTertiary }}>
                    {u.date}
                  </p>
                </div>
                <span
                  className="text-[13px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: u.days <= 30 ? '#E6353522' : '#FF880022',
                    color: u.days <= 30 ? '#E63535' : '#FF8800',
                  }}
                >
                  {u.days}d
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!crewId && (
        <p className="text-[13px] text-center mt-4 opacity-60" style={{ color: palette.textTertiary }}>
          Save the new crew member to enable avatar upload and expiry tracking.
        </p>
      )}
    </div>
  )
}

function InfoRow({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span style={{ color: palette.textTertiary }}>{label}</span>
      <span className="font-medium" style={{ color: palette.text }}>
        {value}
      </span>
    </div>
  )
}

function Pill({
  label,
  value,
  color,
  palette,
  isDark,
}: {
  label: string
  value: number
  color: string
  palette: Palette
  isDark: boolean
}) {
  return (
    <div
      className="rounded-lg py-2 px-1.5 text-center"
      style={{
        background: `${color}1a`,
        border: `1px solid ${color}33`,
      }}
    >
      <p className="text-[15px] font-bold leading-none" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] mt-1 uppercase tracking-wide font-semibold" style={{ color: palette.textSecondary }}>
        {label}
      </p>
    </div>
  )
}

// Re-use for future status indicators
void AlertTriangle
void CheckCircle2
void Circle
