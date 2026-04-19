'use client'

import { useMemo, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import {
  api,
  useCrewPositions,
  useManpowerPlanSettings,
  useManpowerPlans,
  useInvalidateManpower,
  type CrewPositionRef,
  type ManpowerPlanRef,
  type ManpowerPositionSettingsRef,
} from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'

interface Props {
  plans: ManpowerPlanRef[]
  activePlanId: string | null
  onActivePlanChange: (id: string) => void
  onPlansRefetch: () => Promise<unknown>
}

/** Right inspector panel — Plan / Scenario picker + per-position Crew
 *  Configuration form. Persists via `saveManpowerPlanSettings` +
 *  `saveManpowerPositionSettings` on click of the bottom "Save Settings"
 *  button. */
export function ManpowerRightConfigPanel({ plans, activePlanId, onActivePlanChange, onPlansRefetch }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  const operatorId = getOperatorId()
  const positions = useCrewPositions(operatorId).data ?? []
  // Flight Deck (cockpit) before Cabin Crew, then by rankOrder ascending —
  // matches the 5.4.2 admin page layout (CP, FO, PU, CA).
  const orderedPositions = useMemo(
    () =>
      [...positions].sort((a, b) => {
        const catRank = (c: string) => (c === 'cockpit' ? 0 : 1)
        const d = catRank(a.category) - catRank(b.category)
        if (d !== 0) return d
        return a.rankOrder - b.rankOrder
      }),
    [positions],
  )

  const settingsQ = useManpowerPlanSettings(activePlanId)
  const invalidate = useInvalidateManpower()

  const [activePosIdx, setActivePosIdx] = useState(0)
  const activePos = orderedPositions[activePosIdx]

  const posSettings: ManpowerPositionSettingsRef | null = useMemo(() => {
    if (!activePos) return null
    return settingsQ.data?.positionSettings.find((p) => p.positionId === activePos._id) ?? null
  }, [settingsQ.data, activePos])

  const [draft, setDraft] = useState<Partial<ManpowerPositionSettingsRef>>({})
  const [saving, setSaving] = useState(false)

  // Derive the effective values = draft ?? server value ?? default.
  const val = (k: keyof ManpowerPositionSettingsRef, fallback: number) => {
    if (k in draft) return draft[k] as number
    if (posSettings) return (posSettings[k] as number) ?? fallback
    return fallback
  }

  const setVal = (k: keyof ManpowerPositionSettingsRef, v: number) => {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const planSettings = settingsQ.data?.settings
  const [naOtherIsDrainDraft, setNaOtherIsDrainDraft] = useState<boolean | null>(null)
  const naOtherIsDrain = naOtherIsDrainDraft ?? planSettings?.naOtherIsDrain ?? false

  const handleSave = async () => {
    if (!activePlanId || !activePos) return
    setSaving(true)
    try {
      if (Object.keys(draft).length > 0) {
        await api.saveManpowerPositionSettings(activePlanId, activePos._id, {
          bhTarget: val('bhTarget', 75),
          naSick: val('naSick', 3),
          naAnnual: val('naAnnual', 10),
          naTraining: val('naTraining', 6),
          naMaternity: val('naMaternity', 1.5),
          naAttrition: val('naAttrition', 4),
          naOther: val('naOther', 1),
        })
      }
      if (naOtherIsDrainDraft !== null) {
        await api.saveManpowerPlanSettings(activePlanId, { naOtherIsDrain })
      }
      await invalidate.invalidatePlan(activePlanId)
      setDraft({})
      setNaOtherIsDrainDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const isDirty = Object.keys(draft).length > 0 || naOtherIsDrainDraft !== null

  const handleCreateScenario = async () => {
    const name = prompt('Scenario name')
    if (!name?.trim()) return
    const base = plans.find((p) => p.isBasePlan)
    const created = await api.createManpowerPlan({
      name: name.trim(),
      sourceId: base?._id,
      color: '#0063F7',
    })
    await onPlansRefetch()
    onActivePlanChange(created._id)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Scenario picker */}
        <section>
          <header className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: palette.textSecondary }}>
              Plan / Scenario
            </h3>
            <button
              type="button"
              onClick={() => void handleCreateScenario()}
              className="text-[13px] font-medium flex items-center gap-1"
              style={{ color: accent }}
            >
              <Plus size={13} />
              New
            </button>
          </header>
          <div className="flex flex-col gap-1.5">
            {plans.map((p) => {
              const isActive = p._id === activePlanId
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => onActivePlanChange(p._id)}
                  className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                  style={{
                    background: isActive ? `${accent}1a` : 'transparent',
                    border: `1px solid ${isActive ? `${accent}55` : border}`,
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 text-left text-[13px] font-medium" style={{ color: palette.text }}>
                    {p.name}
                  </span>
                  {p.isBasePlan && (
                    <span
                      className="text-[13px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        color: palette.textSecondary,
                      }}
                    >
                      Base
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Crew Configuration */}
        <section>
          <h3
            className="text-[13px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: palette.textSecondary }}
          >
            Crew Configuration
          </h3>
          <PositionSubTabs
            positions={orderedPositions}
            activeIdx={activePosIdx}
            onChange={setActivePosIdx}
            accent={accent}
            isDark={isDark}
          />
          <div className="mt-4 space-y-3">
            <NumberField
              label="BH Target / crew / month"
              value={val('bhTarget', 75)}
              onChange={(n) => setVal('bhTarget', n)}
              suffix="hrs"
              palette={palette}
              isDark={isDark}
            />
            <SubHeader label="Non-Availability (%)" palette={palette} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Sick"
                value={val('naSick', 3)}
                onChange={(n) => setVal('naSick', n)}
                suffix="%"
                palette={palette}
                isDark={isDark}
              />
              <NumberField
                label="AL / VAC"
                value={val('naAnnual', 10)}
                onChange={(n) => setVal('naAnnual', n)}
                suffix="%"
                palette={palette}
                isDark={isDark}
              />
              <NumberField
                label="Training"
                value={val('naTraining', 6)}
                onChange={(n) => setVal('naTraining', n)}
                suffix="%"
                palette={palette}
                isDark={isDark}
              />
              <NumberField
                label="Maternity"
                value={val('naMaternity', 1.5)}
                onChange={(n) => setVal('naMaternity', n)}
                suffix="%"
                palette={palette}
                isDark={isDark}
              />
            </div>
            <SubHeader label="Crew Turnover (%)" palette={palette} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Attrition"
                value={val('naAttrition', 4)}
                onChange={(n) => setVal('naAttrition', n)}
                suffix="%"
                palette={palette}
                isDark={isDark}
              />
              <NumberField
                label="Others"
                value={val('naOther', 1)}
                onChange={(n) => setVal('naOther', n)}
                suffix="%"
                palette={palette}
                isDark={isDark}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-[13px]" style={{ color: palette.text }}>
              <input
                type="checkbox"
                checked={naOtherIsDrain}
                onChange={(e) => setNaOtherIsDrainDraft(e.target.checked)}
                style={{ accentColor: accent }}
              />
              Classify &ldquo;Others&rdquo; as permanent drain (attrition-like)
            </label>
          </div>
        </section>
      </div>
      <div className="p-3 border-t" style={{ borderColor: border }}>
        <button
          type="button"
          disabled={!isDirty || saving || !activePlanId}
          onClick={() => void handleSave()}
          className="w-full h-10 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: accent, color: 'white' }}
        >
          <Save size={13} />
          Save Settings
        </button>
      </div>
    </div>
  )
}

function PositionSubTabs({
  positions,
  activeIdx,
  onChange,
  accent,
  isDark,
}: {
  positions: CrewPositionRef[]
  activeIdx: number
  onChange: (idx: number) => void
  accent: string
  isDark: boolean
}) {
  return (
    <div
      className="grid rounded-lg overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${positions.length}, 1fr)`,
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      }}
    >
      {positions.map((p, i) => {
        const isActive = i === activeIdx
        return (
          <button
            key={p._id}
            type="button"
            onClick={() => onChange(i)}
            className="h-8 text-[13px] font-semibold transition-colors"
            style={{
              background: isActive ? accent : 'transparent',
              color: isActive ? 'white' : undefined,
            }}
          >
            {p.code}
          </button>
        )
      })}
    </div>
  )
}

function SubHeader({ label, palette }: { label: string; palette: Palette }) {
  return (
    <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: palette.textSecondary }}>
      {label}
    </p>
  )
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  palette,
  isDark,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  suffix?: string
  palette: Palette
  isDark: boolean
}) {
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  return (
    <div>
      <label className="text-[13px] block mb-1" style={{ color: palette.textSecondary }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-10 px-3 rounded-lg text-[13px] outline-none"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${border}`,
            color: palette.text,
            paddingRight: suffix ? 32 : undefined,
          }}
        />
        {suffix && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px]"
            style={{ color: palette.textTertiary }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
