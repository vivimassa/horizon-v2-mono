'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  api,
  type CrewLicenseRef,
  type CrewMemberRef,
  type CrewPassportRef,
  type CrewVisaRef,
  type FullCrewProfileRef,
} from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { SectionCard } from '../common/section-card'
import { Field, FieldGrid, TextInput, SelectInput, CheckboxField } from '../common/field'
import { crewAccent } from '../common/draft-helpers'

interface Props {
  crewId: string | null
  isDraft: boolean
  member: CrewMemberRef
  serverProfile: FullCrewProfileRef | null
  onFieldChange: (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => void
  onRefresh: () => Promise<unknown>
}

export function IdentityTab({ crewId, member, serverProfile, onFieldChange, onRefresh }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  return (
    <>
      <SectionCard title="Personal Information" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <FieldGrid cols={3}>
          <Field label="First Name" palette={palette} required>
            <TextInput
              value={member.firstName}
              onChange={(v) => onFieldChange('firstName', v ?? '')}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Middle Name" palette={palette}>
            <TextInput
              value={member.middleName}
              onChange={(v) => onFieldChange('middleName', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Last Name" palette={palette} required>
            <TextInput
              value={member.lastName}
              onChange={(v) => onFieldChange('lastName', v ?? '')}
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <FieldGrid cols={4}>
          <Field label="Gender" palette={palette}>
            <SelectInput
              value={member.gender}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              onChange={(v) => onFieldChange('gender', v)}
              allowClear
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Date of Birth" palette={palette}>
            <TextInput
              value={member.dateOfBirth}
              onChange={(v) => onFieldChange('dateOfBirth', v)}
              type="date"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Nationality (ISO-3)" palette={palette}>
            <TextInput
              value={member.nationality}
              onChange={(v) => onFieldChange('nationality', v)}
              uppercase
              maxLength={3}
              mono
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Country of Residence (ISO-3)" palette={palette}>
            <TextInput
              value={member.countryOfResidence}
              onChange={(v) => onFieldChange('countryOfResidence', v)}
              uppercase
              maxLength={3}
              mono
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <FieldGrid cols={2}>
          <Field label="Residence Permit #" palette={palette}>
            <TextInput
              value={member.residencePermitNo}
              onChange={(v) => onFieldChange('residencePermitNo', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="APIS Alias" palette={palette}>
            <TextInput
              value={member.apisAlias}
              onChange={(v) => onFieldChange('apisAlias', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
      </SectionCard>

      <SectionCard title="Passports" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <PassportsTable
          crewId={crewId}
          rows={serverProfile?.passports ?? []}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>

      <SectionCard title="Licenses" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <LicensesTable
          crewId={crewId}
          rows={serverProfile?.licenses ?? []}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>

      <SectionCard title="Visas" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <VisasTable
          crewId={crewId}
          rows={serverProfile?.visas ?? []}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>
    </>
  )
}

function PassportsTable({
  crewId,
  rows,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewPassportRef[]
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState({
    number: '',
    country: '',
    nationality: '',
    placeOfIssue: '',
    issueDate: '',
    expiry: '',
    isActive: rows.length === 0,
  })
  if (!crewId) return <NotYet palette={palette} />
  const handleAdd = async () => {
    if (!draft.number || !draft.country || !draft.expiry) return
    await api.addCrewPassport(crewId, {
      number: draft.number,
      country: draft.country.toUpperCase(),
      nationality: draft.nationality.toUpperCase() || null,
      placeOfIssue: draft.placeOfIssue || null,
      issueDate: draft.issueDate || null,
      expiry: draft.expiry,
      isActive: draft.isActive,
    })
    setDraft({ number: '', country: '', nationality: '', placeOfIssue: '', issueDate: '', expiry: '', isActive: false })
    await onRefresh()
  }
  const handleToggleActive = async (p: CrewPassportRef) => {
    await api.updateCrewPassport(crewId, p._id, { isActive: !p.isActive })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewPassport(crewId, id)
    await onRefresh()
  }
  return (
    <TableWrap palette={palette} isDark={isDark}>
      <Header
        cols="1fr 70px 90px 120px 120px 120px 60px 44px"
        palette={palette}
        labels={['Number', 'Country', 'Nationality', 'Place of Issue', 'Issue Date', 'Expiry', 'Active', '']}
      />
      {rows.map((p) => (
        <Row key={p._id} cols="1fr 70px 90px 120px 120px 120px 60px 44px" isDark={isDark}>
          <Cell mono>{p.number}</Cell>
          <Cell mono>{p.country}</Cell>
          <Cell mono>{p.nationality ?? '—'}</Cell>
          <Cell>{p.placeOfIssue ?? '—'}</Cell>
          <Cell>{p.issueDate ?? '—'}</Cell>
          <Cell>{p.expiry}</Cell>
          <Cell center>
            <input
              type="checkbox"
              checked={p.isActive}
              onChange={() => void handleToggleActive(p)}
              style={{ accentColor: crewAccent(isDark) }}
            />
          </Cell>
          <Cell center>
            <button type="button" onClick={() => void handleDelete(p._id)}>
              <Trash2 size={12} style={{ color: '#E63535' }} />
            </button>
          </Cell>
        </Row>
      ))}
      <AddRow cols="1fr 70px 90px 120px 120px 120px 60px 44px" isDark={isDark}>
        <TextInput
          value={draft.number}
          onChange={(v) => setDraft({ ...draft, number: v ?? '' })}
          palette={palette}
          isDark={isDark}
          mono
          placeholder="A1234567"
        />
        <TextInput
          value={draft.country}
          onChange={(v) => setDraft({ ...draft, country: (v ?? '').toUpperCase() })}
          palette={palette}
          isDark={isDark}
          mono
          maxLength={3}
          uppercase
          placeholder="VNM"
        />
        <TextInput
          value={draft.nationality}
          onChange={(v) => setDraft({ ...draft, nationality: (v ?? '').toUpperCase() })}
          palette={palette}
          isDark={isDark}
          mono
          maxLength={3}
          uppercase
        />
        <TextInput
          value={draft.placeOfIssue}
          onChange={(v) => setDraft({ ...draft, placeOfIssue: v ?? '' })}
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.issueDate}
          onChange={(v) => setDraft({ ...draft, issueDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.expiry}
          onChange={(v) => setDraft({ ...draft, expiry: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            style={{ accentColor: crewAccent(isDark) }}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 rounded-lg flex items-center justify-center"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={14} />
        </button>
      </AddRow>
    </TableWrap>
  )
}

function LicensesTable({
  crewId,
  rows,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewLicenseRef[]
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState({
    number: '',
    type: 'ATPL',
    country: '',
    placeOfIssue: '',
    issueDate: '',
    temporary: false,
  })
  if (!crewId) return <NotYet palette={palette} />
  const handleAdd = async () => {
    if (!draft.number || !draft.type) return
    await api.addCrewLicense(crewId, {
      number: draft.number,
      type: draft.type,
      country: draft.country.toUpperCase() || null,
      placeOfIssue: draft.placeOfIssue || null,
      issueDate: draft.issueDate || null,
      temporary: draft.temporary,
    })
    setDraft({ number: '', type: 'ATPL', country: '', placeOfIssue: '', issueDate: '', temporary: false })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewLicense(crewId, id)
    await onRefresh()
  }
  const typeOpts = [
    { value: 'ATPL', label: 'ATPL' },
    { value: 'CPL', label: 'CPL' },
    { value: 'PPL', label: 'PPL' },
    { value: 'TypeRating', label: 'Type Rating' },
    { value: 'MCCI', label: 'MCCI' },
    { value: 'CabinAttestation', label: 'Cabin Attestation' },
    { value: 'Other', label: 'Other' },
  ]
  return (
    <TableWrap palette={palette} isDark={isDark}>
      <Header
        cols="1fr 140px 80px 140px 120px 90px 44px"
        palette={palette}
        labels={['Number', 'Type', 'Country', 'Place of Issue', 'Issue Date', 'Temporary', '']}
      />
      {rows.map((r) => (
        <Row key={r._id} cols="1fr 140px 80px 140px 120px 90px 44px" isDark={isDark}>
          <Cell mono>{r.number}</Cell>
          <Cell>{r.type}</Cell>
          <Cell mono>{r.country ?? '—'}</Cell>
          <Cell>{r.placeOfIssue ?? '—'}</Cell>
          <Cell>{r.issueDate ?? '—'}</Cell>
          <Cell center>{r.temporary ? 'Yes' : 'No'}</Cell>
          <Cell center>
            <button type="button" onClick={() => void handleDelete(r._id)}>
              <Trash2 size={12} style={{ color: '#E63535' }} />
            </button>
          </Cell>
        </Row>
      ))}
      <AddRow cols="1fr 140px 80px 140px 120px 90px 44px" isDark={isDark}>
        <TextInput
          value={draft.number}
          onChange={(v) => setDraft({ ...draft, number: v ?? '' })}
          palette={palette}
          isDark={isDark}
          mono
        />
        <SelectInput
          value={draft.type}
          options={typeOpts}
          onChange={(v) => setDraft({ ...draft, type: v ?? 'ATPL' })}
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.country}
          onChange={(v) => setDraft({ ...draft, country: (v ?? '').toUpperCase() })}
          mono
          maxLength={3}
          uppercase
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.placeOfIssue}
          onChange={(v) => setDraft({ ...draft, placeOfIssue: v ?? '' })}
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.issueDate}
          onChange={(v) => setDraft({ ...draft, issueDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={draft.temporary}
            onChange={(e) => setDraft({ ...draft, temporary: e.target.checked })}
            style={{ accentColor: crewAccent(isDark) }}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 rounded-lg flex items-center justify-center"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={14} />
        </button>
      </AddRow>
    </TableWrap>
  )
}

function VisasTable({
  crewId,
  rows,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  rows: CrewVisaRef[]
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [draft, setDraft] = useState({ country: '', type: '', number: '', issueDate: '', expiry: '' })
  if (!crewId) return <NotYet palette={palette} />
  const handleAdd = async () => {
    if (!draft.country || !draft.expiry) return
    await api.addCrewVisa(crewId, {
      country: draft.country.toUpperCase(),
      type: draft.type || null,
      number: draft.number || null,
      issueDate: draft.issueDate || null,
      expiry: draft.expiry,
    })
    setDraft({ country: '', type: '', number: '', issueDate: '', expiry: '' })
    await onRefresh()
  }
  const handleDelete = async (id: string) => {
    await api.deleteCrewVisa(crewId, id)
    await onRefresh()
  }
  return (
    <TableWrap palette={palette} isDark={isDark}>
      <Header
        cols="90px 140px 1fr 120px 120px 44px"
        palette={palette}
        labels={['Country', 'Type', 'Number', 'Issue Date', 'Expiry', '']}
      />
      {rows.map((r) => (
        <Row key={r._id} cols="90px 140px 1fr 120px 120px 44px" isDark={isDark}>
          <Cell mono>{r.country}</Cell>
          <Cell>{r.type ?? '—'}</Cell>
          <Cell mono>{r.number ?? '—'}</Cell>
          <Cell>{r.issueDate ?? '—'}</Cell>
          <Cell>{r.expiry}</Cell>
          <Cell center>
            <button type="button" onClick={() => void handleDelete(r._id)}>
              <Trash2 size={12} style={{ color: '#E63535' }} />
            </button>
          </Cell>
        </Row>
      ))}
      <AddRow cols="90px 140px 1fr 120px 120px 44px" isDark={isDark}>
        <TextInput
          value={draft.country}
          onChange={(v) => setDraft({ ...draft, country: (v ?? '').toUpperCase() })}
          mono
          maxLength={3}
          uppercase
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.type}
          onChange={(v) => setDraft({ ...draft, type: v ?? '' })}
          placeholder="Tourist, Work…"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.number}
          onChange={(v) => setDraft({ ...draft, number: v ?? '' })}
          mono
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.issueDate}
          onChange={(v) => setDraft({ ...draft, issueDate: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <TextInput
          value={draft.expiry}
          onChange={(v) => setDraft({ ...draft, expiry: v ?? '' })}
          type="date"
          palette={palette}
          isDark={isDark}
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="h-10 rounded-lg flex items-center justify-center"
          style={{ background: crewAccent(isDark), color: 'white' }}
        >
          <Plus size={14} />
        </button>
      </AddRow>
    </TableWrap>
  )
}

// ─── helpers ───
function TableWrap({ children, palette, isDark }: { children: React.ReactNode; palette: Palette; isDark: boolean }) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${border}`, background: isDark ? 'transparent' : '#FFFFFF' }}
    >
      {children}
    </div>
  )
}
function Header({ cols, labels, palette }: { cols: string; labels: string[]; palette: Palette }) {
  return (
    <div
      className="grid text-[12px] font-medium uppercase tracking-wide"
      style={{ gridTemplateColumns: cols, background: 'rgba(0,0,0,0.03)', color: palette.textSecondary }}
    >
      {labels.map((l, i) => (
        <div key={i} className="px-2 py-1.5">
          {l}
        </div>
      ))}
    </div>
  )
}
function Row({ cols, children, isDark }: { cols: string; children: React.ReactNode; isDark: boolean }) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  return (
    <div className="grid text-[13px] border-t" style={{ gridTemplateColumns: cols, borderColor: border }}>
      {children}
    </div>
  )
}
function AddRow({ cols, children, isDark }: { cols: string; children: React.ReactNode; isDark: boolean }) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  return (
    <div
      className="grid gap-2 p-2 border-t"
      style={{
        gridTemplateColumns: cols,
        borderColor: border,
        background: isDark ? 'rgba(20,184,166,0.06)' : 'rgba(15,118,110,0.04)',
      }}
    >
      {children}
    </div>
  )
}
function Cell({ children, mono, center }: { children: React.ReactNode; mono?: boolean; center?: boolean }) {
  return (
    <div
      className={`px-2 py-2 truncate ${center ? 'flex items-center justify-center' : ''}`}
      style={{ fontFamily: mono ? 'ui-monospace, monospace' : undefined }}
    >
      {children}
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

// unused warning guard
void CheckboxField
