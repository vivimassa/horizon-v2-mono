'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api, getApiBaseUrl, setApiBaseUrl, type OperatorRef } from '@skyhub/api'
import { authedFetch } from '@/lib/authed-fetch'
import { MasterDetailLayout } from '@/components/layout'
import { collapseDock } from '@/lib/dock-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { CountryFlag } from '@/components/ui/country-flag'
import { Dropdown } from '@/components/ui/dropdown'
import {
  Building2,
  Globe,
  Clock,
  Palette,
  Shield,
  Plane,
  Radio,
  Save,
  Check,
  X,
  ChevronRight,
  Upload,
  Trash2,
  Banknote,
  MapPin,
  Scale,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

setApiBaseUrl('http://localhost:3002')

/* ── Section definitions ── */
interface SectionDef {
  key: string
  label: string
  icon: LucideIcon
  desc: string
}

const SECTIONS: SectionDef[] = [
  { key: 'company', label: 'Company Information', icon: Building2, desc: 'Identity & registration' },
  { key: 'operations', label: 'Operational Settings', icon: Clock, desc: 'Timezone, base, regulations' },
  { key: 'branding', label: 'Branding', icon: Palette, desc: 'Colors & visual identity' },
]

/* ── Page ── */
export default function OperatorConfigPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Focus workspace — fold the bottom dock by default on this page.
  useEffect(() => {
    collapseDock()
  }, [])
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const accent = '#1e40af'

  const [operator, setOperator] = useState<OperatorRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Partial<OperatorRef>>({})
  const [activeSection, setActiveSection] = useState('company')

  const fetchOperator = useCallback(async () => {
    setLoading(true)
    try {
      const operators = await api.getOperators()
      if (operators.length > 0) setOperator(operators[0])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOperator()
  }, [fetchOperator])

  const handleChange = useCallback((key: string, value: string | boolean | string[] | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const getVal = (key: keyof OperatorRef) => (key in draft ? (draft as any)[key] : operator?.[key])

  const handleSave = useCallback(async () => {
    if (!operator || Object.keys(draft).length === 0) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await api.updateOperator(operator._id, draft)
      setOperator(updated)
      useOperatorStore.getState().setOperator(updated)
      setDraft({})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [operator, draft])

  const hasDraft = Object.keys(draft).length > 0

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[14px]" style={{ color: palette.textTertiary }}>
          Loading operator…
        </span>
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[14px]" style={{ color: palette.textTertiary }}>
          No operator configured
        </span>
      </div>
    )
  }

  return (
    <MasterDetailLayout
      left={
        <OperatorSidebar
          operator={operator}
          sections={SECTIONS}
          activeSection={activeSection}
          onSelect={setActiveSection}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
      center={
        <OperatorCenter
          operator={operator}
          activeSection={activeSection}
          draft={draft}
          getVal={getVal}
          onChange={handleChange}
          onSave={handleSave}
          onRefresh={fetchOperator}
          saving={saving}
          saved={saved}
          hasDraft={hasDraft}
          error={error}
          setError={setError}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
    />
  )
}

/* ── Left Panel: Sidebar ── */
function OperatorSidebar({
  operator,
  sections,
  activeSection,
  onSelect,
  palette,
  isDark,
  accent,
}: {
  operator: OperatorRef
  sections: SectionDef[]
  activeSection: string
  onSelect: (key: string) => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[15px] font-bold">Operator Profile</h2>
      </div>

      {/* Section navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            const active = activeSection === section.key
            return (
              <button
                key={section.key}
                onClick={() => onSelect(section.key)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${
                  active
                    ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                    : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: active
                      ? accentTint(accent, isDark ? 0.18 : 0.1)
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <Icon size={16} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] font-medium ${active ? 'text-module-accent' : ''}`}>{section.label}</div>
                  <div className="text-[11px] text-hz-text-secondary truncate">{section.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Center Panel ── */
function OperatorCenter({
  operator,
  activeSection,
  draft,
  getVal,
  onChange,
  onSave,
  onRefresh,
  saving,
  saved,
  hasDraft,
  error,
  setError,
  palette,
  isDark,
  accent,
}: {
  operator: OperatorRef
  activeSection: string
  draft: Partial<OperatorRef>
  getVal: (key: keyof OperatorRef) => any
  onChange: (key: string, value: any) => void
  onSave: () => void
  onRefresh: () => void
  saving: boolean
  saved: boolean
  hasDraft: boolean
  error: string
  setError: (e: string) => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const section = SECTIONS.find((s) => s.key === activeSection)
  const Icon = section?.icon ?? Building2

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full" style={{ background: accent }} />
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accentTint(accent, isDark ? 0.15 : 0.08) }}
          >
            <Icon size={18} color={accent} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold">{section?.label}</h1>
            <p className="text-[12px] text-hz-text-secondary">{section?.desc}</p>
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving || !hasDraft}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: saved ? '#16a34a' : accent }}
        >
          {saved ? <Check size={14} strokeWidth={2.5} /> : <Save size={14} strokeWidth={1.8} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-6 mt-3 px-4 py-2.5 rounded-xl border flex items-center justify-between"
          style={{
            borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca',
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2',
          }}
        >
          <span className="text-[12px]" style={{ color: isDark ? '#f87171' : '#dc2626' }}>
            {error}
          </span>
          <button onClick={() => setError('')}>
            <X size={14} color={isDark ? '#f87171' : '#dc2626'} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeSection === 'company' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-3xl">
            <FormField
              label="Company Name"
              required
              value={getVal('name')}
              fieldKey="name"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
            />
            <FormField
              label="Country"
              required
              value={getVal('country')}
              fieldKey="country"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
            />
            <FormField
              label="ICAO Code"
              value={getVal('icaoCode') || getVal('code')}
              fieldKey="icaoCode"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="3 uppercase letters"
              maxLength={3}
              uppercase
            />
            <FormField
              label="IATA Code"
              value={getVal('iataCode')}
              fieldKey="iataCode"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="2 uppercase alphanumeric"
              maxLength={2}
              uppercase
            />
            <FormField
              label="Callsign"
              value={getVal('callsign')}
              fieldKey="callsign"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="Radio telephony callsign"
            />
            <FormField
              label="Regulatory Authority"
              value={getVal('regulatoryAuthority')}
              fieldKey="regulatoryAuthority"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="e.g. CAAV, FAA, EASA, CAA"
            />
          </div>
        )}
        {activeSection === 'operations' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 max-w-3xl">
            <FormField
              label="Timezone (IANA)"
              required
              value={getVal('timezone')}
              fieldKey="timezone"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="e.g. Asia/Ho_Chi_Minh, Europe/London"
            />
            <AirportSelectField
              label="Main Base"
              required
              value={getVal('mainBaseIcao')}
              onChange={(v) => onChange('mainBaseIcao', v)}
              palette={palette}
              isDark={isDark}
              hint="Primary hub — basis for FDTL and crew rules"
            />
            <FormField
              label="FDTL Ruleset"
              value={getVal('fdtlRuleset')}
              fieldKey="fdtlRuleset"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="Fatigue & duty time regulation set"
            />
            <FormField
              label="Currency Code"
              value={getVal('currencyCode')}
              fieldKey="currencyCode"
              onChange={onChange}
              palette={palette}
              isDark={isDark}
              hint="e.g. USD, EUR, VND"
              maxLength={3}
              uppercase
            />
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium block mb-1">
                Date Format *
              </label>
              <select
                value={getVal('dateFormat') ?? 'DD-MMM-YY'}
                onChange={(e) => onChange('dateFormat', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] border outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  color: palette.text,
                }}
              >
                <option value="DD-MMM-YY">DD-MMM-YY (01-Apr-26)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (01/04/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (04/01/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-04-01)</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY (01.04.2026)</option>
              </select>
              <p className="text-[12px] mt-1" style={{ color: palette.textTertiary }}>
                How dates appear across the system
              </p>
            </div>
            <div>
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium block mb-1">
                Delay Code Adherence *
              </label>
              <Dropdown
                value={getVal('delayCodeAdherence') ?? 'ahm730'}
                onChange={(v) => onChange('delayCodeAdherence', v)}
                options={[
                  { value: 'ahm730', label: 'AHM 730/731' },
                  { value: 'ahm732', label: 'AHM 732' },
                ]}
              />
              <p className="text-[12px] mt-1" style={{ color: palette.textTertiary }}>
                IATA delay-code scheme used across the operation
              </p>
            </div>
          </div>
        )}
        {activeSection === 'branding' && (
          <LogoUploadSection
            operator={operator}
            onRefresh={onRefresh}
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        )}
      </div>
    </div>
  )
}

