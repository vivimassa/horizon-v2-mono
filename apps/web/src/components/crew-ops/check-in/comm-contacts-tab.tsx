'use client'

import { useEffect, useMemo, useState } from 'react'
import { Phone, Mail, MapPin, MessageCircle, User as UserIcon, Globe, Check } from 'lucide-react'
import {
  api,
  getApiBaseUrl,
  type CountryRef,
  type CrewAssignmentRef,
  type CrewMemberListItemRef,
  type CrewPositionRef,
  type FullCrewProfileRef,
  type PairingRef,
} from '@skyhub/api'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { formatDate, type DateFormatType } from '@/lib/date-format'

interface Props {
  pairing: PairingRef
  assignments: CrewAssignmentRef[]
  crewById: Map<string, CrewMemberListItemRef>
  positionsById: Map<string, CrewPositionRef>
}

// Module-level cache — countries are static reference data, fetched once
// per session rather than per crew selection.
let countriesPromise: Promise<CountryRef[]> | null = null
function loadCountries(): Promise<CountryRef[]> {
  if (!countriesPromise) {
    countriesPromise = api.getCountries().catch((err) => {
      countriesPromise = null
      throw err
    })
  }
  return countriesPromise
}

function useCountriesMap() {
  const [countries, setCountries] = useState<CountryRef[]>([])
  useEffect(() => {
    let alive = true
    loadCountries()
      .then((list) => {
        if (alive) setCountries(list)
      })
      .catch((err) => console.warn('[crew-checkin] countries load failed', err))
    return () => {
      alive = false
    }
  }, [])
  return useMemo(() => {
    const map = new Map<string, CountryRef>()
    for (const c of countries) {
      if (c.isoCode2) map.set(c.isoCode2.toUpperCase(), c)
      if (c.isoCode3) map.set(c.isoCode3.toUpperCase(), c)
      if (c.name) map.set(c.name.toUpperCase(), c)
    }
    return map
  }, [countries])
}

function resolveNationality(raw: string | null | undefined, countries: Map<string, CountryRef>): string | null {
  if (!raw) return null
  const c = countries.get(raw.toUpperCase())
  if (c) {
    const flag = c.flagEmoji ? `${c.flagEmoji} ` : ''
    return `${flag}${c.name}`
  }
  return capitalize(raw)
}

/**
 * Contacts tab — top crew rail (avatars), bottom selected crew detail card.
 * Lazy-fetches `getCrewById` per crew for phones / emails / address.
 */
export function CommContactsTab({ pairing, assignments, crewById, positionsById }: Props) {
  const selectedCrewId = useCrewCheckInStore((s) => s.selectedCommCrewId)
  const setSelectedCrewId = useCrewCheckInStore((s) => s.setSelectedCommCrewId)

  // Default to first crew when none selected.
  useEffect(() => {
    if (selectedCrewId) return
    const first = assignments.find((a) => a.status !== 'cancelled')
    if (first) setSelectedCrewId(first.crewId)
  }, [selectedCrewId, assignments, setSelectedCrewId])

  // Cache full profile by crewId (keyed in component lifecycle — fine for the panel scope).
  const [profileCache, setProfileCache] = useState<Record<string, FullCrewProfileRef>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCrewId) return
    if (profileCache[selectedCrewId]) return
    let alive = true
    setLoading(true)
    api
      .getCrewById(selectedCrewId)
      .then((doc) => {
        if (alive) setProfileCache((prev) => ({ ...prev, [selectedCrewId]: doc }))
      })
      .catch((err) => console.warn('[crew-checkin] profile fetch failed', err))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedCrewId, profileCache])

  const crewRows = useMemo(
    () =>
      assignments
        .filter((a) => a.status !== 'cancelled')
        .map((a) => {
          const c = crewById.get(a.crewId)
          const seat = positionsById.get(a.seatPositionId)
          return {
            crewId: a.crewId,
            firstName: c?.firstName ?? '',
            lastName: c?.lastName ?? '',
            photoUrl: c?.photoUrl ?? null,
            positionCode: seat?.code ?? '—',
            rankOrder: seat?.rankOrder ?? 99,
          }
        })
        .sort((a, b) => a.rankOrder - b.rankOrder || a.lastName.localeCompare(b.lastName)),
    [assignments, crewById, positionsById],
  )

  const profile = selectedCrewId ? profileCache[selectedCrewId] : null

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Crew rail */}
      <div className="shrink-0 border-b border-hz-border overflow-x-auto">
        <div className="flex items-stretch gap-1 px-2 py-2 w-max">
          {crewRows.map((c) => (
            <CrewChip
              key={c.crewId}
              crew={c}
              selected={c.crewId === selectedCrewId}
              onSelect={() => setSelectedCrewId(c.crewId)}
            />
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-3">
        {!selectedCrewId ? (
          <div className="h-full flex items-center justify-center text-[13px] text-hz-text-tertiary">
            Select a crew member above
          </div>
        ) : !profile ? (
          <div className="h-full flex items-center justify-center text-[13px] text-hz-text-tertiary">
            {loading ? 'Loading profile…' : 'Profile unavailable'}
          </div>
        ) : (
          <CrewDetailCard profile={profile} />
        )}
      </div>
    </div>
  )
}

function CrewChip({
  crew,
  selected,
  onSelect,
}: {
  crew: { crewId: string; firstName: string; lastName: string; photoUrl: string | null; positionCode: string }
  selected: boolean
  onSelect: () => void
}) {
  const initials = ((crew.firstName[0] ?? '') + (crew.lastName[0] ?? '')).toUpperCase() || '??'
  const photoFull = crew.photoUrl ? `${getApiBaseUrl()}${crew.photoUrl}` : null
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-colors min-w-[64px]"
      style={{
        background: selected ? 'rgba(125,125,140,0.18)' : 'transparent',
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: 'rgba(125,125,140,0.22)' }}
      >
        {photoFull ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoFull} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[13px] font-bold" style={{ color: 'var(--hz-text, #1C1C28)' }}>
            {initials}
          </span>
        )}
      </div>
      <span
        className="text-[13px] font-bold uppercase tracking-wider"
        style={{ color: selected ? 'var(--hz-text, #1C1C28)' : undefined }}
      >
        {crew.positionCode}
      </span>
      <span className="text-[13px] text-hz-text-tertiary truncate max-w-[80px]">{crew.lastName}</span>
    </button>
  )
}

