import { useCallback, useEffect, useMemo, useState } from 'react'
import { Text as RNText, View, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  api,
  type AsmSsmActionCode,
  type AsmSsmConfigUpsert,
  type AsmSsmConsumerRef,
  type OperatorMessagingConfig,
  type ScheduleMessageRef,
} from '@skyhub/api'
import {
  ChevronLeft,
  MessageSquare,
  Clock,
  Users,
  PauseCircle,
  ClipboardList,
  Save,
  Check,
  X,
  RotateCcw,
  Mail,
  Server,
  Globe,
  AlertTriangle,
} from 'lucide-react-native'
import { Switch as UiSwitch } from '@skyhub/ui'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorStore } from '../../../src/stores/use-operator-store'
import { useHubBack } from '../../../lib/use-hub-back'
import { AsmSsmHero } from '../../../components/admin/asm-ssm-hero'

// 7.1.5.1 ASM/SSM Transmission — mobile port.
// Preserves the 4 inline-SVG heroes from the web (section-heroes.tsx) by
// rendering each via react-native-svg in components/admin/asm-ssm-hero.tsx.
// Full CRUD for consumers stays web-only for now; mobile is
// read-only + Release/Discard + Generation form (which is the tab that
// actually benefits from the save-on-the-fly mobile shape).

