'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { api, type FullCrewProfileRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { DialogShell, DialogCancelButton } from './dialog-shell'

/**
 * Phase 4 — "Crew extra info" dialog, opened from the crew-name context
 * menu. Read-only metadata too noisy for the Bio tab:
 *
 *   • Employment — hire date, contract, status, seniority
 *   • Training   — next due dates (recurrent, line check, sim, medical)
 *   • Administrative — passport last-4 + visas + home-base assignment
 *
 * PII guard: passport numbers are always redacted to last 4 chars —
 * there is no `crew.view-sensitive` permission hook yet, so we stay
 * conservative across the board.
 */
export function CrewExtraInfoDialog() {
  const dialog = useCrewScheduleStore((s) => s.crewExtraInfoDialog)
  const close = useCrewScheduleStore((s) => s.closeCrewExtraInfoDialog)
  const crewList = useCrewScheduleStore((s) => s.crew)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const fmtDate = useDateFormat()

  const [profile, setProfile] = useState<FullCrewProfileRef | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dialog) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setProfile(null)
    api
      .getCrewById(dialog.crewId)
      .then((res) => {
        if (!cancelled) setProfile(res)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dialog])

  if (!dialog) return null

  const listItem = crewList.find((c) => c._id === dialog.crewId)
  const member = profile?.member
  const displayName = member
    ? `${member.firstName} ${member.lastName}`
    : listItem
      ? `${listItem.firstName} ${listItem.lastName}`
      : 'Crew member'

  return (
    <DialogShell
      title={`Crew extra info · ${displayName}`}
      onClose={close}
      width={600}
      footer={<DialogCancelButton onClick={close} label="Close" />}
    >
      {loading && (
        <div
          className="flex items-center justify-center py-10 gap-2 text-[13px]"
          style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading crew profile…
        </div>
      )}

      {!loading && error && (
        <div
          className="p-3 rounded-lg text-[13px]"
          style={{
            background: 'rgba(230,53,53,0.10)',
            border: '1px solid rgba(230,53,53,0.35)',
            color: '#E63535',
          }}
        >
          Could not load crew profile: {error}
        </div>
      )}

      {!loading && !error && profile && (
        <div className="flex flex-col gap-4">
          <Section title="Employment">
            <InfoGrid
              rows={[
                ['Employee ID', profile.member.employeeId],
                ['Status', cap(profile.member.status)],
                ['Hire date', fmtDate(profile.member.employmentDate)],
                ['Contract type', profile.member.contractType ?? '—'],
                ['Seniority', profile.member.seniority?.toString() ?? '—'],
                ['Seniority group', String(profile.member.seniorityGroup)],
                ['Home base', profile.baseLabel ?? '—'],
                ['Exit date', fmtDate(profile.member.exitDate)],
              ]}
              isDark={isDark}
            />
          </Section>

          <Section title="Training & checks">
            {profile.expiryDates.length === 0 ? (
              <EmptyRow isDark={isDark}>No expiry records on file.</EmptyRow>
            ) : (
              <InfoGrid
                rows={profile.expiryDates.slice(0, 8).map((e) => [
                  e.codeLabel,
                  (
                    <span key={e._id} className="tabular-nums" style={{ color: expiryColor(e.status) }}>
                      {fmtDate(e.expiryDate)}
                    </span>
                  ) as ReactNode,
                ])}
                isDark={isDark}
              />
            )}
          </Section>

          <Section title="Administrative">
            <InfoGrid
              rows={[
                ['Passport', passportCell(profile.passports)],
                [
                  'Visas',
                  profile.visas.length > 0
                    ? profile.visas.map((v) => `${v.country}${v.type ? ` (${v.type})` : ''}`).join(', ')
                    : '—',
                ],
                ['Languages', profile.member.languages.join(', ') || '—'],
                ['Nationality', profile.member.nationality ?? '—'],
                ['Country of residence', profile.member.countryOfResidence ?? '—'],
                ['APIS alias', profile.member.apisAlias ?? '—'],
              ]}
              isDark={isDark}
            />
            {profile.member.hrNotes && (
              <div
                className="mt-2 rounded-md p-2 text-[13px]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  color: isDark ? '#CBCCD6' : '#4A4C5A',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <div
                  className="text-[11px] uppercase tracking-wider mb-1"
                  style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
                >
                  HR notes
                </div>
                {profile.member.hrNotes}
              </div>
            )}
          </Section>

          <div className="text-[13px] italic" style={{ color: isDark ? '#6B6C7B' : '#9A9BA8' }}>
            See Bio tab for qualifications, aircraft ratings, and contact phones.
          </div>
        </div>
      )}
    </DialogShell>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-[3px] h-4 rounded-sm" style={{ backgroundColor: 'var(--module-accent)' }} />
        <h3 className="text-[13px] font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InfoGrid({ rows, isDark }: { rows: Array<[string, ReactNode]>; isDark: boolean }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="contents">
          <div className="text-[13px]" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
            {k}
          </div>
          <div className="text-[13px] font-medium text-right">{v}</div>
        </div>
      ))}
    </div>
  )
}

function EmptyRow({ children, isDark }: { children: ReactNode; isDark: boolean }) {
  return (
    <div className="text-[13px] italic py-2" style={{ color: isDark ? '#6B6C7B' : '#9A9BA8' }}>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────── */

function passportCell(passports: FullCrewProfileRef['passports']): ReactNode {
  // PII: conservatively redact to last 4 chars regardless of viewer —
  // there is no `crew.view-sensitive` permission hook today.
  const active = passports.find((p) => p.isActive) ?? passports[0]
  if (!active) return '—'
  const num = active.number
  const last4 = num.length > 4 ? `••••${num.slice(-4)}` : num
  return (
    <span className="tabular-nums">
      {active.country} · {last4}
    </span>
  )
}

function expiryColor(status: 'valid' | 'warning' | 'expired' | 'unknown'): string {
  if (status === 'expired') return '#E63535'
  if (status === 'warning') return '#FF8800'
  if (status === 'valid') return '#06C270'
  return 'inherit'
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}
