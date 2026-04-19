'use client'

import { useMemo, useState } from 'react'
import { Search, User } from 'lucide-react'
import { getApiBaseUrl, type CrewDocumentStatusRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'

interface Props {
  crew: CrewDocumentStatusRef[]
  loading: boolean
  /** True once the user has clicked Go at least once. Until then we show
   *  an idle empty state rather than "no crew match". */
  hasRunQuery: boolean
  selectedCrewId: string | null
  onSelectCrew: (id: string | null) => void
}

const MAX_VISIBLE = 1000

export function CrewListPanel({ crew, loading, hasRunQuery, selectedCrewId, onSelectCrew }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)

  const [search, setSearch] = useState('')
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const rowHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
  const activeBg = `${accent}1a`

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return crew
    return crew.filter((c) => {
      const full = `${c.firstName} ${c.middleName ?? ''} ${c.lastName}`.toLowerCase()
      return full.includes(q) || c.employeeId.toLowerCase().includes(q)
    })
  }, [crew, search])

  const capped = filtered.slice(0, MAX_VISIBLE)
  const overflow = filtered.length - capped.length

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b" style={{ borderColor: border }}>
        <h2 className="text-[15px] font-bold" style={{ color: palette.text }}>
          Crew List
        </h2>
      </header>

      <div className="p-3 border-b" style={{ borderColor: border }}>
        <div className="relative">
          <Search
            size={14}
            style={{
              color: palette.textTertiary,
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Crew ID or name…"
            className="w-full h-10 pl-8 pr-3 rounded-lg text-[13px] outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${border}`,
              color: palette.text,
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-[13px]" style={{ color: palette.textTertiary }}>
            Loading…
          </div>
        ) : !hasRunQuery ? (
          <div className="p-6 text-center text-[13px]" style={{ color: palette.textTertiary }}>
            Set your selection criteria and click <strong>Go</strong> to load crew.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-[13px]" style={{ color: palette.textTertiary }}>
            No crew match the current criteria.
          </div>
        ) : (
          <ul className="py-1">
            {capped.map((c) => {
              const isSel = selectedCrewId === c._id
              const fullName = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
              const initials = ((c.firstName[0] ?? '') + (c.lastName[0] ?? '')).toUpperCase() || '??'
              const photoFull = c.photoUrl ? `${getApiBaseUrl()}${c.photoUrl}` : null
              return (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => onSelectCrew(c._id)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 transition-colors"
                    style={{
                      background: isSel ? activeBg : 'transparent',
                      borderLeft: isSel ? `3px solid ${accent}` : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) (e.currentTarget as HTMLElement).style.background = rowHover
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                      style={{ background: `${accent}22` }}
                    >
                      {photoFull ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoFull} alt="" className="w-full h-full object-cover" />
                      ) : fullName ? (
                        <span className="text-[13px] font-semibold" style={{ color: accent }}>
                          {initials}
                        </span>
                      ) : (
                        <User size={14} style={{ color: palette.textTertiary }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: palette.text }}>
                        {fullName || '—'}
                      </p>
                      <p className="text-[13px] truncate" style={{ color: palette.textTertiary }}>
                        {c.employeeId}
                        {c.position ? ` · ${c.position}` : ''}
                        {c.baseLabel ? ` · ${c.baseLabel}` : ''}
                      </p>
                    </div>
                    <CoverageDot coverage={c.coverage} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {overflow > 0 && (
          <p
            className="px-3 py-2 text-[13px] text-center"
            style={{ color: palette.textTertiary, borderTop: `1px solid ${border}` }}
          >
            Showing {MAX_VISIBLE} of {filtered.length} — refine the criteria to see more.
          </p>
        )}
      </div>

      <div className="px-3 py-2 text-[13px] border-t" style={{ borderColor: border, color: palette.textTertiary }}>
        {filtered.length} crew
      </div>
    </div>
  )
}

function CoverageDot({ coverage }: { coverage: number }) {
  const color = coverage >= 100 ? '#06C270' : coverage >= 50 ? '#FF8800' : '#E63535'
  return (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} title={`Coverage: ${coverage}%`} />
  )
}
