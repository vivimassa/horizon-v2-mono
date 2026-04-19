'use client'

import { useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import {
  api,
  type CrewMemberRef,
  type FullCrewProfileRef,
  type CrewBlockHoursRef,
  useAirports,
  useCrewPositions,
  useCrewGroups,
} from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { getOperatorId } from '@/stores/use-operator-store'
import { SectionCard } from '../common/section-card'
import { Field, FieldGrid, TextInput, SelectInput } from '../common/field'
import { crewAccent } from '../common/draft-helpers'

interface Props {
  crewId: string | null
  isDraft: boolean
  member: CrewMemberRef
  serverProfile: FullCrewProfileRef | null
  onFieldChange: (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => void
  onRefresh: () => Promise<unknown>
}

export function EmploymentTab({ crewId, member, serverProfile, onFieldChange, onRefresh }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const basesQ = useAirports({ crewBase: true })
  const posQ = useCrewPositions(getOperatorId())
  const groupsQ = useCrewGroups(getOperatorId())
  const bases = basesQ.data ?? []
  const positions = posQ.data ?? []
  const groups = groupsQ.data ?? []

  const baseOptions = bases.map((b) => ({ value: b._id, label: `${b.iataCode ?? b.icaoCode} — ${b.name}` }))
  const posOptions = positions.map((p) => ({ value: p._id, label: `${p.code} — ${p.name}` }))

  return (
    <>
      <SectionCard title="Employment Details" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <FieldGrid cols={3}>
          <Field label="Employee ID" palette={palette} required>
            <TextInput
              value={member.employeeId}
              onChange={(v) => onFieldChange('employeeId', v ?? '')}
              mono
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Short Code" palette={palette}>
            <TextInput
              value={member.shortCode}
              onChange={(v) => onFieldChange('shortCode', v)}
              uppercase
              maxLength={4}
              palette={palette}
              isDark={isDark}
              mono
            />
          </Field>
          <Field label="Contract Type" palette={palette}>
            <TextInput
              value={member.contractType}
              onChange={(v) => onFieldChange('contractType', v)}
              placeholder="Full-time"
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <FieldGrid cols={3}>
          <Field label="Status" palette={palette} required>
            <SelectInput
              value={member.status}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'terminated', label: 'Terminated' },
              ]}
              onChange={(v) => onFieldChange('status', (v ?? 'active') as CrewMemberRef['status'])}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Employment Date" palette={palette}>
            <TextInput
              value={member.employmentDate}
              onChange={(v) => onFieldChange('employmentDate', v)}
              type="date"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Exit Date" palette={palette}>
            <TextInput
              value={member.exitDate}
              onChange={(v) => onFieldChange('exitDate', v)}
              type="date"
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <Field label="Exit Reason" palette={palette}>
          <TextInput
            value={member.exitReason}
            onChange={(v) => onFieldChange('exitReason', v)}
            palette={palette}
            isDark={isDark}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Assignment"
        description="Home Base comes from 5.4.1 Crew Bases. Primary Position comes from 5.4.2 Crew Positions."
        palette={palette}
        isDark={isDark}
        accentColor={crewAccent(isDark)}
      >
        <FieldGrid cols={2}>
          <Field label="Home Base (5.4.1)" palette={palette}>
            {baseOptions.length > 0 ? (
              <SelectInput
                value={member.base}
                options={baseOptions}
                onChange={(v) => onFieldChange('base', v)}
                allowClear
                palette={palette}
                isDark={isDark}
              />
            ) : (
              <EmptyAdminLink
                href="/admin/crew-bases"
                label="No crew bases configured. Open 5.4.1 Crew Bases"
                palette={palette}
                isDark={isDark}
              />
            )}
          </Field>
          <Field label="Primary Position (5.4.2)" palette={palette}>
            {posOptions.length > 0 ? (
              <SelectInput
                value={member.position}
                options={posOptions}
                onChange={(v) => onFieldChange('position', v)}
                allowClear
                palette={palette}
                isDark={isDark}
              />
            ) : (
              <EmptyAdminLink
                href="/admin/crew-positions"
                label="No crew positions configured. Open 5.4.2 Crew Positions"
                palette={palette}
                isDark={isDark}
              />
            )}
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <FieldGrid cols={3}>
          <Field label="Seniority #" palette={palette}>
            <TextInput
              value={member.seniority}
              onChange={(v) => onFieldChange('seniority', v ? Number(v) : null)}
              type="number"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Seniority Group" palette={palette}>
            <TextInput
              value={member.seniorityGroup}
              onChange={(v) => onFieldChange('seniorityGroup', Number(v) || 0)}
              type="number"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Languages (comma-sep ISO-2)" palette={palette}>
            <TextInput
              value={member.languages.join(', ')}
              onChange={(v) =>
                onFieldChange(
                  'languages',
                  (v ?? '')
                    .split(',')
                    .map((x) => x.trim().toUpperCase())
                    .filter(Boolean),
                )
              }
              placeholder="EN, VI"
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
      </SectionCard>

      <SectionCard title="Crew Groups" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <GroupsPanel
          crewId={crewId}
          assignments={serverProfile?.groupAssignments ?? []}
          allGroups={groups.map((g) => ({ _id: g._id, name: g.name }))}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>

      <SectionCard title="Cumulative Block Hours" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <BlockHoursTable
          crewId={crewId}
          rows={serverProfile?.blockHours ?? []}
          positions={posOptions}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>
    </>
  )
}

