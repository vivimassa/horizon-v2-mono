'use client'

import { useCallback, useMemo, useState } from 'react'
import { Contact, Trash2, Loader2 } from 'lucide-react'
import type { NonCrewPersonCreate, NonCrewPersonRef } from '@skyhub/api'
import { DetailScreenHeader } from '@/components/ui'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { FormField, SelectField } from '@/components/admin/form-primitives'
import { AvatarUpload } from './avatar-upload'

interface NonCrewPeopleDetailProps {
  person: NonCrewPersonRef
  isDraft: boolean
  onSave: (id: string, data: Partial<NonCrewPersonCreate>) => Promise<NonCrewPersonRef>
  onDelete: (id: string) => Promise<void>
  onCreate: (data: NonCrewPersonCreate) => Promise<NonCrewPersonRef>
  onCancelDraft: () => void
  onRefresh: () => Promise<unknown>
}

function toCreatePayload(draft: NonCrewPersonRef): NonCrewPersonCreate {
  return {
    fullName: draft.fullName,
    dateOfBirth: draft.dateOfBirth,
    gender: draft.gender,
    nationality: draft.nationality.toUpperCase(),
    passport: {
      number: draft.passport.number,
      countryOfIssue: draft.passport.countryOfIssue.toUpperCase(),
      expiryDate: draft.passport.expiryDate,
    },
    contact: draft.contact,
    company: draft.company,
    department: draft.department,
    jumpseatPriority: draft.jumpseatPriority,
    doNotList: draft.doNotList,
    terminated: draft.terminated,
  }
}

function validate(draft: NonCrewPersonRef): string | null {
  if (!draft.fullName.first.trim()) return 'First name required'
  if (!draft.fullName.last.trim()) return 'Last name required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dateOfBirth)) return 'Date of birth must be YYYY-MM-DD'
  if (draft.nationality.length !== 3) return 'Nationality must be ISO 3166-1 alpha-3 (e.g. VNM, USA)'
  if (!draft.passport.number.trim()) return 'Passport number required'
  if (draft.passport.countryOfIssue.length !== 3) return 'Passport country of issue must be ISO 3166-1 alpha-3'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.passport.expiryDate)) return 'Passport expiry must be YYYY-MM-DD'
  return null
}

