'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  api,
  type CrewAirportRestrictionRef,
  type CrewMemberRef,
  type CrewOnOffPatternRef,
  type CrewRulesetRef,
  type FullCrewProfileRef,
  useDutyPatterns,
} from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { getOperatorId } from '@/stores/use-operator-store'
import { SectionCard } from '../common/section-card'
import { Field, FieldGrid, TextInput, CheckboxField, SelectInput } from '../common/field'
import { crewAccent } from '../common/draft-helpers'

interface Props {
  crewId: string | null
  isDraft: boolean
  member: CrewMemberRef
  serverProfile: FullCrewProfileRef | null
  onFieldChange: (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => void
  onRefresh: () => Promise<unknown>
}

export function SchedulingTab({ crewId, member, serverProfile, onFieldChange, onRefresh }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const dutyPatternsQ = useDutyPatterns(getOperatorId())

  return (
    <>
      <SectionCard
        title="Seniority & Position Rules"
        palette={palette}
        isDark={isDark}
        accentColor={crewAccent(isDark)}
      >
        <FieldGrid cols={3}>
          <Field label="Fly With Senior Until" palette={palette}>
            <TextInput
              value={member.flyWithSeniorUntil}
              onChange={(v) => onFieldChange('flyWithSeniorUntil', v)}
              type="date"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Do Not Schedule Alt Position" palette={palette}>
            <TextInput
              value={member.doNotScheduleAltPosition}
              onChange={(v) => onFieldChange('doNotScheduleAltPosition', v)}
              placeholder="e.g. FO"
              uppercase
              mono
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Max Layover Stops" palette={palette}>
            <TextInput
              value={member.maxLayoverStops}
              onChange={(v) => onFieldChange('maxLayoverStops', v ? Number(v) : null)}
              type="number"
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <CheckboxField
            label="Standby Exempted"
            checked={member.standbyExempted}
            onChange={(v) => onFieldChange('standbyExempted', v)}
            palette={palette}
            isDark={isDark}
          />
          <CheckboxField
            label="Crew Under Training"
            checked={member.crewUnderTraining}
            onChange={(v) => onFieldChange('crewUnderTraining', v)}
            palette={palette}
            isDark={isDark}
          />
          <CheckboxField
            label="No Domestic Flights"
            checked={member.noDomesticFlights}
            onChange={(v) => onFieldChange('noDomesticFlights', v)}
            palette={palette}
            isDark={isDark}
          />
          <CheckboxField
            label="No International Flights"
            checked={member.noInternationalFlights}
            onChange={(v) => onFieldChange('noInternationalFlights', v)}
            palette={palette}
            isDark={isDark}
          />
        </div>
      </SectionCard>

      <SectionCard title="Work Rulesets" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <RulesetList
          crewId={crewId}
          rows={serverProfile?.rulesets ?? []}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>

      <SectionCard title="On / Off Patterns" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <PatternList
          crewId={crewId}
          rows={serverProfile?.onOffPatterns ?? []}
          patternOptions={(dutyPatternsQ.data ?? []).map((d) => ({ value: d.code, label: d.code }))}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>

      <SectionCard title="Airport Restrictions" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <AirportList
          crewId={crewId}
          rows={serverProfile?.airportRestrictions ?? []}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>
    </>
  )
}

function RulesetList({
  crewId,
  rows,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewRulesetRef[]
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState({ name: '', startDate: new Date().toISOString().slice(0, 10), endDate: '' })
  if (!crewId) return <NotYet palette={palette} />
  const handleAdd = async () => {
    if (!draft.name) return
    await api.addCrewRuleset(crewId, { name: draft.name, startDate: draft.startDate, endDate: draft.endDate || null })
    setDraft({ name: '', startDate: new Date().toISOString().slice(0, 10), endDate: '' })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewRuleset(crewId, id)
    await onRefresh()
  }
  return (
    <div>
      {rows.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {rows.map((r) => (
            <li key={r._id} className="flex items-center gap-3 text-[13px]" style={{ color: palette.text }}>
              <span className="font-medium">{r.name}</span>
              <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                {r.startDate} → {r.endDate ?? '—'}
              </span>
              <button type="button" onClick={() => void handleDelete(r._id)} className="ml-auto">
                <Trash2 size={12} style={{ color: '#E63535' }} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] mb-3" style={{ color: palette.textTertiary }}>
          No rulesets assigned.
        </p>
      )}
      <div className="grid gap-2 items-end" style={{ gridTemplateColumns: '1fr 140px 140px max-content' }}>
        <TextInput
          value={draft.name}
          onChange={(v) => setDraft({ ...draft, name: v ?? '' })}
          placeholder="EASA OPS"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.startDate}
          onChange={(v) => setDraft({ ...draft, startDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.endDate}
          onChange={(v) => setDraft({ ...draft, endDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

function PatternList({
  crewId,
  rows,
  patternOptions,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewOnOffPatternRef[]
  patternOptions: Array<{ value: string; label: string }>
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState({
    patternType: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    startingDay: 0,
  })
  if (!crewId) return <NotYet palette={palette} />
  const handleAdd = async () => {
    if (!draft.patternType) return
    await api.addCrewOnOffPattern(crewId, {
      patternType: draft.patternType,
      startDate: draft.startDate,
      endDate: draft.endDate || null,
      startingDay: Number(draft.startingDay) || 0,
    })
    setDraft({ patternType: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', startingDay: 0 })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewOnOffPattern(crewId, id)
    await onRefresh()
  }
  return (
    <div>
      {rows.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {rows.map((r) => (
            <li key={r._id} className="flex items-center gap-3 text-[13px]" style={{ color: palette.text }}>
              <span className="font-mono">{r.patternType}</span>
              <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                {r.startDate} → {r.endDate ?? '—'} · start day {r.startingDay}
              </span>
              <button type="button" onClick={() => void handleDelete(r._id)} className="ml-auto">
                <Trash2 size={12} style={{ color: '#E63535' }} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] mb-3" style={{ color: palette.textTertiary }}>
          No patterns assigned.
        </p>
      )}
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 140px 140px 100px max-content' }}
      >
        {patternOptions.length > 0 ? (
          <SelectInput
            value={draft.patternType}
            options={patternOptions}
            onChange={(v) => setDraft({ ...draft, patternType: v ?? '' })}
            palette={palette}
            isDark={isDark}
          />
        ) : (
          <TextInput
            value={draft.patternType}
            onChange={(v) => setDraft({ ...draft, patternType: v ?? '' })}
            placeholder="3/4"
            palette={palette}
            isDark={isDark}
          />
        )}
        <TextInput
          value={draft.startDate}
          onChange={(v) => setDraft({ ...draft, startDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.endDate}
          onChange={(v) => setDraft({ ...draft, endDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.startingDay}
          onChange={(v) => setDraft({ ...draft, startingDay: Number(v) || 0 })}
          type="number"
          palette={palette}
          isDark={isDark}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

function AirportList({
  crewId,
  rows,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewAirportRestrictionRef[]
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState<{
    airport: string
    type: 'RESTRICTED' | 'PREFERRED'
    startDate: string
    endDate: string
  }>({
    airport: '',
    type: 'RESTRICTED',
    startDate: '',
    endDate: '',
  })
  if (!crewId) return <NotYet palette={palette} />
  const handleAdd = async () => {
    if (!draft.airport) return
    await api.addCrewAirportRestriction(crewId, {
      airport: draft.airport.toUpperCase(),
      type: draft.type,
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
    })
    setDraft({ airport: '', type: 'RESTRICTED', startDate: '', endDate: '' })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewAirportRestriction(crewId, id)
    await onRefresh()
  }
  return (
    <div>
      {rows.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {rows.map((r) => (
            <li key={r._id} className="flex items-center gap-3 text-[13px]" style={{ color: palette.text }}>
              <span className="font-mono">{r.airport}</span>
              <span
                className="text-[13px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: r.type === 'RESTRICTED' ? '#E6353522' : '#06C27022',
                  color: r.type === 'RESTRICTED' ? '#E63535' : '#06C270',
                }}
              >
                {r.type}
              </span>
              <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                {r.startDate ?? '—'} → {r.endDate ?? '—'}
              </span>
              <button type="button" onClick={() => void handleDelete(r._id)} className="ml-auto">
                <Trash2 size={12} style={{ color: '#E63535' }} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] mb-3" style={{ color: palette.textTertiary }}>
          No airport restrictions configured.
        </p>
      )}
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 160px 140px 140px max-content' }}
      >
        <TextInput
          value={draft.airport}
          onChange={(v) => setDraft({ ...draft, airport: (v ?? '').toUpperCase() })}
          uppercase
          maxLength={4}
          mono
          placeholder="VVTS"
          palette={palette}
          isDark={isDark}
        />
        <SelectInput
          value={draft.type}
          options={[
            { value: 'RESTRICTED', label: 'Restricted' },
            { value: 'PREFERRED', label: 'Preferred' },
          ]}
          onChange={(v) => setDraft({ ...draft, type: (v ?? 'RESTRICTED') as 'RESTRICTED' | 'PREFERRED' })}
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.startDate}
          onChange={(v) => setDraft({ ...draft, startDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.endDate}
          onChange={(v) => setDraft({ ...draft, endDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

function NotYet({ palette }: { palette: Palette }) {
  return (
    <p className="text-[13px]" style={{ color: palette.textTertiary }}>
      Save the new crew first to manage these records.
    </p>
  )
}
