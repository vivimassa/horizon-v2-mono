'use client'

import { create } from 'zustand'
import {
  api,
  type DisruptionIssueRef,
  type DisruptionActivityRef,
  type OperatorDisruptionConfig,
  type OperatorDisruptionResolutionType,
  type WeatherAlertsResponse,
  type FeedStatusFilter as ApiFeedStatusFilter,
} from '@skyhub/api'
import {
  CATEGORY_LABEL as DEFAULT_CATEGORY_LABEL,
  STATUS_LABEL as DEFAULT_STATUS_LABEL,
  SLA_MINUTES as DEFAULT_SLA_MINUTES,
  OPEN_BACKLOG_THRESHOLD as DEFAULT_OPEN_BACKLOG_THRESHOLD,
  DEFAULT_RESOLUTION_TYPES,
  DEFAULT_ROLLING_STOPS,
} from '@/components/disruption-center/severity-utils'

export type FeedStatusFilter = ApiFeedStatusFilter

interface Filters {
  from: string | null
  to: string | null
  /**
   * Rolling window size in days. null = fixed period (from/to apply).
   * When set, scan re-anchors: from = today, to = today + N days. Filter
   * panel disables the period picker while this is active.
   */
  rollingPeriodDays: number | null
  category: string | null
  severity: string | null
  station: string | null
  flightNumber: string | null
}

interface DisruptionState {
  operatorId: string
  loading: boolean
  error: string | null
  issues: DisruptionIssueRef[]
  selectedIssueId: string | null
  selectedActivity: DisruptionActivityRef[]
  advisorOpen: boolean
  weather: WeatherAlertsResponse | null
  /** Category chip selected in the feed header. null = all categories. */
  feedCategory: DisruptionIssueRef['category'] | null
  /** Status dropdown selected in the feed header. Default 'active'. */
  feedStatus: FeedStatusFilter
  filters: Filters

  /** Per-operator Disruption config. null until loaded. */
  config: OperatorDisruptionConfig | null
  /** True once the first config fetch attempt has completed. */
  configLoaded: boolean

  setOperatorId: (id: string) => void
  setFeedCategory: (c: DisruptionIssueRef['category'] | null) => void
  setFeedStatus: (s: FeedStatusFilter) => void
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  resetFilters: () => void
  selectIssue: (id: string | null) => Promise<void>
  setAdvisorOpen: (open: boolean) => void

  refresh: () => Promise<void>
  refreshWeather: () => Promise<void>
  refreshConfig: () => Promise<void>
  scan: (from: string, to: string) => Promise<void>

  claim: (id: string) => Promise<void>
  assign: (id: string, userId: string) => Promise<void>
  start: (id: string) => Promise<void>
  resolve: (id: string, resolutionType: string, notes?: string) => Promise<void>
  close: (id: string) => Promise<void>
  hide: (id: string) => Promise<void>
}

const defaultFilters: Filters = {
  from: null,
  to: null,
  rollingPeriodDays: 3,
  category: null,
  severity: null,
  station: null,
  flightNumber: null,
}