export function NonCrewPeopleDetail({
  person,
  isDraft,
  onSave,
  onDelete,
  onCreate,
  onCancelDraft,
}: NonCrewPeopleDetailProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const [editing, setEditing] = useState(isDraft)
  const [draft, setDraft] = useState<NonCrewPersonRef>(person)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sync draft if selected person changes
  useMemo(() => {
    setDraft(person)
    setEditing(isDraft)
    setError(null)
  }, [person, isDraft])

  const updateField = useCallback((path: string, value: string | number | boolean | null) => {
    setDraft((prev: NonCrewPersonRef) => {
      const next = structuredClone(prev)
      const parts = path.split('.')
      let obj: Record<string, unknown> = next as unknown as Record<string, unknown>
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]] as Record<string, unknown>
      }
      obj[parts[parts.length - 1]] = value
      return next
    })
  }, [])

  const handleSave = async () => {
    const err = validate(draft)
    if (err) {
      setError(err)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isDraft) {
        await onCreate(toCreatePayload(draft))
      } else {
        await onSave(draft._id, toCreatePayload(draft))
        setEditing(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    setError(null)
    try {
      await onDelete(person._id)
      setConfirmDelete(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <DetailScreenHeader
        icon={Contact}
        title={isDraft ? 'New Record' : `${draft.fullName.last}, ${draft.fullName.first}`}
        subtitle={[draft.company, draft.department].filter(Boolean).join(' · ') || 'Non-crew personnel'}
        editing={editing || isDraft}
        onEdit={() => setEditing(true)}
        onSave={handleSave}
        onCancel={() => {
          if (isDraft) onCancelDraft()
          else {
            setDraft(person)
            setEditing(false)
            setError(null)
          }
        }}
        onDelete={!isDraft ? () => setConfirmDelete(true) : undefined}
        saving={saving}
        status={
          !isDraft
            ? draft.terminated
              ? { label: 'Terminated', tone: 'danger' }
              : draft.doNotList
                ? { label: 'Not listed', tone: 'warning' }
                : { label: 'Active', tone: 'success' }
            : undefined
        }
      />

      <div className="px-6 py-5 space-y-6">
        {/* Avatar — only available after record exists */}
        {!isDraft && (
          <AvatarUpload
            personId={draft._id}
            avatarUrl={draft.avatarUrl}
            disabled={!editing || saving}
            onChange={(url) => setDraft((prev: NonCrewPersonRef) => ({ ...prev, avatarUrl: url }))}
          />
        )}

        {/* Identity & Passport — required for APIS */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-module-accent" />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: palette.text }}>
              Identity & Passport
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              label="First name"
              value={draft.fullName.first}
              fieldKey="fullName.first"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
            />
            <FormField
              label="Middle name"
              value={draft.fullName.middle}
              fieldKey="fullName.middle"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
            />
            <FormField
              label="Last name"
              value={draft.fullName.last}
              fieldKey="fullName.last"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <FormField
              label="Date of Birth"
              value={draft.dateOfBirth}
              fieldKey="dateOfBirth"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
              type="date"
              hint="YYYY-MM-DD"
            />
            <SelectField
              label="Gender"
              value={draft.gender}
              options={[
                { value: 'M', label: 'Male' },
                { value: 'F', label: 'Female' },
                { value: 'X', label: 'Unspecified' },
              ]}
              onChange={(v) => updateField('gender', v)}
              palette={palette}
              isDark={isDark}
              required
            />
            <FormField
              label="Nationality (ISO-3)"
              value={draft.nationality}
              fieldKey="nationality"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
              maxLength={3}
              uppercase
              hint="e.g. VNM, USA, GBR"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <FormField
              label="Passport Number"
              value={draft.passport.number}
              fieldKey="passport.number"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
            />
            <FormField
              label="Country of Issue (ISO-3)"
              value={draft.passport.countryOfIssue}
              fieldKey="passport.countryOfIssue"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
              maxLength={3}
              uppercase
            />
            <FormField
              label="Passport Expiry"
              value={draft.passport.expiryDate}
              fieldKey="passport.expiryDate"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              required
              type="date"
            />
          </div>
        </section>

        {/* Contact & Employer */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full" style={{ background: '#0f766e' }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: palette.text }}>
              Contact & Employer
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Email"
              value={draft.contact.email}
              fieldKey="contact.email"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              type="email"
              hint="Used for APIS notifications"
            />
            <FormField
              label="Phone"
              value={draft.contact.phone}
              fieldKey="contact.phone"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              type="tel"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <FormField
              label="Company"
              value={draft.company}
              fieldKey="company"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
              hint="e.g. MRO vendor, catering, own airline ops"
            />
            <FormField
              label="Department"
              value={draft.department}
              fieldKey="department"
              onChange={updateField}
              palette={palette}
              isDark={isDark}
            />
          </div>
        </section>

        {/* Jumpseat Settings */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full" style={{ background: '#b45309' }} />
            <h2 className="text-[14px] font-bold uppercase tracking-wider" style={{ color: palette.text }}>
              Jumpseat Settings
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="Priority"
              value={draft.jumpseatPriority}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
              ]}
              onChange={(v) => updateField('jumpseatPriority', v)}
              palette={palette}
              isDark={isDark}
            />
            <ToggleField
              label="Do not list"
              hint="Hide from the jumpseat picker even if active"
              value={draft.doNotList}
              onChange={(v) => updateField('doNotList', v)}
              palette={palette}
              isDark={isDark}
            />
            <ToggleField
              label="Terminated"
              hint="Retires this person; they won't appear in pickers"
              value={draft.terminated}
              onChange={(v) => updateField('terminated', v)}
              palette={palette}
              isDark={isDark}
            />
          </div>
        </section>

        {error && (
          <div
            className="rounded-xl px-3 py-2 text-[13px]"
            style={{ background: 'rgba(230,53,53,0.1)', border: '1px solid rgba(230,53,53,0.3)', color: '#E63535' }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false)
          }}
        >
          <div
            className="rounded-2xl p-5 max-w-[420px]"
            style={{
              background: isDark ? '#18181b' : '#ffffff',
              border: `1px solid ${border}`,
              boxShadow: '0 16px 64px rgba(0,0,0,0.3)',
            }}
          >
            <h3 className="text-[15px] font-bold mb-2" style={{ color: palette.text }}>
              Delete this person?
            </h3>
            <p className="text-[13px] mb-4" style={{ color: palette.textSecondary }}>
              <strong>
                {draft.fullName.first} {draft.fullName.last}
              </strong>{' '}
              will be permanently removed. Any flights where they were a jumpseater keep the historical record.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium"
                style={{ background: 'transparent', border: `1px solid ${border}`, color: palette.textSecondary }}
              >
                No, Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="h-9 px-5 rounded-lg text-[13px] font-bold text-white disabled:opacity-40 flex items-center gap-2"
                style={{ background: '#E63535' }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleField({
  label,
  hint,
  value,
  onChange,
  palette,
  isDark,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
  palette: PaletteType
  isDark: boolean
}) {
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="w-full h-[42px] rounded-xl flex items-center justify-between px-3 text-[13px] font-medium"
        style={{
          background: value ? 'rgba(6,194,112,0.12)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${value ? 'rgba(6,194,112,0.4)' : border}`,
          color: value ? '#06C270' : palette.textSecondary,
        }}
      >
        <span>{value ? 'Enabled' : 'Disabled'}</span>
        <span
          className="w-8 h-5 rounded-full relative transition-colors"
          style={{ background: value ? '#06C270' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: value ? 14 : 2 }}
          />
        </span>
      </button>
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}