function EmptyAdminLink({
  href,
  label,
  palette,
  isDark,
}: {
  href: string
  label: string
  palette: Palette
  isDark: boolean
}) {
  const accent = crewAccent(isDark)
  void palette
  return (
    <Link
      href={href}
      className="h-10 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 border"
      style={{
        background: `${accent}11`,
        borderColor: `${accent}33`,
        color: accent,
      }}
    >
      <ExternalLink size={13} />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function GroupsPanel({
  crewId,
  assignments,
  allGroups,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  assignments: FullCrewProfileRef['groupAssignments']
  allGroups: Array<{ _id: string; name: string }>
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [selected, setSelected] = useState<string>('')
  if (!crewId) {
    return (
      <p className="text-[13px]" style={{ color: palette.textTertiary }}>
        Save the new crew first to assign groups.
      </p>
    )
  }
  const assignedIds = new Set(assignments.map((a) => a.groupId))
  const remaining = allGroups.filter((g) => !assignedIds.has(g._id))
  const handleAdd = async () => {
    if (!selected) return
    await api.addCrewGroupAssignment(crewId, { groupId: selected, startDate: null, endDate: null })
    setSelected('')
    await onRefresh()
  }
  const handleRemove = async (assignId: string) => {
    await api.deleteCrewGroupAssignment(crewId, assignId)
    await onRefresh()
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {assignments.length === 0 && (
          <p className="text-[13px]" style={{ color: palette.textTertiary }}>
            No groups assigned.
          </p>
        )}
        {assignments.map((a) => (
          <span
            key={a._id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 h-6 rounded-full text-[13px] font-medium"
            style={{ background: `${crewAccent(isDark)}1a`, color: crewAccent(isDark) }}
          >
            {a.groupName}
            <button
              type="button"
              onClick={() => void handleRemove(a._id)}
              className="ml-0.5 w-4 h-4 rounded-full hover:bg-black/10 flex items-center justify-center"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {remaining.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 max-w-[260px]">
            <SelectInput
              value={selected}
              options={remaining.map((g) => ({ value: g._id, label: g.name }))}
              onChange={(v) => setSelected(v ?? '')}
              palette={palette}
              isDark={isDark}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!selected}
            className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: crewAccent(isDark), color: 'white' }}
          >
            <Plus size={13} />
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function BlockHoursTable({
  crewId,
  rows,
  positions,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewBlockHoursRef[]
  positions: Array<{ value: string; label: string }>
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState<{
    aircraftType: string
    position: string
    blockHours: string
    trainingHours: string
    firstFlight: string
    lastFlight: string
  }>({
    aircraftType: '',
    position: '',
    blockHours: '',
    trainingHours: '',
    firstFlight: '',
    lastFlight: '',
  })
  if (!crewId) {
    return (
      <p className="text-[13px]" style={{ color: palette.textTertiary }}>
        Save the new crew first to add block hours.
      </p>
    )
  }
  const handleAdd = async () => {
    if (!draft.aircraftType || !draft.position) return
    await api.upsertCrewBlockHours(crewId, {
      aircraftType: draft.aircraftType.toUpperCase(),
      position: draft.position,
      blockHours: draft.blockHours || null,
      trainingHours: draft.trainingHours || null,
      firstFlight: draft.firstFlight || null,
      lastFlight: draft.lastFlight || null,
    })
    setDraft({ aircraftType: '', position: '', blockHours: '', trainingHours: '', firstFlight: '', lastFlight: '' })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewBlockHours(crewId, id)
    await onRefresh()
  }
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  return (
    <div>
      {rows.length > 0 && (
        <div className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
          <div
            className="grid text-[12px] font-medium uppercase tracking-wide"
            style={{
              gridTemplateColumns: '90px 100px 100px 100px 120px 120px 44px',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              color: palette.textSecondary,
            }}
          >
            <div className="px-2 py-1.5">A/C</div>
            <div className="px-2 py-1.5">Position</div>
            <div className="px-2 py-1.5">Block hrs</div>
            <div className="px-2 py-1.5">Training hrs</div>
            <div className="px-2 py-1.5">First flight</div>
            <div className="px-2 py-1.5">Last flight</div>
            <div></div>
          </div>
          {rows.map((r) => (
            <div
              key={r._id}
              className="grid text-[13px] border-t"
              style={{
                gridTemplateColumns: '90px 100px 100px 100px 120px 120px 44px',
                borderColor: border,
                color: palette.text,
              }}
            >
              <div className="px-2 py-2 font-mono">{r.aircraftType}</div>
              <div className="px-2 py-2 font-mono">
                {positions.find((p) => p.value === r.position)?.label ?? r.position}
              </div>
              <div className="px-2 py-2">{r.blockHours ?? '—'}</div>
              <div className="px-2 py-2">{r.trainingHours ?? '—'}</div>
              <div className="px-2 py-2">{r.firstFlight ?? '—'}</div>
              <div className="px-2 py-2">{r.lastFlight ?? '—'}</div>
              <div className="px-2 py-2 flex items-center">
                <button type="button" onClick={() => void handleDelete(r._id)} title="Delete">
                  <Trash2 size={12} style={{ color: '#E63535' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: '100px 140px 110px 110px 140px 140px max-content' }}
      >
        <TextInput
          value={draft.aircraftType}
          onChange={(v) => setDraft({ ...draft, aircraftType: (v ?? '').toUpperCase() })}
          placeholder="A320"
          mono
          uppercase
          palette={palette}
          isDark={isDark}
        />
        <SelectInput
          value={draft.position}
          options={positions}
          onChange={(v) => setDraft({ ...draft, position: v ?? '' })}
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.blockHours}
          onChange={(v) => setDraft({ ...draft, blockHours: v ?? '' })}
          placeholder="1500.5"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.trainingHours}
          onChange={(v) => setDraft({ ...draft, trainingHours: v ?? '' })}
          placeholder="20"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.firstFlight}
          onChange={(v) => setDraft({ ...draft, firstFlight: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.lastFlight}
          onChange={(v) => setDraft({ ...draft, lastFlight: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={13} />
          Upsert
        </button>
      </div>
    </div>
  )
}