export const useDisruptionStore = create<DisruptionState>((set, get) => ({
  operatorId: '',
  loading: false,
  error: null,
  issues: [],
  selectedIssueId: null,
  selectedActivity: [],
  advisorOpen: false,
  weather: null,
  feedCategory: null,
  feedStatus: 'active',
  filters: { ...defaultFilters },
  config: null,
  configLoaded: false,

  setOperatorId: (id) => set({ operatorId: id }),
  setFeedCategory: (c) => set({ feedCategory: c }),
  setFeedStatus: (s) => set({ feedStatus: s }),
  setFilter: (key, value) => set({ filters: { ...get().filters, [key]: value } }),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  setAdvisorOpen: (open) => set({ advisorOpen: open }),

  selectIssue: async (id) => {
    if (!id) {
      set({ selectedIssueId: null, selectedActivity: [] })
      return
    }
    set({ selectedIssueId: id })
    try {
      const { activity } = await api.getDisruption(id)
      set({ selectedActivity: activity })
    } catch (e) {
      console.error('Failed to load disruption detail:', e)
    }
  },

  refresh: async () => {
    const { operatorId, filters } = get()
    if (!operatorId) return
    set({ loading: true, error: null })
    try {
      const issues = await api.listDisruptions({
        operatorId,
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        category: filters.category ?? undefined,
        severity: filters.severity ?? undefined,
        station: filters.station ?? undefined,
        flightNumber: filters.flightNumber ?? undefined,
      })
      set({ issues, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load' })
    }
  },

  scan: async (from, to) => {
    const { operatorId } = get()
    if (!operatorId) return
    set({ loading: true, error: null })
    try {
      await api.scanDisruptions({ operatorId, from, to })
      await get().refresh()
      await get().refreshWeather()
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Scan failed' })
    }
  },

  refreshWeather: async () => {
    try {
      const weather = await api.listWeatherAlerts()
      set({ weather })
    } catch {
      set({ weather: null })
    }
  },

  refreshConfig: async () => {
    const { operatorId } = get()
    if (!operatorId) {
      set({ config: null, configLoaded: true })
      return
    }
    try {
      const config = await api.getOperatorDisruptionConfig(operatorId)
      set({ config, configLoaded: true })
      // Apply default feed status from config on first load only —
      // don't stomp on a value the user has already changed.
      const defaultFromConfig = config?.ui?.defaultFeedStatus
      if (defaultFromConfig && get().feedStatus === 'active') {
        set({ feedStatus: defaultFromConfig })
      }
    } catch {
      set({ config: null, configLoaded: true })
    }
  },

  claim: async (id) => {
    await api.claimDisruption(id)
    await get().refresh()
    await get().selectIssue(id)
  },
  assign: async (id, userId) => {
    await api.assignDisruption(id, userId)
    await get().refresh()
    await get().selectIssue(id)
  },
  start: async (id) => {
    await api.startDisruption(id)
    await get().refresh()
    await get().selectIssue(id)
  },
  resolve: async (id, resolutionType, notes) => {
    await api.resolveDisruption(id, { resolutionType, resolutionNotes: notes })
    await get().refresh()
    await get().selectIssue(id)
  },
  close: async (id) => {
    await api.closeDisruption(id)
    await get().refresh()
    await get().selectIssue(id)
  },
  hide: async (id) => {
    await api.hideDisruption(id)
    await get().refresh()
    if (get().selectedIssueId === id) set({ selectedIssueId: null, selectedActivity: [] })
  },
}))

// ── Effective* selectors ──
// Each selector merges a per-operator override (from config) over the
// hardcoded default. Consumers call these instead of importing constants
// directly so changes saved on the Customization page take effect live.

export function useEffectiveSla(): Record<DisruptionIssueRef['severity'], number> {
  const config = useDisruptionStore((s) => s.config)
  const sla = config?.sla
  return {
    critical: sla?.critical ?? DEFAULT_SLA_MINUTES.critical,
    warning: sla?.warning ?? DEFAULT_SLA_MINUTES.warning,
    info: sla?.info ?? DEFAULT_SLA_MINUTES.info,
  }
}

export function useEffectiveBacklogThreshold(): number {
  const config = useDisruptionStore((s) => s.config)
  return config?.ui?.openBacklogThreshold ?? DEFAULT_OPEN_BACKLOG_THRESHOLD
}

export function useEffectiveRollingStops(): number[] {
  const config = useDisruptionStore((s) => s.config)
  const stops = config?.ui?.rollingPeriodStops
  return stops && stops.length > 0 ? [...stops].sort((a, b) => a - b) : DEFAULT_ROLLING_STOPS
}

export function useEffectiveCategoryLabel(key: DisruptionIssueRef['category']): string {
  const overrides = useDisruptionStore((s) => s.config?.vocabulary?.categoryLabels)
  const override = overrides?.[key]
  return override && override.trim() !== '' ? override : DEFAULT_CATEGORY_LABEL[key]
}

export function useEffectiveCategoryLabels(): Record<DisruptionIssueRef['category'], string> {
  const overrides = useDisruptionStore((s) => s.config?.vocabulary?.categoryLabels)
  const out = { ...DEFAULT_CATEGORY_LABEL }
  if (overrides) {
    for (const k of Object.keys(out) as Array<DisruptionIssueRef['category']>) {
      const v = overrides[k]
      if (v && v.trim() !== '') out[k] = v
    }
  }
  return out
}

export function useEffectiveStatusLabel(key: DisruptionIssueRef['status']): string {
  const overrides = useDisruptionStore((s) => s.config?.vocabulary?.statusLabels)
  const override = overrides?.[key]
  return override && override.trim() !== '' ? override : DEFAULT_STATUS_LABEL[key]
}

export function useEffectiveStatusLabels(): Record<DisruptionIssueRef['status'], string> {
  const overrides = useDisruptionStore((s) => s.config?.vocabulary?.statusLabels)
  const out = { ...DEFAULT_STATUS_LABEL }
  if (overrides) {
    for (const k of Object.keys(out) as Array<DisruptionIssueRef['status']>) {
      const v = overrides[k]
      if (v && v.trim() !== '') out[k] = v
    }
  }
  return out
}

export function useEffectiveResolutionTypes(): OperatorDisruptionResolutionType[] {
  const overrides = useDisruptionStore((s) => s.config?.vocabulary?.resolutionTypes)
  if (!overrides || overrides.length === 0) return DEFAULT_RESOLUTION_TYPES
  // Preserve the default order; override label/hint/enabled where the
  // override carries the same key. Custom keys not in defaults are
  // appended at the end.
  const byKey = new Map(overrides.map((r) => [r.key, r]))
  const merged: OperatorDisruptionResolutionType[] = DEFAULT_RESOLUTION_TYPES.map((d) => {
    const o = byKey.get(d.key)
    return o ? { ...d, ...o } : d
  })
  for (const o of overrides) {
    if (!DEFAULT_RESOLUTION_TYPES.some((d) => d.key === o.key)) merged.push(o)
  }
  return merged
}