/* ── Form Field ── */
function LogoUploadSection({
  operator,
  onRefresh,
  palette,
  isDark,
  accent,
}: {
  operator: OperatorRef
  onRefresh: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const logoSrc = operator.logoUrl
    ? operator.logoUrl.startsWith('/uploads/')
      ? `http://localhost:3002${operator.logoUrl}`
      : operator.logoUrl
    : null

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        setError('File must be under 2MB')
        return
      }
      if (!/\.(jpe?g|png|svg|webp)$/i.test(file.name)) {
        setError('Only JPG, PNG, SVG, or WebP')
        return
      }
      setUploading(true)
      setError('')
      try {
        const form = new FormData()
        form.append('logo', file)
        const res = await authedFetch(`${getApiBaseUrl()}/operators/${operator._id}/logo`, {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Upload failed')
        }
        onRefresh()
        window.dispatchEvent(new Event('operator-logo-changed'))
      } catch (err: any) {
        setError(err.message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [operator._id, onRefresh],
  )

  const handleRemove = useCallback(async () => {
    setUploading(true)
    setError('')
    try {
      await authedFetch(`${getApiBaseUrl()}/operators/${operator._id}/logo`, { method: 'DELETE' })
      onRefresh()
      window.dispatchEvent(new Event('operator-logo-changed'))
    } catch (err: any) {
      setError(err.message || 'Remove failed')
    } finally {
      setUploading(false)
    }
  }, [operator._id, onRefresh])

  return (
    <div className="max-w-xl">
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-3 block"
        style={{ color: palette.textSecondary }}
      >
        Airline Logo
      </label>

      <div className="flex items-stretch gap-5">
        {/* Logo preview */}
        <div
          className="w-32 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            border: `2px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
          }}
        >
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
          ) : (
            <Building2 size={28} color={palette.textTertiary} strokeWidth={1.5} />
          )}
        </div>

        {/* Upload drop zone */}
        <div
          className="flex-1 rounded-xl px-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
          style={{
            backgroundColor: dragOver
              ? accentTint(accent, isDark ? 0.12 : 0.06)
              : isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.02)',
            border: `2px dashed ${dragOver ? accent : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            minHeight: 100,
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
        >
          <Upload size={20} color={dragOver ? accent : palette.textTertiary} strokeWidth={1.8} className="mb-1.5" />
          <p className="text-[13px] font-medium" style={{ color: dragOver ? accent : palette.text }}>
            {uploading ? 'Uploading…' : 'Click or drag to upload'}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: palette.textTertiary }}>
            JPG, PNG, SVG, or WebP. Max 2MB.
          </p>
        </div>
      </div>

      {/* Remove + error below the row */}
      {logoSrc && (
        <button
          onClick={handleRemove}
          disabled={uploading}
          className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          style={{ color: isDark ? '#f87171' : '#dc2626' }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
          Remove Logo
        </button>
      )}
      {error && (
        <p className="text-[12px] mt-2" style={{ color: '#dc2626' }}>
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.svg,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function AirportSelectField({
  label,
  value,
  onChange,
  palette,
  isDark,
  required,
  hint,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  palette: PaletteType
  isDark: boolean
  required?: boolean
  hint?: string
}) {
  const [airports, setAirports] = useState<
    { iataCode: string | null; icaoCode: string; name: string; city: string | null }[]
  >([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getAirports()
      .then((data) => {
        setAirports(data.map((a) => ({ iataCode: a.iataCode, icaoCode: a.icaoCode, name: a.name, city: a.city })))
      })
      .catch(console.error)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = value ? airports.find((a) => a.icaoCode === value || a.iataCode === value) : null
  const displayLabel = selected
    ? `${selected.iataCode ?? selected.icaoCode} — ${selected.name}${selected.city ? `, ${selected.city}` : ''}`
    : (value ?? '')

  const q = search.toLowerCase()
  const filtered = q
    ? airports
        .filter(
          (a) =>
            a.iataCode?.toLowerCase().includes(q) ||
            a.icaoCode.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q),
        )
        .slice(0, 30)
    : airports.slice(0, 30)

  return (
    <div ref={containerRef} className="relative">
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 rounded-xl text-[14px] text-left outline-none transition-all flex items-center justify-between"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${open ? accentTint('#1e40af', isDark ? 0.5 : 0.3) : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          color: value ? palette.text : palette.textTertiary,
          boxShadow: open ? `0 0 0 3px ${accentTint('#1e40af', isDark ? 0.15 : 0.08)}` : 'none',
        }}
      >
        <span className="truncate">{value ? displayLabel : 'Select airport…'}</span>
        <ChevronRight
          size={14}
          color={palette.textTertiary}
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? '#18181b' : '#ffffff',
            boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.12)',
          }}
        >
          <input
            type="text"
            value={search}
            placeholder="Search IATA, ICAO, name, city…"
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-2.5 text-[13px] outline-none"
            style={{
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: 'transparent',
              color: palette.text,
            }}
          />
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[13px]" style={{ color: palette.textTertiary }}>
                No airports found
              </div>
            ) : (
              filtered.map((a) => {
                const isCurrent = a.icaoCode === value
                return (
                  <button
                    key={a.icaoCode}
                    type="button"
                    className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 transition-colors"
                    style={{
                      background: isCurrent ? accentTint('#1e40af', isDark ? 0.1 : 0.06) : 'transparent',
                      color: isCurrent ? '#1e40af' : palette.text,
                    }}
                    onClick={() => {
                      onChange(a.icaoCode)
                      setOpen(false)
                      setSearch('')
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent)
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span className="font-bold w-10 shrink-0">{a.iataCode ?? '—'}</span>
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-[11px] shrink-0" style={{ color: palette.textTertiary }}>
                      {a.city}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function FormField({
  label,
  value,
  fieldKey,
  onChange,
  palette,
  isDark,
  required,
  hint,
  maxLength,
  uppercase,
}: {
  label: string
  value: any
  fieldKey: string
  onChange: (key: string, value: string | null) => void
  palette: PaletteType
  isDark: boolean
  required?: boolean
  hint?: string
  maxLength?: number
  uppercase?: boolean
}) {
  return (
    <div>
      <label
        className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <input
        type="text"
        value={value ?? ''}
        maxLength={maxLength}
        onChange={(e) => {
          const v = uppercase ? e.target.value.toUpperCase() : e.target.value
          onChange(fieldKey, v || null)
        }}
        className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none transition-all"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          color: palette.text,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = accentTint('#1e40af', isDark ? 0.5 : 0.3)
          e.currentTarget.style.boxShadow = `0 0 0 3px ${accentTint('#1e40af', isDark ? 0.15 : 0.08)}`
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}