const SECTIONS = [
  { key: 'generation', label: 'Generation', icon: Clock },
  { key: 'consumers', label: 'Consumers', icon: Users },
  { key: 'held', label: 'Held Queue', icon: PauseCircle },
  { key: 'log', label: 'Delivery Log', icon: ClipboardList },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

const TYPE_CATALOG: Array<{ key: AsmSsmActionCode; meaning: string }> = [
  { key: 'NEW', meaning: 'New flight — add to schedule' },
  { key: 'CNL', meaning: 'Cancellation — remove a scheduled flight' },
  { key: 'TIM', meaning: 'Time change — adjust STD / STA' },
  { key: 'EQT', meaning: 'Equipment change — swap aircraft type' },
  { key: 'RRT', meaning: 'Re-route — change dep / arr station' },
  { key: 'RIN', meaning: 'Reinstatement — restore a cancelled flight' },
]

interface GenerationDraft {
  generation: {
    asmEnabled: boolean
    ssmEnabled: boolean
    triggerOnCommit: boolean
    triggerOnPlaygroundCommit: boolean
    messageTypeAllow: AsmSsmActionCode[]
    priority: 'high' | 'medium' | 'low'
  }
  autoRelease: {
    enabled: boolean
    intervalMin: number
    ageGateMin: number
    actionAllow: AsmSsmActionCode[]
  }
}

const DEFAULT_DRAFT: GenerationDraft = {
  generation: {
    asmEnabled: true,
    ssmEnabled: true,
    triggerOnCommit: true,
    triggerOnPlaygroundCommit: false,
    messageTypeAllow: ['NEW', 'CNL', 'TIM', 'EQT', 'RRT'],
    priority: 'high',
  },
  autoRelease: {
    enabled: false,
    intervalMin: 5,
    ageGateMin: 2,
    actionAllow: ['TIM'],
  },
}

function configToDraft(cfg: OperatorMessagingConfig | null): GenerationDraft {
  if (!cfg?.asmSsm) return DEFAULT_DRAFT
  return {
    generation: { ...DEFAULT_DRAFT.generation, ...(cfg.asmSsm.generation ?? {}) },
    autoRelease: { ...DEFAULT_DRAFT.autoRelease, ...(cfg.asmSsm.autoRelease ?? {}) },
  }
}

export default function AsmSsmTransmissionScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  useHubBack('sysadmin')

  const operator = useOperatorStore((s) => s.operator)

  const [activeSection, setActiveSection] = useState<SectionKey>('generation')
  const [config, setConfig] = useState<OperatorMessagingConfig | null>(null)
  const [draft, setDraft] = useState<GenerationDraft>(DEFAULT_DRAFT)
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
      const payload: AsmSsmConfigUpsert = {
        generation: draft.generation,
        autoRelease: draft.autoRelease,
      }
      const updated = await api.upsertOperatorMessagingConfig({
        operatorId: operator._id,
        asmSsm: payload,
      })
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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
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
          <MessageSquare size={18} color={accent} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <RNText style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>ASM / SSM Transmission</RNText>
          <RNText style={{ fontSize: 13, color: palette.textSecondary }}>7.1.5.1 · Integration</RNText>
        </View>
        {activeSection === 'generation' && hasDraft ? (
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

      {/* Section tabs */}
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

      {/* Body */}
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

            {activeSection === 'generation' && (
              <>
                <AsmSsmHero
                  accent={accent}
                  isDark={isDark}
                  illustration="generation"
                  eyebrow="Message emission"
                  title="Control what fires and when"
                  caption="Generation rules and the auto-release scheduler steer every outbound ASM / SSM."
                />
                <GenerationBody
                  draft={draft}
                  setDraft={setDraft}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                  onReset={() => setDraft(DEFAULT_DRAFT)}
                />
              </>
            )}

            {activeSection === 'consumers' && (
              <>
                <AsmSsmHero
                  accent={accent}
                  isDark={isDark}
                  illustration="consumers"
                  eyebrow="Delivery directory"
                  title="One outbox, three delivery modes"
                  caption="Pull API for modern GDS, SFTP for legacy drops, SMTP for email-driven vendors."
                />
                <ConsumersBody operatorId={operator._id} palette={palette} isDark={isDark} accent={accent} />
              </>
            )}

            {activeSection === 'held' && (
              <>
                <AsmSsmHero
                  accent={accent}
                  isDark={isDark}
                  illustration="held"
                  eyebrow="Pre-send review"
                  title="Release what's right. Discard what isn't."
                  caption="Neutralized NEW + CNL pairs auto-drop. Everything else waits for approval."
                />
                <HeldBody
                  operatorId={operator._id}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                  onError={setError}
                />
              </>
            )}

            {activeSection === 'log' && (
              <>
                <AsmSsmHero
                  accent={accent}
                  isDark={isDark}
                  illustration="log"
                  eyebrow="Audit trail"
                  title="Who got what, when, and how"
                  caption="Per-consumer delivery outcomes with retry attempts and exportable history."
                />
                <LogBody
                  operatorId={operator._id}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                  onError={setError}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/* ───────────── Generation tab body ───────────── */

function GenerationBody({
  draft,
  setDraft,
  palette,
  isDark,
  accent,
  onReset,
}: {
  draft: GenerationDraft
  setDraft: React.Dispatch<React.SetStateAction<GenerationDraft>>
  palette: PaletteType
  isDark: boolean
  accent: string
  onReset: () => void
}) {
  const patchGen = (p: Partial<GenerationDraft['generation']>) =>
    setDraft((prev) => ({ ...prev, generation: { ...prev.generation, ...p } }))
  const patchAuto = (p: Partial<GenerationDraft['autoRelease']>) =>
    setDraft((prev) => ({ ...prev, autoRelease: { ...prev.autoRelease, ...p } }))

  const toggleMsgType = (k: AsmSsmActionCode) =>
    patchGen({
      messageTypeAllow: draft.generation.messageTypeAllow.includes(k)
        ? draft.generation.messageTypeAllow.filter((x) => x !== k)
        : [...draft.generation.messageTypeAllow, k],
    })
  const toggleReleaseAction = (k: AsmSsmActionCode) =>
    patchAuto({
      actionAllow: draft.autoRelease.actionAllow.includes(k)
        ? draft.autoRelease.actionAllow.filter((x) => x !== k)
        : [...draft.autoRelease.actionAllow, k],
    })

  return (
    <View style={{ gap: 14 }}>
      <SectionCard
        title="Generation rules"
        subtitle="What the diff engine may emit"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <FormRow
          label="Generate ASM"
          hint="Ad-hoc schedule messages — specific-date, flight-level changes."
          palette={palette}
        >
          <Switch
            value={draft.generation.asmEnabled}
            onChange={(v) => patchGen({ asmEnabled: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        <FormRow label="Generate SSM" hint="Standard schedule messages — seasonal pattern changes." palette={palette}>
          <Switch
            value={draft.generation.ssmEnabled}
            onChange={(v) => patchGen({ ssmEnabled: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Trigger on schedule commit"
          hint="Emit messages when a schedule edit is applied to production."
          palette={palette}
        >
          <Switch
            value={draft.generation.triggerOnCommit}
            onChange={(v) => patchGen({ triggerOnCommit: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Trigger on playground commit"
          hint="Also emit when a What-If scenario is committed."
          palette={palette}
        >
          <Switch
            value={draft.generation.triggerOnPlaygroundCommit}
            onChange={(v) => patchGen({ triggerOnPlaygroundCommit: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Priority"
          hint="IATA priority flag carried on every generated message."
          palette={palette}
          stacked
        >
          <Segmented
            value={draft.generation.priority}
            options={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            onChange={(v) => patchGen({ priority: v as 'high' | 'medium' | 'low' })}
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Allowed message types"
          hint="Only these action codes will be generated. Everything else is suppressed."
          palette={palette}
          stacked
        >
          <CodeChips
            options={TYPE_CATALOG}
            selected={draft.generation.messageTypeAllow}
            onToggle={toggleMsgType}
            isDark={isDark}
          />
        </FormRow>
      </SectionCard>

      <SectionCard
        title="Auto-release scheduler"
        subtitle="Hands-off release of held messages"
        palette={palette}
        isDark={isDark}
        accent={accent}
      >
        <FormRow label="Enabled" hint="Arms the background sweep for this operator." palette={palette}>
          <Switch
            value={draft.autoRelease.enabled}
            onChange={(v) => patchAuto({ enabled: v })}
            accent="#E63535"
            isDark={isDark}
          />
        </FormRow>
        <FormRow label="Interval" hint="Time between sweeps (2–30 min)." palette={palette} stacked>
          <Stepper
            value={draft.autoRelease.intervalMin}
            onChange={(v) => patchAuto({ intervalMin: v })}
            min={2}
            max={30}
            suffix="m"
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Review window"
          hint="Messages must have been held at least this long before auto-release."
          palette={palette}
          stacked
        >
          <Stepper
            value={draft.autoRelease.ageGateMin}
            onChange={(v) => patchAuto({ ageGateMin: v })}
            min={0}
            max={60}
            suffix="m"
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        </FormRow>
        <FormRow
          label="Auto-release types"
          hint="Only these codes may auto-release; everything else waits for manual review."
          palette={palette}
          stacked
        >
          <CodeChips
            options={TYPE_CATALOG.filter((t) => draft.generation.messageTypeAllow.includes(t.key))}
            selected={draft.autoRelease.actionAllow}
            onToggle={toggleReleaseAction}
            isDark={isDark}
          />
        </FormRow>
      </SectionCard>

      <Pressable
        onPress={onReset}
        className="flex-row items-center self-start px-3 py-2 rounded-lg active:opacity-70"
        style={{ gap: 6 }}
      >
        <RotateCcw size={13} color={palette.textTertiary} strokeWidth={1.8} />
        <RNText style={{ fontSize: 13, fontWeight: '500', color: palette.textTertiary }}>Reset section</RNText>
      </Pressable>
    </View>
  )
}

/* ───────────── Consumers tab body ───────────── */

function ConsumersBody({
  operatorId,
  palette,
  isDark,
  accent,
}: {
  operatorId: string
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const [consumers, setConsumers] = useState<AsmSsmConsumerRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .getAsmSsmConsumers(operatorId)
      .then((r) => setConsumers(r.consumers))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [operatorId])

  if (loading) {
    return <ActivityIndicator color={accent} style={{ paddingVertical: 24 }} />
  }

  return (
    <View style={{ gap: 10 }}>
      <RNText style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 4 }}>
        {consumers.length} {consumers.length === 1 ? 'consumer' : 'consumers'} · add or edit from the web console
      </RNText>
      {consumers.length === 0 ? (
        <View
          className="rounded-xl items-center py-8"
          style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
        >
          <RNText style={{ fontSize: 13, color: palette.textTertiary }}>No consumers registered yet.</RNText>
        </View>
      ) : (
        consumers.map((c) => <ConsumerRow key={c._id} consumer={c} palette={palette} isDark={isDark} accent={accent} />)
      )}
    </View>
  )
}

function ConsumerRow({
  consumer,
  palette,
  isDark,
  accent,
}: {
  consumer: AsmSsmConsumerRef
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const Icon = consumer.deliveryMode === 'pull_api' ? Globe : consumer.deliveryMode === 'sftp' ? Server : Mail
  const modeLabel = consumer.deliveryMode === 'pull_api' ? 'Pull API' : consumer.deliveryMode.toUpperCase()

  return (
    <View
      className="flex-row items-center rounded-xl"
      style={{
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        padding: 14,
        gap: 12,
      }}
    >
      <View
        className="items-center justify-center rounded-lg"
        style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
      >
        <Icon size={18} color={accent} strokeWidth={1.8} />
      </View>
      <View className="flex-1">
        <RNText style={{ fontSize: 15, fontWeight: '600', color: palette.text }} numberOfLines={1}>
          {consumer.name}
        </RNText>
        <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {modeLabel}
          {consumer.contactEmail ? ` · ${consumer.contactEmail}` : ''}
        </RNText>
      </View>
      <View
        className="rounded-full px-2.5 py-1"
        style={{
          backgroundColor: consumer.active ? 'rgba(6,194,112,0.12)' : 'rgba(128,128,140,0.12)',
        }}
      >
        <RNText
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: consumer.active ? '#06C270' : palette.textSecondary,
          }}
        >
          {consumer.active ? 'Active' : 'Paused'}
        </RNText>
      </View>
    </View>
  )
}

/* ───────────── Held Queue tab body ───────────── */

function HeldBody({
  operatorId,
  palette,
  isDark,
  accent,
  onError,
}: {
  operatorId: string
  palette: PaletteType
  isDark: boolean
  accent: string
  onError: (msg: string | null) => void
}) {
  const [messages, setMessages] = useState<ScheduleMessageRef[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    api
      .getHeldScheduleMessages(operatorId)
      .then((r) => setMessages(r.messages))
      .catch((e) => onError(e instanceof Error ? e.message : 'Failed to load held messages'))
      .finally(() => setLoading(false))
  }, [operatorId, onError])

  useEffect(() => {
    refresh()
  }, [refresh])

  const act = useCallback(
    async (kind: 'release' | 'discard', id: string) => {
      setWorking(id)
      try {
        if (kind === 'release') await api.releaseScheduleMessages([id])
        else await api.discardScheduleMessages([id])
        refresh()
      } catch (e) {
        onError(e instanceof Error ? e.message : `${kind} failed`)
      } finally {
        setWorking(null)
      }
    },
    [refresh, onError],
  )

  const confirmBulk = useCallback(
    (kind: 'release' | 'discard') => {
      const label = kind === 'release' ? 'Release all' : 'Discard all'
      Alert.alert(
        label,
        `${kind === 'release' ? 'Release' : 'Discard'} ${messages.length} held message${messages.length === 1 ? '' : 's'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: label,
            style: kind === 'discard' ? 'destructive' : 'default',
            onPress: async () => {
              const ids = messages.map((m) => m._id)
              setWorking('bulk')
              try {
                if (kind === 'release') await api.releaseScheduleMessages(ids)
                else await api.discardScheduleMessages(ids)
                refresh()
              } catch (e) {
                onError(e instanceof Error ? e.message : 'Bulk action failed')
              } finally {
                setWorking(null)
              }
            },
          },
        ],
      )
    },
    [messages, refresh, onError],
  )

  if (loading) return <ActivityIndicator color={accent} style={{ paddingVertical: 24 }} />

  return (
    <View style={{ gap: 10 }}>
      <View className="flex-row items-center" style={{ gap: 8, marginBottom: 2 }}>
        <RNText style={{ flex: 1, fontSize: 13, color: palette.textSecondary }}>
          {messages.length} held {messages.length === 1 ? 'message' : 'messages'}
        </RNText>
        {messages.length > 0 ? (
          <>
            <Pressable
              onPress={() => confirmBulk('discard')}
              disabled={working !== null}
              className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
              style={{
                borderWidth: 1,
                borderColor: isDark ? 'rgba(230,53,53,0.3)' : '#fecaca',
                gap: 4,
                opacity: working !== null ? 0.5 : 1,
              }}
            >
              <X size={13} color="#E63535" strokeWidth={2} />
              <RNText style={{ fontSize: 13, fontWeight: '600', color: '#E63535' }}>Discard all</RNText>
            </Pressable>
            <Pressable
              onPress={() => confirmBulk('release')}
              disabled={working !== null}
              className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
              style={{ backgroundColor: accent, gap: 4, opacity: working !== null ? 0.5 : 1 }}
            >
              <Check size={13} color="#fff" strokeWidth={2} />
              <RNText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Release all</RNText>
            </Pressable>
          </>
        ) : null}
      </View>

      {messages.length === 0 ? (
        <View
          className="rounded-xl items-center py-8"
          style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
        >
          <RNText style={{ fontSize: 13, color: palette.textTertiary }}>Nothing held right now.</RNText>
        </View>
      ) : (
        messages.map((m) => (
          <MessageRow
            key={m._id}
            message={m}
            busy={working === m._id}
            onRelease={() => act('release', m._id)}
            onDiscard={() => act('discard', m._id)}
            palette={palette}
            isDark={isDark}
            accent={accent}
          />
        ))
      )}
    </View>
  )
}

function MessageRow({
  message,
  busy,
  onRelease,
  onDiscard,
  palette,
  isDark,
  accent,
}: {
  message: ScheduleMessageRef
  busy: boolean
  onRelease: () => void
  onDiscard: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <View
      className="rounded-xl"
      style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, padding: 14 }}
    >
      <View className="flex-row items-center" style={{ gap: 8, marginBottom: 6 }}>
        <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: accentTint(accent, isDark ? 0.2 : 0.14) }}>
          <RNText
            style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: accent, letterSpacing: 0.5 }}
          >
            {message.messageType} · {message.actionCode}
          </RNText>
        </View>
        {message.flightNumber ? (
          <RNText style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
            {message.flightNumber}
            {message.flightDate ? ` · ${message.flightDate}` : ''}
          </RNText>
        ) : null}
      </View>
      {message.summary ? (
        <RNText style={{ fontSize: 13, color: palette.textSecondary, lineHeight: 18 }} numberOfLines={3}>
          {message.summary}
        </RNText>
      ) : null}
      <View className="flex-row" style={{ gap: 8, marginTop: 10 }}>
        <Pressable
          onPress={onDiscard}
          disabled={busy}
          className="flex-row items-center rounded-lg px-3 py-1.5 active:opacity-70"
          style={{
            borderWidth: 1,
            borderColor: isDark ? 'rgba(230,53,53,0.3)' : '#fecaca',
            gap: 4,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <X size={12} color="#E63535" strokeWidth={2} />
          <RNText style={{ fontSize: 13, fontWeight: '600', color: '#E63535' }}>Discard</RNText>
        </Pressable>
        <Pressable
          onPress={onRelease}
          disabled={busy}
          className="flex-row items-center rounded-lg px-3 py-1.5 active:opacity-70"
          style={{ backgroundColor: accent, gap: 4, opacity: busy ? 0.5 : 1 }}
        >
          <Check size={12} color="#fff" strokeWidth={2} />
          <RNText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Release</RNText>
        </Pressable>
      </View>
    </View>
  )
}

/* ───────────── Delivery Log tab body ───────────── */

function LogBody({
  operatorId,
  palette,
  isDark,
  accent,
  onError,
}: {
  operatorId: string
  palette: PaletteType
  isDark: boolean
  accent: string
  onError: (m: string | null) => void
}) {
  const [messages, setMessages] = useState<ScheduleMessageRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .getScheduleMessages({ operatorId, direction: 'outbound', limit: 50 })
      .then((r) => setMessages(r.messages))
      .catch((e) => onError(e instanceof Error ? e.message : 'Failed to load log'))
      .finally(() => setLoading(false))
  }, [operatorId, onError])

  if (loading) return <ActivityIndicator color={accent} style={{ paddingVertical: 24 }} />

  return (
    <View style={{ gap: 8 }}>
      <RNText style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 2 }}>
        Latest {messages.length} outbound messages
      </RNText>
      {messages.length === 0 ? (
        <View
          className="rounded-xl items-center py-8"
          style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
        >
          <RNText style={{ fontSize: 13, color: palette.textTertiary }}>No delivery history yet.</RNText>
        </View>
      ) : (
        messages.map((m) => <LogRow key={m._id} message={m} palette={palette} isDark={isDark} accent={accent} />)
      )}
    </View>
  )
}

function LogRow({
  message,
  palette,
  isDark,
  accent,
}: {
  message: ScheduleMessageRef
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    applied: { bg: 'rgba(6,194,112,0.12)', fg: '#06C270' },
    sent: { bg: 'rgba(6,194,112,0.12)', fg: '#06C270' },
    pending: { bg: 'rgba(255,136,0,0.12)', fg: '#FF8800' },
    held: { bg: 'rgba(255,136,0,0.12)', fg: '#FF8800' },
    rejected: { bg: 'rgba(230,53,53,0.12)', fg: '#E63535' },
    discarded: { bg: 'rgba(128,128,140,0.14)', fg: palette.textSecondary },
    neutralized: { bg: 'rgba(128,128,140,0.14)', fg: palette.textSecondary },
  }
  const tone = toneMap[message.status] ?? toneMap.pending

  return (
    <View
      className="rounded-xl flex-row items-center"
      style={{
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        padding: 12,
        gap: 10,
      }}
    >
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <RNText
            style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: accent, letterSpacing: 0.5 }}
          >
            {message.messageType} · {message.actionCode}
          </RNText>
          {message.flightNumber ? (
            <RNText style={{ fontSize: 13, fontWeight: '600', color: palette.text }} numberOfLines={1}>
              {message.flightNumber}
            </RNText>
          ) : null}
        </View>
        <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {message.flightDate ?? '—'}
          {message.depStation && message.arrStation ? ` · ${message.depStation} → ${message.arrStation}` : ''}
        </RNText>
      </View>
      <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tone.bg }}>
        <RNText style={{ fontSize: 13, fontWeight: '600', color: tone.fg, textTransform: 'uppercase' }}>
          {message.status}
        </RNText>
      </View>
    </View>
  )
}

/* ───────────── Shared primitives ───────────── */

function SectionCard({
  title,
  subtitle,
  children,
  palette,
  isDark,
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

function Segmented<V extends string>({
  value,
  options,
  onChange,
  accent,
  palette,
  isDark,
}: {
  value: V
  options: Array<{ value: V; label: string }>
  onChange: (v: V) => void
  accent: string
  palette: PaletteType
  isDark: boolean
}) {
  return (
    <View
      className="flex-row rounded-lg overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: palette.cardBorder,
      }}
    >
      {options.map((o, i) => {
        const active = value === o.value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className="items-center justify-center px-4"
            style={{
              height: 36,
              backgroundColor: active ? accent : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: palette.cardBorder,
            }}
          >
            <RNText
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: active ? '#fff' : palette.textSecondary,
              }}
            >
              {o.label}
            </RNText>
          </Pressable>
        )
      })}
    </View>
  )
}

function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
  accent,
  palette,
  isDark,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
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
        onPress={() => onChange(clamp(value - 1))}
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
      <View className="items-center justify-center" style={{ minWidth: 56, height: 36 }}>
        <RNText style={{ fontSize: 14, fontWeight: '600', color: accent, fontFamily: 'monospace' }}>
          {value}
          {suffix}
        </RNText>
      </View>
      <Pressable
        onPress={() => onChange(clamp(value + 1))}
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

function CodeChips({
  options,
  selected,
  onToggle,
  isDark,
}: {
  options: Array<{ key: AsmSsmActionCode; meaning: string }>
  selected: AsmSsmActionCode[]
  onToggle: (k: AsmSsmActionCode) => void
  isDark: boolean
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      {options.map((a) => {
        const active = selected.includes(a.key)
        return (
          <Pressable
            key={a.key}
            onPress={() => onToggle(a.key)}
            accessibilityLabel={`${a.key} — ${a.meaning}`}
            className="flex-row items-center rounded-lg active:opacity-70"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: active
                ? 'rgba(6,194,112,0.12)'
                : isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(96,97,112,0.06)',
              borderWidth: 1,
              borderColor: active ? 'rgba(6,194,112,0.35)' : 'transparent',
              gap: 6,
            }}
          >
            {active ? (
              <Check size={12} color="#06C270" strokeWidth={2.5} />
            ) : (
              <X size={12} color="rgba(128,128,140,0.6)" strokeWidth={2.5} />
            )}
            <RNText
              style={{
                fontSize: 13,
                fontWeight: '600',
                fontFamily: 'monospace',
                letterSpacing: 0.5,
                color: active ? '#06C270' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.7)',
              }}
            >
              {a.key}
            </RNText>
          </Pressable>
        )
      })}
    </View>
  )
}
