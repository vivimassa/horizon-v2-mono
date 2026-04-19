'use client'

import { useState } from 'react'
import { Plus, Trash2, Phone, Heart } from 'lucide-react'
import { api, type CrewMemberRef, type CrewPhoneRef, type FullCrewProfileRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
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

export function ContactTab({ crewId, member, serverProfile, onFieldChange, onRefresh }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  return (
    <>
      <SectionCard title="Phone Numbers" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <PhonesTable
          crewId={crewId}
          phones={serverProfile?.phones ?? []}
          onRefresh={onRefresh}
          palette={palette}
          isDark={isDark}
        />
      </SectionCard>

      <SectionCard title="Email" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <FieldGrid cols={2}>
          <Field label="Primary Email" palette={palette}>
            <TextInput
              value={member.emailPrimary}
              onChange={(v) => onFieldChange('emailPrimary', v)}
              type="email"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Personal / Secondary" palette={palette}>
            <TextInput
              value={member.emailSecondary}
              onChange={(v) => onFieldChange('emailSecondary', v)}
              type="email"
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
      </SectionCard>

      <SectionCard title="Address" palette={palette} isDark={isDark} accentColor={crewAccent(isDark)}>
        <FieldGrid cols={2}>
          <Field label="Line 1" palette={palette}>
            <TextInput
              value={member.addressLine1}
              onChange={(v) => onFieldChange('addressLine1', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Line 2" palette={palette}>
            <TextInput
              value={member.addressLine2}
              onChange={(v) => onFieldChange('addressLine2', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
        <div className="h-4" />
        <FieldGrid cols={4}>
          <Field label="City" palette={palette}>
            <TextInput
              value={member.addressCity}
              onChange={(v) => onFieldChange('addressCity', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="State / Region" palette={palette}>
            <TextInput
              value={member.addressState}
              onChange={(v) => onFieldChange('addressState', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Postal Code" palette={palette}>
            <TextInput
              value={member.addressZip}
              onChange={(v) => onFieldChange('addressZip', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Country (ISO-3)" palette={palette}>
            <TextInput
              value={member.addressCountry}
              onChange={(v) => onFieldChange('addressCountry', v)}
              uppercase
              maxLength={3}
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
      </SectionCard>

      <div
        className="rounded-xl p-5 mb-4"
        style={{
          background: isDark ? 'rgba(230,53,53,0.05)' : 'rgba(230,53,53,0.03)',
          border: `1px solid #E6353533`,
          borderLeft: `3px solid #E63535`,
          boxShadow: isDark ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(96,97,112,0.06)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Heart size={16} style={{ color: '#E63535' }} />
          <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
            Emergency Contact / Next of Kin
          </h3>
        </div>
        <FieldGrid cols={3}>
          <Field label="Name" palette={palette}>
            <TextInput
              value={member.emergencyName}
              onChange={(v) => onFieldChange('emergencyName', v)}
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Relationship" palette={palette}>
            <TextInput
              value={member.emergencyRelationship}
              onChange={(v) => onFieldChange('emergencyRelationship', v)}
              placeholder="Spouse, Parent, Sibling…"
              palette={palette}
              isDark={isDark}
            />
          </Field>
          <Field label="Phone" palette={palette}>
            <TextInput
              value={member.emergencyPhone}
              onChange={(v) => onFieldChange('emergencyPhone', v)}
              type="tel"
              palette={palette}
              isDark={isDark}
            />
          </Field>
        </FieldGrid>
      </div>
    </>
  )
}

function PhonesTable({
  crewId,
  phones,
  onRefresh,
  palette,
  isDark,
}: {
  crewId: string | null
  phones: CrewPhoneRef[]
  onRefresh: () => Promise<unknown>
  palette: Palette
  isDark: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<{ priority: number; type: string; number: string; smsEnabled: boolean }>(() => ({
    priority: (phones.at(-1)?.priority ?? 0) + 1,
    type: 'Mobile',
    number: '',
    smsEnabled: false,
  }))
  const [busy, setBusy] = useState(false)

  const typeOpts = [
    { value: 'Mobile', label: 'Mobile' },
    { value: 'Home', label: 'Home' },
    { value: 'Work', label: 'Work' },
    { value: 'Other', label: 'Other' },
  ]

  if (!crewId) {
    return (
      <p className="text-[13px]" style={{ color: palette.textTertiary }}>
        Save the new crew first to add phone numbers.
      </p>
    )
  }

  const handleAdd = async () => {
    if (!draft.number.trim()) return
    setBusy(true)
    try {
      await api.addCrewPhone(crewId, draft)
      await onRefresh()
      setDraft({ priority: draft.priority + 1, type: 'Mobile', number: '', smsEnabled: false })
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (p: CrewPhoneRef, patch: Partial<CrewPhoneRef>) => {
    await api.updateCrewPhone(crewId, p._id, {
      priority: patch.priority ?? p.priority,
      type: patch.type ?? p.type,
      number: patch.number ?? p.number,
      smsEnabled: patch.smsEnabled ?? p.smsEnabled,
    })
    await onRefresh()
  }

  const handleDelete = async (id: string) => {
    await api.deleteCrewPhone(crewId, id)
    await onRefresh()
  }

  return (
    <div>
      {phones.length > 0 && (
        <div className="space-y-2 mb-3">
          {phones.map((p) => (
            <div
              key={p._id}
              className="grid gap-2 items-center"
              style={{ gridTemplateColumns: '60px 120px 1fr auto auto' }}
            >
              <TextInput
                value={p.priority}
                onChange={(v) => handleUpdate(p, { priority: Number(v) || 1 })}
                type="number"
                palette={palette}
                isDark={isDark}
              />
              <SelectInput
                value={p.type}
                options={typeOpts}
                onChange={(v) => handleUpdate(p, { type: v ?? 'Mobile' })}
                palette={palette}
                isDark={isDark}
              />
              <TextInput
                value={p.number}
                onChange={(v) => handleUpdate(p, { number: v ?? '' })}
                type="tel"
                palette={palette}
                isDark={isDark}
              />
              <CheckboxField
                label="SMS"
                checked={p.smsEnabled}
                onChange={(v) => handleUpdate(p, { smsEnabled: v })}
                palette={palette}
                isDark={isDark}
              />
              <button
                type="button"
                onClick={() => void handleDelete(p._id)}
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                title="Remove phone"
              >
                <Trash2 size={14} style={{ color: '#E63535' }} />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div
          className="grid gap-2 items-center p-3 rounded-lg"
          style={{
            gridTemplateColumns: '60px 120px 1fr auto auto',
            background: isDark ? 'rgba(20,184,166,0.08)' : 'rgba(20,184,166,0.04)',
            border: `1px solid ${crewAccent(isDark)}33`,
          }}
        >
          <TextInput
            value={draft.priority}
            onChange={(v) => setDraft({ ...draft, priority: Number(v) || 1 })}
            type="number"
            palette={palette}
            isDark={isDark}
          />
          <SelectInput
            value={draft.type}
            options={typeOpts}
            onChange={(v) => setDraft({ ...draft, type: v ?? 'Mobile' })}
            palette={palette}
            isDark={isDark}
          />
          <TextInput
            value={draft.number}
            onChange={(v) => setDraft({ ...draft, number: v ?? '' })}
            type="tel"
            placeholder="+1 555…"
            palette={palette}
            isDark={isDark}
          />
          <CheckboxField
            label="SMS"
            checked={draft.smsEnabled}
            onChange={(v) => setDraft({ ...draft, smsEnabled: v })}
            palette={palette}
            isDark={isDark}
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={busy}
              className="h-10 px-3 rounded-lg text-[13px] font-semibold"
              style={{ background: crewAccent(isDark), color: 'white' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="h-10 px-2 text-[13px]"
              style={{ color: palette.textTertiary }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5"
          style={{ border: `1px solid ${crewAccent(isDark)}55`, color: crewAccent(isDark) }}
        >
          <Plus size={13} />
          Add phone
        </button>
      )}
      {phones.length === 0 && !adding && (
        <p className="text-[13px] mt-3" style={{ color: palette.textTertiary }}>
          <Phone size={12} className="inline mr-1" />
          No phone numbers on file.
        </p>
      )}
    </div>
  )
}
