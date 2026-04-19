'use client'

import { useState, type Ref } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import type { CrewMemberRef, FullCrewProfileRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { crewAccent } from './common/draft-helpers'
import { QualificationsTab } from './tabs/qualifications-tab'
import { ContactTab } from './tabs/contact-tab'
import { SchedulingTab } from './tabs/scheduling-tab'
import { EmploymentTab } from './tabs/employment-tab'
import { IdentityTab } from './tabs/identity-tab'
import { OperationsTab } from './tabs/operations-tab'
import type { AircraftQualificationsGridHandle } from './grid/aircraft-qualifications-grid'

const TABS = [
  { key: 'qualifications', label: 'Qualifications & Expiries' },
  { key: 'contact', label: 'Contact & Emergency' },
  { key: 'scheduling', label: 'Scheduling & Rules' },
  { key: 'employment', label: 'Employment' },
  { key: 'identity', label: 'Identity & GENDEC' },
  { key: 'operations', label: 'Ops & Travel' },
] as const
type TabKey = (typeof TABS)[number]['key']

interface Props {
  crewId: string | null
  isDraft: boolean
  member: CrewMemberRef
  serverProfile: FullCrewProfileRef | null
  isDirty: boolean
  onFieldChange: (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => void
  onSave: () => void | Promise<void>
  onCancel: () => void
  onRefresh: () => Promise<unknown>
  /** Imperative handle so the shell can flush draft qualifications on save. */
  gridRef?: Ref<AircraftQualificationsGridHandle>
  /** Fired whenever the grid's ready-row count changes (new crew flow). */
  onGridReadyCountChange?: (n: number) => void
  /** Ready qualification count for the draft — gates the Save button. */
  draftReadyQualCount?: number
}

export function CrewProfileDetail({
  crewId,
  isDraft,
  member,
  serverProfile,
  isDirty,
  onFieldChange,
  onSave,
  onCancel,
  onRefresh,
  gridRef,
  onGridReadyCountChange,
  draftReadyQualCount = 0,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const [tab, setTab] = useState<TabKey>('qualifications')
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const statusChipColor = statusColor(member.status)

  const canSaveDraft =
    !!member.employeeId.trim() && !!member.firstName.trim() && !!member.lastName.trim() && draftReadyQualCount > 0
  const saveDisabled = isDraft ? !canSaveDraft : !isDirty
  const draftSaveBlockedReason =
    isDraft && !canSaveDraft
      ? !member.employeeId.trim() || !member.firstName.trim() || !member.lastName.trim()
        ? 'Crew ID, First and Last name are required'
        : 'Add at least one Aircraft Type Qualification (A/C Type + Position)'
      : undefined

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-4 pb-3 border-b flex items-start gap-4" style={{ borderColor: border }}>
        <div className="flex-1 min-w-0">
          {isDraft ? (
            /* V1-style new-crew inline form — Crew ID / First / Middle / Last.
               Tab order runs left-to-right naturally. Required fields have the
               error-red border per the Form Input spec in CLAUDE.md. */
            <div className="grid gap-2" style={{ gridTemplateColumns: '140px 1fr 1fr 1fr' }}>
              <NewCrewInput
                placeholder="Crew ID *"
                value={member.employeeId}
                onChange={(v) => onFieldChange('employeeId', v)}
                autoFocus
                required
                palette={palette}
                isDark={isDark}
                mono
              />
              <NewCrewInput
                placeholder="First name *"
                value={member.firstName}
                onChange={(v) => onFieldChange('firstName', v)}
                required
                palette={palette}
                isDark={isDark}
              />
              <NewCrewInput
                placeholder="Middle name"
                value={member.middleName ?? ''}
                onChange={(v) => onFieldChange('middleName', v || null)}
                palette={palette}
                isDark={isDark}
              />
              <NewCrewInput
                placeholder="Last name *"
                value={member.lastName}
                onChange={(v) => onFieldChange('lastName', v)}
                required
                palette={palette}
                isDark={isDark}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[20px] font-semibold truncate" style={{ color: palette.text }}>
                  {[member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ') || '— —'}
                </h1>
                <span
                  className="text-[13px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: `${statusChipColor}22`, color: statusChipColor }}
                >
                  {member.status}
                </span>
                {isDirty && (
                  <span
                    className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#FF880022', color: '#FF8800' }}
                  >
                    UNSAVED
                  </span>
                )}
              </div>
              <p className="text-[13px] mt-0.5 truncate" style={{ color: palette.textTertiary }}>
                {member.employeeId}
                {serverProfile?.baseLabel ? ` · ${serverProfile.baseLabel}` : ''}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-opacity"
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: palette.textSecondary,
            }}
          >
            <RotateCcw size={13} />
            Cancel
          </button>
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() => void onSave()}
            className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: crewAccent(isDark), color: 'white' }}
            title={draftSaveBlockedReason}
          >
            <Save size={13} />
            {isDraft ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="px-5 flex gap-1 border-b overflow-x-auto" style={{ borderColor: border }}>
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="relative px-3 h-10 text-[13px] font-medium whitespace-nowrap transition-colors"
              style={{
                color: active ? crewAccent(isDark) : palette.textSecondary,
              }}
            >
              {t.label}
              {active && (
                <span
                  className="absolute left-0 right-0 bottom-0 h-[2px] rounded-t"
                  style={{ background: crewAccent(isDark) }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'qualifications' && (
          <QualificationsTab
            crewId={crewId}
            isDraft={isDraft}
            member={member}
            serverProfile={serverProfile}
            onFieldChange={onFieldChange}
            onRefresh={onRefresh}
            gridRef={gridRef}
            onGridReadyCountChange={onGridReadyCountChange}
          />
        )}
        {tab === 'contact' && (
          <ContactTab
            crewId={crewId}
            isDraft={isDraft}
            member={member}
            serverProfile={serverProfile}
            onFieldChange={onFieldChange}
            onRefresh={onRefresh}
          />
        )}
        {tab === 'scheduling' && (
          <SchedulingTab
            crewId={crewId}
            isDraft={isDraft}
            member={member}
            serverProfile={serverProfile}
            onFieldChange={onFieldChange}
            onRefresh={onRefresh}
          />
        )}
        {tab === 'employment' && (
          <EmploymentTab
            crewId={crewId}
            isDraft={isDraft}
            member={member}
            serverProfile={serverProfile}
            onFieldChange={onFieldChange}
            onRefresh={onRefresh}
          />
        )}
        {tab === 'identity' && (
          <IdentityTab
            crewId={crewId}
            isDraft={isDraft}
            member={member}
            serverProfile={serverProfile}
            onFieldChange={onFieldChange}
            onRefresh={onRefresh}
          />
        )}
        {tab === 'operations' && (
          <OperationsTab crewId={crewId} isDraft={isDraft} member={member} onFieldChange={onFieldChange} />
        )}
      </div>
    </div>
  )
}

function statusColor(s: CrewMemberRef['status']): string {
  if (s === 'active') return '#06C270' // XD success
  if (s === 'suspended') return '#FF8800' // XD warning
  if (s === 'terminated') return '#E63535' // XD error
  return '#555770' // XD neutral (offline)
}

/**
 * Inline required-field input used in the draft-crew header row.
 * Styled like V1: pill input, accent ring on focus, required fields get the
 * XD error-red border and pink background tint until filled.
 */
function NewCrewInput({
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
  palette,
  isDark,
  mono,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
  autoFocus?: boolean
  palette: Palette
  isDark: boolean
  mono?: boolean
}) {
  const empty = !value || !value.trim()
  const errorBorder = required && empty
  const defaultBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const border = errorBorder ? '#E63535' : defaultBorder
  const bg = errorBorder
    ? isDark
      ? 'rgba(230,53,53,0.08)'
      : 'rgba(230,53,53,0.04)'
    : isDark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(0,0,0,0.03)'
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full min-w-0 h-10 px-3 rounded-lg text-[13px] outline-none transition-all"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color: palette.text,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = crewAccent(isDark)
        e.currentTarget.style.boxShadow = `0 0 0 3px ${crewAccent(isDark)}33`
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = errorBorder ? '#E63535' : defaultBorder
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
  )
}
