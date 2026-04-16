'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, User, UserPlus, X as XIcon } from 'lucide-react'
import { api, type NonCrewPersonRef } from '@skyhub/api'
import { MODULE_THEMES } from '@skyhub/constants'
import { useTheme } from '@/components/theme-provider'
import { colors, accentTint } from '@skyhub/ui/theme'
import { setJumpseaters } from '@/lib/gantt/flight-detail-api'
import { ActionModalShell } from './action-modal-shell'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

// AIMS §5.3 Jump Seaters Assignment — Crew List + Non-Crew List tabs.

type TabKey = 'crew' | 'nonCrew'

type SelectedRow = {
  kind: 'crew' | 'nonCrew'
  personId: string
  name: string
  company: string | null
  department: string | null
}

interface JumpseaterDialogProps {
  open: boolean
  flight: FlightDetail
  onClose: () => void
  onApplied: () => void
}

function personDisplayName(p: NonCrewPersonRef): string {
  const mid = p.fullName.middle ? ` ${p.fullName.middle}` : ''
  return `${p.fullName.last}, ${p.fullName.first}${mid}`.trim()
}

export function JumpseaterDialog({ open, flight, onClose, onApplied }: JumpseaterDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  // Hex form for accentTint(); dialogs hosted under /flight-ops pick up the operations accent.
  const accent = MODULE_THEMES.operations.accent

  const [tab, setTab] = useState<TabKey>('crew')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SelectedRow[]>(
    flight.jumpSeaters.map((j) => ({
      kind: j.kind,
      personId: j.personId,
      name: j.name,
      company: j.company,
      department: j.department,
    })),
  )
  const [nonCrew, setNonCrew] = useState<NonCrewPersonRef[]>([])
  const [nonCrewLoading, setNonCrewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Non-crew list — load once on open, filter client-side
  useEffect(() => {
    if (!open || tab !== 'nonCrew') return
    if (nonCrew.length > 0) return
    setNonCrewLoading(true)
    api
      .listNonCrewPeople({ availableOnly: true })
      .then(setNonCrew)
      .catch((e) => setError((e as Error).message))
      .finally(() => setNonCrewLoading(false))
  }, [open, tab, nonCrew.length])

  const selectedIds = useMemo(() => new Set(selected.map((s) => `${s.kind}:${s.personId}`)), [selected])

  const crewRows = useMemo(() => {
    const needle = search.toLowerCase()
    return flight.crew.filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.role.toLowerCase().includes(needle) ||
        c.employeeId.includes(needle),
    )
  }, [flight.crew, search])

  const nonCrewRows = useMemo(() => {
    const needle = search.toLowerCase()
    return nonCrew.filter((p) => {
      if (!needle) return true
      const name = personDisplayName(p).toLowerCase()
      return (
        name.includes(needle) ||
        (p.company ?? '').toLowerCase().includes(needle) ||
        (p.department ?? '').toLowerCase().includes(needle) ||
        p.passport.number.toLowerCase().includes(needle)
      )
    })
  }, [nonCrew, search])

  const toggleSelect = (row: SelectedRow) => {
    const key = `${row.kind}:${row.personId}`
    setSelected((prev) => {
      if (prev.some((s) => `${s.kind}:${s.personId}` === key)) {
        return prev.filter((s) => `${s.kind}:${s.personId}` !== key)
      }
      return [...prev, row]
    })
  }

  const removeSelected = (kind: 'crew' | 'nonCrew', personId: string) => {
    setSelected((prev) => prev.filter((s) => !(s.kind === kind && s.personId === personId)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await setJumpseaters(
        flight.id,
        selected.map((s) => ({
          kind: s.kind,
          personId: s.personId,
          name: s.name,
          company: s.company,
          department: s.department,
        })),
      )
      onApplied()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ActionModalShell
      open={open}
      title="Jump Seaters"
      subtitle={`${flight.flightNumber} · ${flight.depStation} → ${flight.arrStation} · ${flight.operatingDate}`}
      onClose={onClose}
      onConfirm={handleSave}
      confirmLabel={`Save (${selected.length})`}
      saving={saving}
      width={720}
      hint="AIMS §5.3 — pick from Crew List (operating crew + ops staff) or Non-Crew List (5.2.5 directory)."
    >
      {/* Tabs */}
      <div className="mb-4">
        <div
          className="flex rounded-full p-1"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}
        >
          {(['crew', 'nonCrew'] as TabKey[]).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 text-[13px] font-semibold rounded-full py-2 transition-all"
                style={{
                  color: active ? accent : palette.textSecondary,
                  background: active ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.70)') : 'transparent',
                  fontWeight: active ? 700 : 600,
                }}
              >
                {t === 'crew' ? 'Crew List' : 'Non-Crew List'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div className="mb-3 relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: palette.textTertiary }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === 'crew' ? 'Search by name, role, or employee ID…' : 'Search by name, company, department, passport…'
          }
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${border}`,
            color: palette.text,
          }}
        />
      </div>

      {/* List */}
      <div
        className="rounded-xl overflow-y-auto"
        style={{
          maxHeight: 300,
          border: `1px solid ${border}`,
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}
      >
        {tab === 'crew' ? (
          crewRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: palette.textTertiary }}>
              {flight.crew.length === 0 ? 'No crew assigned to this flight yet.' : 'No matches for current search.'}
            </div>
          ) : (
            crewRows.map((c) => {
              const row: SelectedRow = {
                kind: 'crew',
                personId: c.employeeId,
                name: c.name,
                company: null,
                department: c.role,
              }
              const checked = selectedIds.has(`crew:${c.employeeId}`)
              return (
                <button
                  key={c.employeeId}
                  type="button"
                  onClick={() => toggleSelect(row)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors"
                  style={{
                    background: checked ? accentTint(accent, isDark ? 0.12 : 0.08) : 'transparent',
                    borderBottom: `1px solid ${border}`,
                  }}
                >
                  <input type="checkbox" checked={checked} readOnly className="h-4 w-4 shrink-0" />
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: accentTint(accent, isDark ? 0.2 : 0.12) }}
                  >
                    <User size={14} style={{ color: accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: palette.text }}>
                      {c.name}
                    </div>
                    <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                      {c.role} · ID {c.employeeId}
                    </div>
                  </div>
                </button>
              )
            })
          )
        ) : nonCrewLoading ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: palette.textTertiary }}>
            Loading non-crew directory…
          </div>
        ) : nonCrewRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: palette.textTertiary }}>
            {nonCrew.length === 0
              ? 'No non-crew people registered yet. Add them in Settings > Master Database > Non-Crew Directory (5.2.5).'
              : 'No matches for current search.'}
          </div>
        ) : (
          nonCrewRows.map((p) => {
            const row: SelectedRow = {
              kind: 'nonCrew',
              personId: p._id,
              name: personDisplayName(p),
              company: p.company,
              department: p.department,
            }
            const checked = selectedIds.has(`nonCrew:${p._id}`)
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => toggleSelect(row)}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors"
                style={{
                  background: checked ? accentTint(accent, isDark ? 0.12 : 0.08) : 'transparent',
                  borderBottom: `1px solid ${border}`,
                }}
              >
                <input type="checkbox" checked={checked} readOnly className="h-4 w-4 shrink-0" />
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}${p.avatarUrl}`}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: accentTint('#7c3aed', isDark ? 0.2 : 0.12) }}
                  >
                    <UserPlus size={14} style={{ color: '#7c3aed' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: palette.text }}>
                    {personDisplayName(p)}
                  </div>
                  <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                    {[p.company, p.department].filter(Boolean).join(' · ') || 'No company set'}
                  </div>
                </div>
                {p.jumpseatPriority === 'high' && (
                  <span
                    className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,136,0,0.15)', color: '#FF8800' }}
                  >
                    High
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mt-4">
          <div
            className="text-[12px] uppercase tracking-wider font-semibold mb-2"
            style={{ color: palette.textSecondary }}
          >
            Assigned ({selected.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <div
                key={`${s.kind}:${s.personId}`}
                className="flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full text-[12px] font-medium"
                style={{
                  background: accentTint(s.kind === 'crew' ? accent : '#7c3aed', isDark ? 0.18 : 0.1),
                  color: s.kind === 'crew' ? accent : '#7c3aed',
                }}
              >
                {s.name}
                <button
                  onClick={() => removeSelected(s.kind, s.personId)}
                  className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-black/10"
                >
                  <XIcon size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[12px] mt-3" style={{ color: '#E63535' }}>
          {error}
        </p>
      )}
    </ActionModalShell>
  )
}
