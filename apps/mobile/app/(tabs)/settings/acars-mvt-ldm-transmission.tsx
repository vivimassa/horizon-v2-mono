import { useCallback, useEffect, useMemo, useState } from 'react'
import { Text as RNText, View, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  api,
  type MessageActionCode,
  type OperatorMessagingConfig,
  type OperatorMessagingConfigUpsert,
} from '@skyhub/api'
import {
  ChevronLeft,
  Radio,
  Clock,
  Shield,
  GitMerge,
  Key,
  Save,
  Check,
  X,
  RotateCcw,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react-native'
import { Switch as UiSwitch } from '@skyhub/ui'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorStore } from '../../../src/stores/use-operator-store'
import { useHubBack } from '../../../lib/use-hub-back'
import { TransmissionConfigHero } from '../../../components/admin/transmission-config-hero'

// 7.1.5.2 ACARS/MVT/LDM Transmission — mobile port of
// apps/web/src/components/admin/transmission-config/transmission-config-shell.tsx.
// Preserves the 4 SVG heroes (see components/admin/transmission-config-hero.tsx)
// and the full form schema — scheduler, validation, overwrite, inbound token.

const SECTIONS = [
  { key: 'scheduler', label: 'Scheduler', icon: Clock },
  { key: 'validation', label: 'Validation', icon: Shield },
  { key: 'overwrite', label: 'Source Priority', icon: GitMerge },
  { key: 'inbound', label: 'Inbound Access', icon: Key },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

const ACTION_CATALOG: Array<{ key: MessageActionCode; label: string }> = [
  { key: 'AD', label: 'AD — Actual Departure' },
  { key: 'AA', label: 'AA — Actual Arrival' },
  { key: 'ED', label: 'ED — Estimated Departure' },
  { key: 'EA', label: 'EA — Estimated Arrival' },
  { key: 'NI', label: 'NI — Next Information' },
  { key: 'RR', label: 'RR — Return to Ramp' },
  { key: 'FR', label: 'FR — Forced Return' },
]

interface Draft {
  autoTransmit: {
    enabled: boolean
    intervalMin: number
    ageGateMin: number
    actionAllow: MessageActionCode[]
    respectFilter: boolean
  }
  validation: {
    rejectFutureTs: boolean
    futureTsToleranceMin: number
    rejectExcessiveDelay: boolean
    delayThresholdHours: number
    enforceSequence: boolean
    touchAndGoGuardSec: number
    blockTimeDiscrepancyPct: number
    matchByReg: boolean
  }
  overwrite: {
    acarsOverwriteManual: boolean
    acarsOverwriteMvt: boolean
    mvtOverwriteManual: boolean
  }
}

const DEFAULT_DRAFT: Draft = {
  autoTransmit: {
    enabled: false,
    intervalMin: 5,
    ageGateMin: 1,
    actionAllow: ['AD', 'AA'],
    respectFilter: true,
  },
  validation: {
    rejectFutureTs: true,
    futureTsToleranceMin: 5,
    rejectExcessiveDelay: true,
    delayThresholdHours: 8,
    enforceSequence: true,
    touchAndGoGuardSec: 120,
    blockTimeDiscrepancyPct: 30,
    matchByReg: false,
  },
  overwrite: {
    acarsOverwriteManual: false,
    acarsOverwriteMvt: false,
    mvtOverwriteManual: true,
  },
}

function configToDraft(cfg: OperatorMessagingConfig | null): Draft {
  if (!cfg) return DEFAULT_DRAFT
  return {
    autoTransmit: { ...DEFAULT_DRAFT.autoTransmit, ...(cfg.autoTransmit ?? {}) },
    validation: { ...DEFAULT_DRAFT.validation, ...(cfg.validation ?? {}) },
    overwrite: { ...DEFAULT_DRAFT.overwrite, ...(cfg.overwrite ?? {}) },
  }
}

function draftToUpsert(operatorId: string, d: Draft): OperatorMessagingConfigUpsert {
  return { operatorId, autoTransmit: d.autoTransmit, validation: d.validation, overwrite: d.overwrite }
}

export default function AcarsMvtLdmTransmissionScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  useHubBack('sysadmin')

  const operator = useOperatorStore((s) => s.operator)

  const [activeSection, setActiveSection] = useState<SectionKey>('scheduler')
  const [config, setConfig] = useState<OperatorMessagingConfig | null>(null)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorMessagingConfig(operator._id)
      .then((doc) => {
        if (!alive) return
        setConfig(doc)
        setDraft(configToDraft(doc))
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load config'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [operator?._id])

  const hasDraft = useMemo(() => JSON.stringify(draft) !== JSON.stringify(configToDraft(config)), [draft, config])

  const handleSave = useCallback(async () => {
    if (!operator?._id || !hasDraft) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await api.upsertOperatorMessagingConfig(draftToUpsert(operator._id, draft))
      setConfig(updated)
      setDraft(configToDraft(updated))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [operator?._id, hasDraft, draft])

  if (!operator?._id) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={accent} />
          <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 8 }}>Loading operator…</RNText>
        </View>
      </SafeAreaView>
    )
  }

  const showSave = activeSection !== 'inbound'

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View
        className="px-4 pt-2 pb-3 flex-row items-center"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <Radio size={18} color={accent} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <RNText style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>ACARS / MVT / LDM</RNText>
          <RNText style={{ fontSize: 13, color: palette.textSecondary }}>7.1.5.2 · Integration</RNText>
        </View>
        {showSave && hasDraft ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-60"
            style={{ backgroundColor: saved ? '#16a34a' : accent, gap: 4 }}
          >
            {saved ? (
              <Check size={14} color="#fff" strokeWidth={2.5} />
            ) : (
              <Save size={14} color="#fff" strokeWidth={1.8} />
            )}
            <RNText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </RNText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border, flexGrow: 0 }}
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.key
          return (
            <Pressable
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{
                backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                gap: 6,
              }}
            >
              <Icon size={14} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <RNText
                style={{
                  fontSize: 13,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.textSecondary,
                }}
              >
                {section.label}
              </RNText>
            </Pressable>
          )
        })}
      </ScrollView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator color={accent} />
          </View>
        ) : (
          <>
            {error ? (
              <View
                className="flex-row items-center rounded-xl px-3 py-2.5 mb-3"
                style={{
                  backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(239,68,68,0.28)' : '#fecaca',
                  gap: 8,
                }}
              >
                <AlertTriangle size={14} color="#EF4444" strokeWidth={2} />
                <RNText style={{ flex: 1, fontSize: 13, color: '#EF4444' }}>{error}</RNText>
                <Pressable onPress={() => setError(null)} hitSlop={8}>
                  <RNText style={{ fontSize: 13, color: palette.textTertiary }}>Dismiss</RNText>
                </Pressable>
              </View>
            ) : null}

            {activeSection === 'scheduler' && (
              <>
                <TransmissionConfigHero
                  accent={accent}
                  isDark={isDark}
                  illustration="scheduler"
                  eyebrow="Outbound automation"
                  title="Tell the scheduler when to fire"
                  caption="Interval, review window and allowlist govern every background sweep."
                />
                <SchedulerBody
                  draft={draft}
                  setDraft={setDraft}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                  onReset={() => setDraft((d) => ({ ...d, autoTransmit: DEFAULT_DRAFT.autoTransmit }))}
                />
              </>
            )}

            {activeSection === 'validation' && (
              <>
                <TransmissionConfigHero
                  accent={accent}
                  isDark={isDark}
                  illustration="validation"
                  eyebrow="Inbound quality gate"
                  title="Reject bad messages before they touch ops"
                  caption="Future timestamps, out-of-order events, and duplicate echos never land."
                />
                <ValidationBody
                  draft={draft}
                  setDraft={setDraft}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                  onReset={() => setDraft((d) => ({ ...d, validation: DEFAULT_DRAFT.validation }))}
                />
              </>
            )}

            {activeSection === 'overwrite' && (
              <>
                <TransmissionConfigHero
                  accent={accent}
                  isDark={isDark}
                  illustration="overwrite"
                  eyebrow="Source priority"
                  title="Decide who wins a collision"
                  caption="Manual always beats automation by default. Bend the rules per source."
                />
                <OverwriteBody
                  draft={draft}
                  setDraft={setDraft}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                  onReset={() => setDraft((d) => ({ ...d, overwrite: DEFAULT_DRAFT.overwrite }))}
                />
              </>
            )}

            {activeSection === 'inbound' && (
              <>
                <TransmissionConfigHero
                  accent={accent}
                  isDark={isDark}
                  illustration="inbound"
                  eyebrow="External ingestion"
                  title="Open the port, keep the key"
                  caption="Rotate the bearer token any time — old value stops working on the next call."
                />
                <InboundBody palette={palette} isDark={isDark} accent={accent} onError={setError} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/* ───────────── Scheduler body ───────────── */

function SchedulerBody({
  draft,
  setDraft,
  palette,
  isDark,
  accent,
  onReset,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  palette: PaletteType
  isDark: boolean
  accent: string
  onReset: () => void
}) {
  const patch = (p: Partial<Draft['autoTransmit']>) =>
    setDraft((prev) => ({ ...prev, autoTransmit: { ...prev.autoTransmit, ...p } }))

  const toggle = (k: MessageActionCode) =>
    patch({
      actionAllow: draft.autoTransmit.actionAllow.includes(k)
        ? draft.autoTransmit.actionAllow.filter((x) => x !== k)
        : [...draft.autoTransmit.actionAllow, k],
    })

  return (
    <View style={{ gap: 14 }}>
      <SectionCard
        title="Auto-transmit scheduler"
        subtitle="Sweeps held MVT/LDM messages periodically"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <FormRow label="Enabled" hint="Arms the background scheduler for this operator." palette={palette}>
          <Switch
            value={draft.autoTransmit.enabled}
            onChange={(v) => patch({ enabled: v })}
            accent="#E63535"
            isDark={isDark}
          />
        </FormRow>
        <FormRow label="Interval" hint="Time between transmission sweeps (2–15 min)." palette={palette} stacked>
          <Stepper
            value={draft.autoTransmit.intervalMin}
            onChange={(v) => patch({ intervalMin: v })}
            min={2}
            max={15}
            suffix="m"
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Review window"
          hint="Messages must have been held at least this long before the scheduler may transmit them."
          palette={palette}
          stacked
        >
          <Stepper
            value={draft.autoTransmit.ageGateMin}
            onChange={(v) => patch({ ageGateMin: v })}
            min={0}
            max={10}
            suffix="m"
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Respect active filter"
          hint="Only transmit messages matching the Communication Deck's current filter."
          palette={palette}
        >
          <Switch
            value={draft.autoTransmit.respectFilter}
            onChange={(v) => patch({ respectFilter: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
      </SectionCard>

      <SectionCard
        title="Action code allowlist"
        subtitle="Only these codes auto-transmit. Everything else waits."
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <View style={{ gap: 8 }}>
          {ACTION_CATALOG.map((a) => {
            const active = draft.autoTransmit.actionAllow.includes(a.key)
            return (
              <Pressable
                key={a.key}
                onPress={() => toggle(a.key)}
                className="flex-row items-center rounded-lg active:opacity-70"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 10,
                  backgroundColor: active
                    ? 'rgba(6,194,112,0.12)'
                    : isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(96,97,112,0.06)',
                  borderWidth: 1,
                  borderColor: active ? 'rgba(6,194,112,0.32)' : 'transparent',
                }}
              >
                {active ? (
                  <CheckCircle size={14} color="#06C270" strokeWidth={2} />
                ) : (
                  <XCircle size={14} color={palette.textSecondary} strokeWidth={2} />
                )}
                <RNText style={{ flex: 1, fontSize: 14, fontWeight: '500', color: palette.text }}>{a.label}</RNText>
              </Pressable>
            )
          })}
        </View>
      </SectionCard>

      <ResetRow onPress={onReset} palette={palette} />
    </View>
  )
}

/* ───────────── Validation body ───────────── */

function ValidationBody({
  draft,
  setDraft,
  palette,
  isDark,
  accent,
  onReset,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  palette: PaletteType
  isDark: boolean
  accent: string
  onReset: () => void
}) {
  const patch = (p: Partial<Draft['validation']>) =>
    setDraft((prev) => ({ ...prev, validation: { ...prev.validation, ...p } }))

  return (
    <View style={{ gap: 14 }}>
      <SectionCard
        title="Input rejection rules"
        subtitle="Bounce malformed or impossible telex"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <FormRow
          label="Reject future-timestamped messages"
          hint="Bounce messages whose action timestamp is beyond the tolerance."
          palette={palette}
        >
          <Switch
            value={draft.validation.rejectFutureTs}
            onChange={(v) => patch({ rejectFutureTs: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        {draft.validation.rejectFutureTs ? (
          <FormRow label="Future tolerance" hint="Clock drift allowance." palette={palette} stacked>
            <Stepper
              value={draft.validation.futureTsToleranceMin}
              onChange={(v) => patch({ futureTsToleranceMin: v })}
              min={0}
              max={60}
              suffix="m"
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
          </FormRow>
        ) : null}
        <FormRow
          label="Reject excessive delay"
          hint="Reject messages whose ATD−STD or ATA−STA exceeds the threshold."
          palette={palette}
        >
          <Switch
            value={draft.validation.rejectExcessiveDelay}
            onChange={(v) => patch({ rejectExcessiveDelay: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        {draft.validation.rejectExcessiveDelay ? (
          <FormRow label="Delay threshold" hint="Beyond this, reject the message." palette={palette} stacked>
            <Stepper
              value={draft.validation.delayThresholdHours}
              onChange={(v) => patch({ delayThresholdHours: v })}
              min={1}
              max={48}
              suffix="h"
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
          </FormRow>
        ) : null}
        <FormRow
          label="Enforce event sequence"
          hint="Reject AA before AD, IN before ON, etc. Prevents out-of-order corruption."
          palette={palette}
        >
          <Switch
            value={draft.validation.enforceSequence}
            onChange={(v) => patch({ enforceSequence: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
      </SectionCard>

      <SectionCard
        title="Matching & deduplication"
        subtitle="How messages attach to flights and suppress echo"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <FormRow
          label="Touch-and-go guard"
          hint="Ignore duplicate AD/AA updates within this window (seconds)."
          palette={palette}
          stacked
        >
          <Stepper
            value={draft.validation.touchAndGoGuardSec}
            onChange={(v) => patch({ touchAndGoGuardSec: v })}
            min={0}
            max={600}
            step={30}
            suffix="s"
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Block-time discrepancy"
          hint="Reject if derived block time differs from scheduled by more than this percentage."
          palette={palette}
          stacked
        >
          <Stepper
            value={draft.validation.blockTimeDiscrepancyPct}
            onChange={(v) => patch({ blockTimeDiscrepancyPct: v })}
            min={5}
            max={100}
            step={5}
            suffix="%"
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Match by aircraft registration"
          hint="When on, incoming messages match flights by ARCID instead of flight + date."
          palette={palette}
        >
          <Switch
            value={draft.validation.matchByReg}
            onChange={(v) => patch({ matchByReg: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
      </SectionCard>

      <ResetRow onPress={onReset} palette={palette} />
    </View>
  )
}

/* ───────────── Overwrite body ───────────── */

function OverwriteBody({
  draft,
  setDraft,
  palette,
  isDark,
  accent,
  onReset,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  palette: PaletteType
  isDark: boolean
  accent: string
  onReset: () => void
}) {
  const patch = (p: Partial<Draft['overwrite']>) =>
    setDraft((prev) => ({ ...prev, overwrite: { ...prev.overwrite, ...p } }))

  return (
    <View style={{ gap: 14 }}>
      <SectionCard
        title="Source collisions"
        subtitle="Which source wins when multiple updates land on the same field"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <FormRow
          label="ACARS may overwrite manual edits"
          hint="When off, ACARS updates are ignored for fields already touched in the UI."
          palette={palette}
        >
          <Switch
            value={draft.overwrite.acarsOverwriteManual}
            onChange={(v) => patch({ acarsOverwriteManual: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="ACARS may overwrite MVT"
          hint="When off, incoming MVT messages take precedence over ACARS OOOI updates."
          palette={palette}
        >
          <Switch
            value={draft.overwrite.acarsOverwriteMvt}
            onChange={(v) => patch({ acarsOverwriteMvt: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="MVT may overwrite manual edits"
          hint="When on, a human-transmitted MVT may correct a previous manual entry."
          palette={palette}
        >
          <Switch
            value={draft.overwrite.mvtOverwriteManual}
            onChange={(v) => patch({ mvtOverwriteManual: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
      </SectionCard>
      <ResetRow onPress={onReset} palette={palette} />
    </View>
  )
}

/* ───────────── Inbound Access body ───────────── */

function InboundBody({
  palette,
  isDark,
  accent,
  onError,
}: {
  palette: PaletteType
  isDark: boolean
  accent: string
  onError: (m: string | null) => void
}) {
  const [tokenInfo, setTokenInfo] = useState<{
    exists: boolean
    masked: string | null
    rotatedAt: string | null
  } | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .getInboundMessageToken()
      .then(setTokenInfo)
      .catch(() => setTokenInfo(null))
      .finally(() => setLoading(false))
  }, [])

  const rotate = useCallback(() => {
    Alert.alert(
      tokenInfo?.exists ? 'Rotate token?' : 'Generate token?',
      'The previous value (if any) stops working immediately. The new token is shown only once — copy it before leaving the page.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            setRotating(true)
            try {
              const res = await api.rotateInboundMessageToken()
              setFreshToken(res.token)
              setTokenInfo({ exists: true, masked: res.masked, rotatedAt: res.rotatedAt })
            } catch (e) {
              onError(e instanceof Error ? e.message : 'Rotation failed')
            } finally {
              setRotating(false)
            }
          },
        },
      ],
    )
  }, [tokenInfo?.exists, onError])

  if (loading) return <ActivityIndicator color={accent} style={{ paddingVertical: 24 }} />

  const display = freshToken ?? tokenInfo?.masked ?? 'Not yet generated'
  const rotatedLabel = tokenInfo?.rotatedAt
    ? `Last rotated ${new Date(tokenInfo.rotatedAt).toLocaleString()}.`
    : 'No token generated yet. Rotate to create one.'

  const codeBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.08)'
  const codeBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <View style={{ gap: 14 }}>
      <SectionCard
        title="Inbound token"
        subtitle="Bearer credential for external telex ingestion"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <View
          className="rounded-lg"
          style={{
            backgroundColor: codeBg,
            borderWidth: 1,
            borderColor: codeBorder,
            padding: 12,
          }}
        >
          <RNText
            selectable
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              color: freshToken ? '#06C270' : palette.text,
              lineHeight: 18,
            }}
          >
            {display}
          </RNText>
        </View>
        <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 6 }}>
          {freshToken
            ? 'New token shown above — long-press to copy. This value will not be shown again.'
            : rotatedLabel}
        </RNText>

        <View className="flex-row" style={{ marginTop: 10, gap: 8 }}>
          <Pressable
            onPress={rotate}
            disabled={rotating}
            className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
            style={{
              backgroundColor: 'rgba(230,53,53,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(230,53,53,0.3)',
              gap: 6,
              opacity: rotating ? 0.5 : 1,
            }}
          >
            <RefreshCw size={13} color="#E63535" strokeWidth={2} />
            <RNText style={{ fontSize: 13, fontWeight: '600', color: '#E63535' }}>
              {rotating ? 'Rotating…' : tokenInfo?.exists ? 'Rotate token' : 'Generate token'}
            </RNText>
          </Pressable>
        </View>
      </SectionCard>

      <SectionCard
        title="Example — POST a raw telex"
        subtitle="Include the bearer token in the Authorization header"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <View
          className="rounded-lg"
          style={{
            backgroundColor: codeBg,
            borderWidth: 1,
            borderColor: codeBorder,
            padding: 12,
          }}
        >
          <RNText
            selectable
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 18,
              color: isDark ? '#C0C0D0' : '#1C1C28',
            }}
          >
            {`curl -X POST https://<host>/movement-messages/inbound \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"rawMessage":"MVT\\nHZ111/15.HAN\\nAA0305/0320"}'`}
          </RNText>
        </View>
      </SectionCard>
    </View>
  )
}

/* ───────────── Shared primitives ───────────── */

function SectionCard({
  title,
  subtitle,
  children,
  palette,
  accent,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <View
      className="rounded-xl"
      style={{
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        padding: 14,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8, marginBottom: 4 }}>
        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: accent }} />
        <RNText style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{title}</RNText>
      </View>
      {subtitle ? (
        <RNText style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 10, marginLeft: 11 }}>
          {subtitle}
        </RNText>
      ) : (
        <View style={{ height: 4 }} />
      )}
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  )
}

function FormRow({
  label,
  hint,
  children,
  palette,
  stacked,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  palette: PaletteType
  stacked?: boolean
}) {
  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center', gap: 10 }}>
      <View className="flex-1">
        <RNText style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{label}</RNText>
        {hint ? (
          <RNText style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2, lineHeight: 17 }}>{hint}</RNText>
        ) : null}
      </View>
      <View>{children}</View>
    </View>
  )
}

function Switch({
  value,
  onChange,
  accent,
  isDark,
}: {
  value: boolean
  onChange: (v: boolean) => void
  accent: string
  isDark: boolean
}) {
  // Local wrapper kept so call sites compile unchanged. Accent/isDark are
  // ignored — global Switch is iOS green per the design system.
  void accent
  void isDark
  return <UiSwitch value={value} onValueChange={onChange} />
}

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  accent,
  palette,
  isDark,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  accent: string
  palette: PaletteType
  isDark: boolean
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  return (
    <View
      className="flex-row items-center rounded-lg overflow-hidden"
      style={{ borderWidth: 1, borderColor: palette.cardBorder }}
    >
      <Pressable
        onPress={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="items-center justify-center"
        style={{
          width: 36,
          height: 36,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          opacity: value <= min ? 0.4 : 1,
        }}
      >
        <RNText style={{ fontSize: 18, fontWeight: '600', color: palette.textSecondary }}>−</RNText>
      </Pressable>
      <View className="items-center justify-center" style={{ minWidth: 64, height: 36 }}>
        <RNText style={{ fontSize: 14, fontWeight: '600', color: accent, fontFamily: 'monospace' }}>
          {value}
          {suffix}
        </RNText>
      </View>
      <Pressable
        onPress={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="items-center justify-center"
        style={{
          width: 36,
          height: 36,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          opacity: value >= max ? 0.4 : 1,
        }}
      >
        <RNText style={{ fontSize: 18, fontWeight: '600', color: palette.textSecondary }}>+</RNText>
      </Pressable>
    </View>
  )
}

function ResetRow({ onPress, palette }: { onPress: () => void; palette: PaletteType }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center self-start px-3 py-2 rounded-lg active:opacity-70"
      style={{ gap: 6 }}
    >
      <RotateCcw size={13} color={palette.textTertiary} strokeWidth={1.8} />
      <RNText style={{ fontSize: 13, fontWeight: '500', color: palette.textTertiary }}>Reset section</RNText>
    </Pressable>
  )
}

// Keep `X` import alive — may be used by future dismiss UI on this screen.
void X