function CrewDetailCard({ profile }: { profile: FullCrewProfileRef }) {
  const operator = useOperatorStore((s) => s.operator)
  const dateFormat = (operator?.dateFormat as DateFormatType | undefined) ?? 'DD/MM/YYYY'

  const m = profile.member
  const fullName = [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ')
  const initials = ((m.firstName[0] ?? '') + (m.lastName[0] ?? '')).toUpperCase() || '??'
  const photoFull = m.photoUrl ? `${getApiBaseUrl()}${m.photoUrl}` : null

  const phones = profile.phones.slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  const primaryPhone = phones[0]
  const address = [m.addressLine1, m.addressLine2, m.addressCity, m.addressState, m.addressZip, m.addressCountry]
    .filter(Boolean)
    .join(', ')

  const countriesMap = useCountriesMap()
  const dob = m.dateOfBirth ? formatDate(m.dateOfBirth, dateFormat) : null
  const nationality = resolveNationality(m.nationality, countriesMap)
  const gender = m.gender ? capitalize(m.gender) : null

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="rounded-xl border border-hz-border p-3 flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shrink-0"
          style={{ background: 'rgba(125,125,140,0.22)' }}
        >
          {photoFull ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoFull} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[18px] font-bold" style={{ color: 'var(--hz-text, #1C1C28)' }}>
              {initials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate">{fullName || '—'}</div>
          <div className="text-[13px] text-hz-text-tertiary font-mono">
            {m.employeeId}
            {profile.baseLabel ? ` · ${profile.baseLabel}` : ''}
          </div>
        </div>
      </div>

      {/* Quick actions — Call / SMS copy phone number to clipboard since
          no telephony provider is wired. Email stays mailto: (zero infra). */}
      <div className="grid grid-cols-3 gap-2">
        <CopyButton value={primaryPhone?.number ?? null} icon={<Phone size={14} />} label="Call" />
        <CopyButton
          value={primaryPhone?.smsEnabled ? primaryPhone.number : null}
          icon={<MessageCircle size={14} />}
          label="SMS"
        />
        <ActionLink
          href={m.emailPrimary ? `mailto:${m.emailPrimary}` : undefined}
          icon={<Mail size={14} />}
          label="Email"
        />
      </div>

      {/* Phones */}
      <Section icon={<Phone size={13} />} title="Phones" empty={phones.length === 0 && 'No phone numbers on file'}>
        {phones.map((p) => (
          <KV
            key={p._id}
            label={p.type || `Priority ${p.priority}`}
            value={
              <span className="flex items-center gap-2 font-mono">
                <a href={`tel:${p.number}`} className="hover:underline" style={{ color: 'var(--hz-text, #1C1C28)' }}>
                  {p.number}
                </a>
                {p.smsEnabled && (
                  <span
                    className="inline-flex items-center px-1.5 h-5 rounded text-[13px] font-semibold"
                    style={{ background: 'rgba(6,194,112,0.14)', color: '#06C270' }}
                  >
                    SMS
                  </span>
                )}
              </span>
            }
          />
        ))}
      </Section>

      {/* Emails */}
      <Section
        icon={<Mail size={13} />}
        title="Emails"
        empty={!m.emailPrimary && !m.emailSecondary && 'No emails on file'}
      >
        {m.emailPrimary && (
          <KV
            label="Primary"
            value={
              <a
                href={`mailto:${m.emailPrimary}`}
                className="hover:underline"
                style={{ color: 'var(--hz-text, #1C1C28)' }}
              >
                {m.emailPrimary}
              </a>
            }
          />
        )}
        {m.emailSecondary && (
          <KV
            label="Secondary"
            value={
              <a
                href={`mailto:${m.emailSecondary}`}
                className="hover:underline"
                style={{ color: 'var(--hz-text, #1C1C28)' }}
              >
                {m.emailSecondary}
              </a>
            }
          />
        )}
      </Section>

      {/* Address */}
      <Section icon={<MapPin size={13} />} title="Address" empty={!address && 'No address on file'}>
        {address && <div className="text-[13px]">{address}</div>}
      </Section>

      {/* Profile */}
      <Section icon={<UserIcon size={13} />} title="Profile">
        {nationality && (
          <KV
            label="Nationality"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Globe size={12} className="text-hz-text-tertiary" />
                {nationality}
              </span>
            }
          />
        )}
        {gender && <KV label="Gender" value={gender} />}
        {dob && <KV label="Date of Birth" value={dob} />}
        {m.contractType && <KV label="Contract" value={capitalize(m.contractType)} />}
      </Section>

      {/* Emergency contact */}
      {(m.emergencyName || m.emergencyPhone) && (
        <Section icon={<Phone size={13} />} title="Emergency Contact">
          {m.emergencyName && <KV label="Name" value={m.emergencyName} />}
          {m.emergencyRelationship && <KV label="Relationship" value={m.emergencyRelationship} />}
          {m.emergencyPhone && (
            <KV
              label="Phone"
              value={
                <a
                  href={`tel:${m.emergencyPhone}`}
                  className="hover:underline font-mono"
                  style={{ color: 'var(--hz-text, #1C1C28)' }}
                >
                  {m.emergencyPhone}
                </a>
              }
            />
          )}
        </Section>
      )}
    </div>
  )
}

function ActionLink({ href, icon, label }: { href?: string; icon: React.ReactNode; label: string }) {
  const disabled = !href
  const className =
    'h-9 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors'
  const style: React.CSSProperties = {
    background: 'rgba(125,125,140,0.18)',
    border: '1px solid rgba(125,125,140,0.25)',
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  }
  return href ? (
    <a href={href} className={className} style={style}>
      {icon}
      {label}
    </a>
  ) : (
    <button type="button" disabled className={className} style={style}>
      {icon}
      {label}
    </button>
  )
}

/** Copy-to-clipboard action button — used for Call/SMS where there's no
 *  telephony provider wired. Crew controller pastes the number into their
 *  preferred dialer/SMS app. */
function CopyButton({ value, icon, label }: { value: string | null; icon: React.ReactNode; label: string }) {
  const [copied, setCopied] = useState(false)
  const disabled = !value
  const className =
    'h-9 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors'
  const style: React.CSSProperties = copied
    ? {
        background: '#06C270',
        color: '#fff',
        border: 'none',
        opacity: 1,
      }
    : {
        background: 'rgba(125,125,140,0.18)',
        border: '1px solid rgba(125,125,140,0.25)',
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }
  const onClick = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.warn('[crew-checkin] clipboard write failed', err)
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
      title={value ?? undefined}
    >
      {copied ? <Check size={14} /> : icon}
      {copied ? 'Copied' : label}
    </button>
  )
}

function Section({
  icon,
  title,
  empty,
  children,
}: {
  icon: React.ReactNode
  title: string
  empty?: string | false
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-hz-border p-3">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">
        <span className="inline-flex items-center">{icon}</span>
        {title}
      </div>
      {empty ? (
        <div className="text-[13px] text-hz-text-tertiary">{empty}</div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  )
}

function capitalize(s: string): string {
  if (!s) return s
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-[13px]">
      <span className="text-hz-text-tertiary uppercase tracking-wider font-semibold w-24 shrink-0">{label}</span>
      <span className="flex-1 min-w-0">{value}</span>
    </div>
  )
}
