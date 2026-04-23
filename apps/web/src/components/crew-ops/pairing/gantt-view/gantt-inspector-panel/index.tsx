'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  PanelRightOpen,
  PanelRightClose,
  Plane,
  Search,
  Sparkles,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Users as UsersIcon,
  Trash2,
  CheckCircle2,
  Layers,
  ListPlus,
  Zap,
  Copy,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { api, type PairingCreateInput } from '@skyhub/api'
import { usePairingStore, resolveComplementCounts, type BulkQueuedPairing } from '@/stores/use-pairing-store'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'
import { usePairingLegality } from '../../use-pairing-legality'
import { pairingFromApi } from '../../adapters'
import { InspectPairingPanel } from '../../text-view/inspect-pairing-panel'
import { IllegalPairingDialog } from '../../dialogs/illegal-pairing-dialog'
import { DeletePairingDialog } from '../../dialogs/delete-pairing-dialog'
import { BulkReplicateConfirmDialog } from '../../dialogs/bulk-replicate-confirm-dialog'
import { CrossFamilyPairingDialog } from '../../dialogs/cross-family-pairing-dialog'
import { validateCrossFamily, type CrossFamilyConflict } from '@/lib/crew-coverage/validate-cross-family'
import {
  ACCENT as INSPECTOR_ACCENT,
  SectionHeader as InspectorSectionHeader,
  GroundTimeRow,
  LayoverRow,
  LegalityChecks,
  complementLabel,
} from '../../text-view/inspector-helpers'

const LAYOVER_THRESHOLD_MIN = 24 * 60
import type { PairingFlight, LegalityResult } from '../../types'

interface InspectorProps {
  open: boolean
  onToggle: () => void
}

/**
 * Right-side inspector panel for the Pairing Gantt. Four modes:
 *   E1 empty — no selection
 *   E2 flight — single flight bar selected
 *   E3 pairing — a pill in the zone is inspected
 *   E4 build — build mode active; shows chain, complement, legality, CTA
 *
 * Collapses to a 24px edge tab. All SectionHeaders use a 3px accent bar to
 * stay consistent with SkyHub design system rules.
 */
export function PairingGanttInspector({ open, onToggle }: InspectorProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const flights = usePairingStore((s) => s.flights)
  const pairings = usePairingStore((s) => s.pairings)
  const complements = usePairingStore((s) => s.complements)
  const inspectedPairingId = usePairingStore((s) => s.inspectedPairingId)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const addPairing = usePairingStore((s) => s.addPairing)
  const replacePairing = usePairingStore((s) => s.replacePairing)
  const setError = usePairingStore((s) => s.setError)
  const editingPairingId = usePairingStore((s) => s.editingPairingId)
  const setEditingPairing = usePairingStore((s) => s.setEditingPairing)
  const activeComplementKey = usePairingStore((s) => s.activeComplementKey)
  const setComplement = usePairingStore((s) => s.setComplement)
  const customCrewCounts = usePairingStore((s) => s.customCrewCounts)
  const setCustomCrewCounts = usePairingStore((s) => s.setCustomCrewCounts)
  const aircraftTypeFamilies = usePairingStore((s) => s.aircraftTypeFamilies)
  const positionFilter = usePairingStore((s) => s.filters.positionFilter)

  const bulkQueue = usePairingStore((s) => s.bulkQueue)
  const addToBulkQueue = usePairingStore((s) => s.addToBulkQueue)
  const removeFromBulkQueue = usePairingStore((s) => s.removeFromBulkQueue)
  const clearBulkQueue = usePairingStore((s) => s.clearBulkQueue)

  const selectedFlightIds = usePairingGanttStore((s) => s.selectedFlightIds)
  const clearSelection = usePairingGanttStore((s) => s.clearSelection)
  const buildMode = usePairingGanttStore((s) => s.buildMode)
  const setBuildMode = usePairingGanttStore((s) => s.setBuildMode)
  const bulkMode = usePairingGanttStore((s) => s.bulkMode)
  const deadheadFlightIds = usePairingGanttStore((s) => s.deadheadFlightIds)
  const toggleDeadheadFlight = usePairingGanttStore((s) => s.toggleDeadheadFlight)
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  // When the planner clicks Create on a violating chain we stash a flag so
  // the IllegalPairingDialog can surface the specific rule failures and ask
  // for an override. `false` dismisses the dialog.
  const [pendingIllegal, setPendingIllegal] = useState<boolean>(false)
  const [crossFamilyConflict, setCrossFamilyConflict] = useState<CrossFamilyConflict | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    pairingCode: string
    legs: number
    routeChain: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingBulkReplicate, setPendingBulkReplicate] = useState(false)

  const selectedFlight = useMemo(() => {
    if (selectedFlightIds.size !== 1) return null
    const id = Array.from(selectedFlightIds)[0]
    return flights.find((f) => f.id === id) ?? null
  }, [selectedFlightIds, flights])

  const selectedBuildFlights = useMemo(() => {
    if (!buildMode) return []
    const ids = Array.from(selectedFlightIds)
    return ids
      .map((id) => flights.find((f) => f.id === id))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .sort((a, b) => Date.parse(a.stdUtc) - Date.parse(b.stdUtc))
  }, [buildMode, selectedFlightIds, flights])

  const inspectedPairing = useMemo(
    () => pairings.find((p) => p.id === inspectedPairingId) ?? null,
    [pairings, inspectedPairingId],
  )

  // Auto-set custom complement when Position filter is active + chain has an
  // aircraft type. Sums required counts from the standard CrewComplement
  // template for the selected positions; overwrites any prior custom edits
  // (per user spec: simple, predictable).
  useEffect(() => {
    if (!buildMode) return
    if (!positionFilter || positionFilter.length === 0) return
    const icao = selectedBuildFlights[0]?.aircraftType ?? null
    if (!icao) return
    const template = resolveComplementCounts(complements, icao, 'standard')
    const counts: Record<string, number> = {}
    for (const code of positionFilter) {
      const req = template?.[code]
      if (typeof req === 'number' && req > 0) counts[code] = req
      else counts[code] = 1
    }
    setCustomCrewCounts(counts)
    if (activeComplementKey !== 'custom') setComplement('custom')
    // Intentionally exclude `activeComplementKey` / `customCrewCounts` from deps
    // to avoid a loop — we only fire on filter / chain-AC / buildMode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, buildMode, selectedBuildFlights[0]?.aircraftType, complements])

  // Debounce the flight chain before running legality so rapid clicks / drag
  // commits don't block the UI with back-to-back FDTL engine runs. 150ms is
  // imperceptible to planners but batches bursts of double-clicks into one pass.
  const [debouncedBuildFlights, setDebouncedBuildFlights] = useState<PairingFlight[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!buildMode || selectedBuildFlights.length === 0) {
      setDebouncedBuildFlights([])
      return
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedBuildFlights(selectedBuildFlights)
    }, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // selectedBuildFlights array ref changes each render; compare by stable IDs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildMode, selectedFlightIds])

  // Live FDTL legality for the build-mode chain. `usePairingLegality` uses
  // the real engine when the operator has an FDTL rule set loaded, and falls
  // back to a realistic mock so the UI stays usable in dev.
  const { result: liveLegality, usingMock: legalityUsingMock } = usePairingLegality(debouncedBuildFlights, {
    complementKey: activeComplementKey,
    facilityClass: activeComplementKey === 'standard' ? undefined : 'CLASS_1',
    homeBase: debouncedBuildFlights[0]?.departureAirport,
    deadheadIds: deadheadFlightIds,
  })

  /** Persist the pairing as committed. If `override` is false and the chain
   *  has any FDTL violation we short-circuit and surface the
   *  IllegalPairingDialog (matching the Text workspace flow). */
  const handleCreatePairing = useCallback(
    async (override = false) => {
      if (selectedBuildFlights.length < 2 || saving) return
      const fam = validateCrossFamily(selectedBuildFlights, aircraftTypeFamilies)
      if (!fam.ok && fam.conflict) {
        setCrossFamilyConflict(fam.conflict)
        return
      }
      if (!override && liveLegality.overallStatus === 'violation') {
        setPendingIllegal(true)
        return
      }
      const workflow = 'committed' as const
      setSaving(true)
      setError(null)
      try {
        const aircraftTypeIcao = selectedBuildFlights[0].aircraftType || null
        const crewCounts =
          activeComplementKey === 'custom'
            ? customCrewCounts
            : resolveComplementCounts(complements, aircraftTypeIcao, activeComplementKey)
        // Pick up virtual placements from the Gantt's current layout so the
        // tail that the planner sees on the canvas row gets persisted onto
        // the leg — even when the flight pool has no `tailNumber` of its own.
        const virtualPlacements = usePairingGanttStore.getState().layout?.virtualPlacements
        const legs: PairingCreateInput['legs'] = selectedBuildFlights.map((f, i) => ({
          flightId: f.id,
          flightDate: f.instanceDate,
          legOrder: i,
          isDeadhead: deadheadFlightIds.has(f.id),
          dutyDay: 1,
          depStation: f.departureAirport,
          arrStation: f.arrivalAirport,
          flightNumber: f.flightNumber,
          stdUtcIso: f.stdUtc,
          staUtcIso: f.staUtc,
          blockMinutes: f.blockMinutes,
          aircraftTypeIcao: f.aircraftType || null,
          tailNumber: virtualPlacements?.get(f.id) ?? f.tailNumber ?? null,
        }))
        const facilityClass = activeComplementKey === 'standard' ? null : 'CLASS_1'
        const fdtlStatus =
          liveLegality.overallStatus === 'pass'
            ? 'legal'
            : liveLegality.overallStatus === 'warning'
              ? 'warning'
              : 'violation'
        if (editingPairingId) {
          const updated = await api.updatePairing(editingPairingId, {
            pairingCode: makePairingCode(selectedBuildFlights[0]),
            complementKey: activeComplementKey,
            cockpitCount: computeCockpitCount(activeComplementKey, crewCounts),
            facilityClass,
            crewCounts,
            legs,
            fdtlStatus,
            workflowStatus: workflow,
            lastLegalityResult: liveLegality,
          })
          const local = pairingFromApi(updated)
          replacePairing(local)
          setEditingPairing(null)
          clearSelection()
          inspectPairing(local.id)
        } else {
          const created = await api.createPairing({
            pairingCode: makePairingCode(selectedBuildFlights[0]),
            baseAirport: selectedBuildFlights[0].departureAirport,
            aircraftTypeIcao,
            complementKey: activeComplementKey,
            cockpitCount: computeCockpitCount(activeComplementKey, crewCounts),
            facilityClass,
            crewCounts,
            legs,
            fdtlStatus,
            workflowStatus: workflow,
            lastLegalityResult: liveLegality,
          })
          const local = pairingFromApi(created)
          addPairing(local)
          // Stay in build mode so planner can chain another pairing back-to-back.
          clearSelection()
          inspectPairing(local.id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create pairing')
      } finally {
        setSaving(false)
      }
    },
    [
      selectedBuildFlights,
      saving,
      setError,
      complements,
      activeComplementKey,
      customCrewCounts,
      aircraftTypeFamilies,
      liveLegality,
      addPairing,
      replacePairing,
      editingPairingId,
      setEditingPairing,
      setBuildMode,
      clearSelection,
      inspectPairing,
      setPendingIllegal,
    ],
  )

  // Queue the current flight chain for bulk commit without writing to DB.
  const handleAddToQueue = useCallback(() => {
    if (selectedBuildFlights.length < 2) return
    const fam = validateCrossFamily(selectedBuildFlights, aircraftTypeFamilies)
    if (!fam.ok && fam.conflict) {
      setCrossFamilyConflict(fam.conflict)
      return
    }
    const aircraftTypeIcao = selectedBuildFlights[0].aircraftType || null
    const crewCounts =
      activeComplementKey === 'custom'
        ? customCrewCounts
        : resolveComplementCounts(complements, aircraftTypeIcao, activeComplementKey)
    const virtualPlacements = usePairingGanttStore.getState().layout?.virtualPlacements
    const legs = selectedBuildFlights.map((f, i) => ({
      flightId: f.id,
      flightDate: f.instanceDate,
      legOrder: i,
      isDeadhead: deadheadFlightIds.has(f.id),
      dutyDay: 1,
      depStation: f.departureAirport,
      arrStation: f.arrivalAirport,
      flightNumber: f.flightNumber,
      stdUtcIso: f.stdUtc,
      staUtcIso: f.staUtc,
      blockMinutes: f.blockMinutes,
      aircraftTypeIcao: f.aircraftType || null,
      tailNumber: virtualPlacements?.get(f.id) ?? f.tailNumber ?? null,
    }))
    const fdtlStatus =
      liveLegality.overallStatus === 'pass'
        ? 'legal'
        : liveLegality.overallStatus === 'warning'
          ? 'warning'
          : 'violation'
    addToBulkQueue({
      localId: crypto.randomUUID(),
      flightIds: selectedBuildFlights.map((f) => f.id),
      pairingCode: makePairingCode(selectedBuildFlights[0]),
      baseAirport: selectedBuildFlights[0].departureAirport,
      aircraftTypeIcao,
      complementKey: activeComplementKey,
      cockpitCount: computeCockpitCount(activeComplementKey, crewCounts),
      facilityClass: activeComplementKey === 'standard' ? null : 'CLASS_1',
      crewCounts,
      legs,
      fdtlStatus,
      lastLegalityResult: liveLegality,
    })
    clearSelection()
  }, [
    selectedBuildFlights,
    aircraftTypeFamilies,
    activeComplementKey,
    customCrewCounts,
    complements,
    liveLegality,
    addToBulkQueue,
    clearSelection,
  ])

  // Write all queued pairings to DB in a single bulk request.
  const handleBulkCreate = useCallback(async () => {
    if (bulkQueue.length === 0 || bulkSaving) return
    setBulkSaving(true)
    setError(null)
    try {
      const items: PairingCreateInput[] = bulkQueue.map((q) => ({
        pairingCode: q.pairingCode,
        baseAirport: q.baseAirport,
        aircraftTypeIcao: q.aircraftTypeIcao,
        complementKey: q.complementKey,
        cockpitCount: q.cockpitCount,
        facilityClass: q.facilityClass,
        crewCounts: q.crewCounts,
        legs: q.legs,
        fdtlStatus: q.fdtlStatus,
        workflowStatus: 'committed',
        lastLegalityResult: q.lastLegalityResult,
      }))
      const { created, failed } = await api.bulkCreatePairings(items)
      for (const c of created) addPairing(pairingFromApi(c))
      clearBulkQueue()
      if (failed > 0) setError(`${failed} pairing(s) failed to save`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk create failed')
    } finally {
      setBulkSaving(false)
    }
  }, [bulkQueue, bulkSaving, addPairing, clearBulkQueue, setError])

  // Bulk create every queued pairing, then replicate each across the loaded
  // period. Strict match only: for every candidate date, each source leg must
  // resolve to a pool instance with identical flightNumber, dep/arr, and UTC
  // std/sta (±1 min). Missing pool instance, schedule-time drift, or pairing
  // already covered by another → that date is silently skipped.
  const handleBulkCreateAndReplicate = useCallback(async () => {
    if (bulkQueue.length === 0 || bulkSaving) return
    setBulkSaving(true)
    setError(null)
    try {
      const pool = usePairingStore.getState().flights
      const periodFrom = usePairingStore.getState().periodFrom
      const periodTo = usePairingStore.getState().periodTo

      const parseYmd = (ymd: string): number => {
        return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
      }
      const addDaysUtc = (ymd: string, days: number): string => {
        const d = new Date(`${ymd}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() + days)
        return d.toISOString().slice(0, 10)
      }
      const shiftIsoDays = (iso: string, days: number): string => {
        const d = new Date(iso)
        d.setUTCDate(d.getUTCDate() + days)
        return d.toISOString()
      }
      const TIME_TOLERANCE_MS = 60_000 // ±1 minute

      const items: PairingCreateInput[] = []

      for (const q of bulkQueue) {
        // Original queued pairing — always included.
        items.push({
          pairingCode: q.pairingCode,
          baseAirport: q.baseAirport,
          aircraftTypeIcao: q.aircraftTypeIcao,
          complementKey: q.complementKey,
          cockpitCount: q.cockpitCount,
          facilityClass: q.facilityClass,
          crewCounts: q.crewCounts,
          legs: q.legs,
          fdtlStatus: q.fdtlStatus,
          workflowStatus: 'committed',
          lastLegalityResult: q.lastLegalityResult,
        })

        if (q.legs.length === 0 || !periodFrom || !periodTo) continue

        const sourceStartDate = q.legs[0].flightDate
        const sourceStartMs = parseYmd(sourceStartDate)
        const legOffsets = q.legs.map((l) => Math.round((parseYmd(l.flightDate) - sourceStartMs) / 86400000))

        const start = new Date(`${periodFrom}T00:00:00Z`)
        const end = new Date(`${periodTo}T00:00:00Z`)
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const candidate = d.toISOString().slice(0, 10)
          if (candidate === sourceStartDate) continue
          const shiftDays = Math.round((parseYmd(candidate) - sourceStartMs) / 86400000)

          const resolved: PairingFlight[] = []
          let ok = true
          for (let i = 0; i < q.legs.length; i += 1) {
            const leg = q.legs[i]
            const targetDate = addDaysUtc(candidate, legOffsets[i] ?? 0)
            const pooled = pool.find(
              (x) =>
                x.flightNumber === leg.flightNumber &&
                x.departureAirport === leg.depStation &&
                x.arrivalAirport === leg.arrStation &&
                x.instanceDate === targetDate,
            )
            if (!pooled) {
              ok = false
              break
            }
            if (pooled.pairingId) {
              ok = false
              break
            }
            const expectedStdMs = Date.parse(shiftIsoDays(leg.stdUtcIso, shiftDays))
            const expectedStaMs = Date.parse(shiftIsoDays(leg.staUtcIso, shiftDays))
            const pooledStdMs = Date.parse(pooled.stdUtc)
            const pooledStaMs = Date.parse(pooled.staUtc)
            if (!Number.isFinite(expectedStdMs) || !Number.isFinite(pooledStdMs)) {
              ok = false
              break
            }
            if (Math.abs(pooledStdMs - expectedStdMs) > TIME_TOLERANCE_MS) {
              ok = false
              break
            }
            if (Math.abs(pooledStaMs - expectedStaMs) > TIME_TOLERANCE_MS) {
              ok = false
              break
            }
            resolved.push(pooled)
          }
          if (!ok) continue

          items.push({
            pairingCode: q.pairingCode,
            baseAirport: q.baseAirport,
            aircraftTypeIcao: q.aircraftTypeIcao,
            complementKey: q.complementKey,
            cockpitCount: q.cockpitCount,
            facilityClass: q.facilityClass,
            crewCounts: q.crewCounts,
            legs: resolved.map((f, idx) => ({
              flightId: f.id,
              flightDate: f.instanceDate,
              legOrder: idx,
              isDeadhead: q.legs[idx]?.isDeadhead ?? false,
              dutyDay: 1,
              depStation: f.departureAirport,
              arrStation: f.arrivalAirport,
              flightNumber: f.flightNumber,
              stdUtcIso: f.stdUtc,
              staUtcIso: f.staUtc,
              blockMinutes: f.blockMinutes,
              aircraftTypeIcao: f.aircraftType || null,
            })),
            fdtlStatus: q.fdtlStatus,
            workflowStatus: 'committed',
            lastLegalityResult: q.lastLegalityResult,
          })
        }
      }

      // Server caps /pairings/bulk at 500 items per request. Client chunk
      // is held at 20 as a conservative safety limit — month-scale replicates
      // (e.g. 35 × 30 = 1050) fan out into ~53 sequential requests instead
      // of one oversized payload.
      const CHUNK = 20
      let totalFailed = 0
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK)
        const { created, failed } = await api.bulkCreatePairings(slice)
        for (const c of created) addPairing(pairingFromApi(c))
        totalFailed += failed
      }
      clearBulkQueue()
      if (totalFailed > 0) setError(`${totalFailed} pairing(s) failed to save`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk create and replicate failed')
    } finally {
      setBulkSaving(false)
    }
  }, [bulkQueue, bulkSaving, addPairing, clearBulkQueue, setError])

  // Clear bulk queue whenever bulk mode is turned off.
  useEffect(() => {
    if (!bulkMode) clearBulkQueue()
  }, [bulkMode, clearBulkQueue])

  // Global keyboard shortcuts for this view.
  //   B             — toggle Build mode ON/OFF (same as the toolbar button).
  //   Enter         — In bulk mode: queue current chain. Otherwise: create pairing.
  //   Escape        — exit build mode
  //   Del/Backspace — delete inspected pairing
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      // Ctrl+Shift+Enter — open the Bulk Create + Replicate confirm dialog
      // (bulk mode only). Handled before the generic modifier bailout below.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter' && bulkMode) {
        if (bulkQueue.length === 0 || bulkSaving) return
        e.preventDefault()
        setPendingBulkReplicate(true)
        return
      }

      // Ignore modifier-qualified presses we haven't opted into, so the user's
      // Ctrl+A / Cmd+B keybinds from the OS still work.
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Shift+Enter — bulk commit all queued pairings (bulk mode only).
      if (e.shiftKey && e.key === 'Enter' && bulkMode) {
        e.preventDefault()
        void handleBulkCreate()
        return
      }

      // Ignore remaining shift combos.
      if (e.shiftKey) return

      // D — toggle deadhead on the hovered flight (build mode only).
      if ((e.key === 'd' || e.key === 'D') && buildMode) {
        e.preventDefault()
        const hovered = usePairingGanttStore.getState().hoveredFlightId
        const selected = usePairingGanttStore.getState().selectedFlightIds
        if (hovered && selected.has(hovered)) toggleDeadheadFlight(hovered)
        return
      }

      // Toggle Build mode. Mnemonic: "B" for Build.
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        setBuildMode(!buildMode)
        if (buildMode) clearSelection()
        return
      }

      if (e.key === 'Escape' && buildMode) {
        // Escape clears the in-progress chain only; build mode stays on until
        // the planner explicitly toggles it via the B key or toolbar button.
        clearSelection()
        return
      }

      // Enter: in bulk mode queue the chain; otherwise create immediately.
      if (e.key === 'Enter' && buildMode) {
        if (selectedBuildFlights.length < 2) return
        e.preventDefault()
        if (bulkMode) {
          handleAddToQueue()
        } else {
          if (saving) return
          void handleCreatePairing(false)
        }
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && inspectedPairing) {
        e.preventDefault()
        setPendingDelete({
          id: inspectedPairing.id,
          pairingCode: inspectedPairing.pairingCode,
          legs: inspectedPairing.flightIds.length,
          routeChain: inspectedPairing.routeChain,
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    buildMode,
    bulkMode,
    setBuildMode,
    clearSelection,
    inspectedPairing,
    inspectPairing,
    setError,
    saving,
    selectedBuildFlights.length,
    handleCreatePairing,
    handleAddToQueue,
    handleBulkCreate,
    toggleDeadheadFlight,
    bulkQueue.length,
    bulkSaving,
  ])

  const glassBg = isDark ? 'rgba(20,20,28,0.92)' : 'rgba(255,255,255,0.92)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 flex items-center justify-center rounded-l-lg border border-r-0 transition-colors hover:bg-hz-border/20"
        style={{
          width: 24,
          height: 48,
          alignSelf: 'center',
          background: glassBg,
          borderColor: glassBorder,
          backdropFilter: 'blur(16px)',
        }}
        aria-label="Open inspector"
      >
        <PanelRightOpen size={14} className="text-hz-text-secondary" />
      </button>
    )
  }

  const mode: 'empty' | 'flight' | 'pairing' | 'build' = buildMode
    ? 'build'
    : selectedFlight
      ? 'flight'
      : inspectedPairing
        ? 'pairing'
        : 'empty'

  return (
    <aside
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden"
      style={{
        width: 300,
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4"
        style={{ height: 48, borderBottom: `1px solid ${glassBorder}` }}
      >
        <span className="text-[15px] font-bold text-hz-text">Inspector</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-hz-border/30 transition-colors"
          aria-label="Close inspector"
        >
          <PanelRightClose size={14} className="text-hz-text-tertiary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === 'empty' && <InspectorEmpty />}
        {mode === 'flight' && selectedFlight && <InspectorFlight flight={selectedFlight} />}
        {mode === 'pairing' && inspectedPairing && <InspectPairingPanel pairing={inspectedPairing} flights={flights} />}
        {mode === 'build' && (
          <InspectorBuild
            selectedFlights={selectedBuildFlights}
            activeComplementKey={activeComplementKey}
            onChangeComplement={setComplement}
            legality={liveLegality}
            legalityUsingMock={legalityUsingMock}
            saving={saving}
            bulkMode={bulkMode}
            bulkQueue={bulkQueue}
            bulkSaving={bulkSaving}
            onAddToQueue={handleAddToQueue}
            onBulkCreate={handleBulkCreate}
            onBulkCreateAndReplicate={() => setPendingBulkReplicate(true)}
            onRemoveFromQueue={removeFromBulkQueue}
            onCreate={() => handleCreatePairing(false)}
            onCancel={() => {
              // Cancel clears the chain and any in-progress edit; build mode
              // stays on. Planner exits build via the toolbar button or the
              // B shortcut.
              clearSelection()
              setEditingPairing(null)
            }}
            onRemoveFlight={(id) => {
              const next = new Set(selectedFlightIds)
              next.delete(id)
              usePairingGanttStore.setState({ selectedFlightIds: next })
            }}
            deadheadFlightIds={deadheadFlightIds}
            isDark={isDark}
          />
        )}
      </div>

      {/* Override dialog — shown when Create is pressed on a chain with
          violations. Proceed forwards to `handleCreatePairing` with the
          originally-requested workflow and `override=true` so it skips the
          re-check; Cancel just dismisses the dialog. */}
      {pendingIllegal && buildMode && (
        <IllegalPairingDialog
          result={liveLegality}
          onProceed={() => {
            setPendingIllegal(false)
            void handleCreatePairing(true)
          }}
          onCancel={() => setPendingIllegal(false)}
        />
      )}

      {crossFamilyConflict && (
        <CrossFamilyPairingDialog conflict={crossFamilyConflict} onClose={() => setCrossFamilyConflict(null)} />
      )}

      {pendingDelete && (
        <DeletePairingDialog
          pairingCode={pendingDelete.pairingCode}
          detail={`${pendingDelete.legs} legs · ${pendingDelete.routeChain}`}
          busy={deleting}
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={async () => {
            setDeleting(true)
            try {
              await api.deletePairing(pendingDelete.id)
              usePairingStore.getState().removePairing(pendingDelete.id)
              inspectPairing(null)
              setPendingDelete(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete pairing')
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}

      {pendingBulkReplicate && (
        <BulkReplicateConfirmDialog
          queueCount={bulkQueue.length}
          periodFrom={usePairingStore.getState().periodFrom}
          periodTo={usePairingStore.getState().periodTo}
          busy={bulkSaving}
          onCancel={() => {
            if (!bulkSaving) setPendingBulkReplicate(false)
          }}
          onConfirm={async () => {
            setPendingBulkReplicate(false)
            await handleBulkCreateAndReplicate()
          }}
        />
      )}
    </aside>
  )
}

// ── Mode panels ──

function InspectorEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
      <Search size={40} className="text-hz-text-tertiary opacity-70" />
      <p className="text-[13px] text-hz-text-secondary max-w-[180px]">
        Select a flight bar or pairing pill to see its details.
      </p>
    </div>
  )
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="inline-block rounded-full"
        style={{ width: 3, height: 16, background: 'var(--module-accent, #1e40af)' }}
      />
      <span className="text-[15px] font-bold text-hz-text">{title}</span>
      {badge && (
        <span
          className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{
            background: 'color-mix(in srgb, var(--module-accent, #1e40af) 15%, transparent)',
            color: 'var(--module-accent, #1e40af)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}

function InspectorFlight({ flight }: { flight: PairingFlight }) {
  const block = formatBlock(flight.blockMinutes)
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 3, height: 16, background: 'var(--module-accent, #1e40af)' }}
        />
        <Plane size={14} className="text-hz-text-tertiary" />
        <span className="text-[15px] font-bold text-hz-text">{flight.flightNumber}</span>
        <span
          className="ml-auto text-[13px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            background: 'color-mix(in srgb, var(--module-accent, #1e40af) 15%, transparent)',
            color: 'var(--module-accent, #1e40af)',
          }}
        >
          {flight.aircraftType}
        </span>
      </div>

      {/* Route box */}
      <div className="flex items-center gap-3 py-3 px-4 rounded-xl" style={{ background: 'rgba(125,125,140,0.08)' }}>
        <div className="flex flex-col items-center">
          <span className="text-[18px] font-mono font-bold text-hz-text">{flight.departureAirport}</span>
          <span className="text-[13px] text-hz-text-tertiary">{formatTime(flight.stdUtc)}Z</span>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full h-px bg-hz-border" />
          <span className="text-[13px] text-hz-text-secondary tabular-nums mt-0.5">{block}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[18px] font-mono font-bold text-hz-text">{flight.arrivalAirport}</span>
          <span className="text-[13px] text-hz-text-tertiary">{formatTime(flight.staUtc)}Z</span>
        </div>
      </div>

      <div>
        <SectionHeader title="Details" />
        <Row label="Date" value={flight.instanceDate} />
        <Row label="Block" value={block} />
        <Row label="Aircraft" value={flight.tailNumber ?? '—'} />
        <Row label="Status" value={flight.status} />
        {flight.serviceType && <Row label="Service" value={flight.serviceType} />}
        {flight.pairingId && (
          <Row
            label="Pairing"
            value={<span style={{ color: 'var(--module-accent, #1e40af)' }}>{flight.pairingId.slice(0, 8)}…</span>}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Build-mode inspector. Mirrors the layout of `InspectPairingPanel` so the
 * planner sees the same data shape when building a pairing as when inspecting
 * a committed one — a real header (preview code + live legality badge +
 * route chain + metadata strip), the Complement section, numbered Legs with
 * ground-time rows between them, a pinned Legality section, and the
 * Create / Cancel actions in the footer.
 */
function InspectorBuild({
  selectedFlights,
  activeComplementKey,
  onChangeComplement,
  legality,
  legalityUsingMock,
  saving,
  bulkMode,
  bulkQueue,
  bulkSaving,
  onAddToQueue,
  onBulkCreate,
  onBulkCreateAndReplicate,
  onRemoveFromQueue,
  onCreate,
  onCancel,
  onRemoveFlight,
  deadheadFlightIds,
  isDark,
}: {
  selectedFlights: PairingFlight[]
  activeComplementKey: 'standard' | 'aug1' | 'aug2' | 'custom'
  onChangeComplement: (k: 'standard' | 'aug1' | 'aug2' | 'custom') => void
  legality: LegalityResult
  legalityUsingMock: boolean
  saving: boolean
  bulkMode: boolean
  bulkQueue: BulkQueuedPairing[]
  bulkSaving: boolean
  onAddToQueue: () => void
  onBulkCreate: () => void
  onBulkCreateAndReplicate: () => void
  onRemoveFromQueue: (localId: string) => void
  onCreate: () => void
  onCancel: () => void
  onRemoveFlight: (id: string) => void
  deadheadFlightIds: Set<string>
  isDark: boolean
}) {
  // Pull complement/positions from the store so the "(X cockpit, Y cabin)"
  // breakdown is derived the same way as the committed-pairing inspector.
  const complements = usePairingStore((s) => s.complements)
  const positions = usePairingStore((s) => s.positions)
  const customCrewCounts = usePairingStore((s) => s.customCrewCounts)
  const setCustomCrewCounts = usePairingStore((s) => s.setCustomCrewCounts)
  const editingPairingId = usePairingStore((s) => s.editingPairingId)

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  // Derived header data — shown even for a single selected flight so the
  // planner has continuous feedback as they build.
  const routeChain = useMemo(() => {
    if (selectedFlights.length === 0) return '—'
    const chain = [selectedFlights[0].departureAirport, ...selectedFlights.map((f) => f.arrivalAirport)]
    return chain.filter(Boolean).join('-')
  }, [selectedFlights])

  const baseAirport = selectedFlights[0]?.departureAirport ?? ''
  const aircraftType = selectedFlights[0]?.aircraftType ?? null
  const previewCode = selectedFlights[0] ? makePairingCode(selectedFlights[0]) : 'NEW'

  const totalBlockMinutes = selectedFlights.reduce((s, f) => s + f.blockMinutes, 0)
  const uniqueDates = new Set(selectedFlights.map((f) => f.instanceDate))
  const pairingDays = uniqueDates.size || 1

  // Resolve crew counts for the (aircraftType, complementKey) pair so the
  // cabin count in the Complement strip reflects the actual catalog rather
  // than an approximation.
  const resolvedCrewCounts = useMemo(() => {
    if (activeComplementKey === 'custom') {
      if (positions.length === 0) return customCrewCounts
      const activeCodes = new Set(positions.map((p) => p.code))
      const filtered: Record<string, number> = {}
      for (const [code, n] of Object.entries(customCrewCounts)) {
        if (activeCodes.has(code) && n > 0) filtered[code] = n
      }
      return filtered
    }
    const raw = resolveComplementCounts(complements, aircraftType, activeComplementKey)
    if (!raw) return null
    if (positions.length === 0) return raw
    const activeCodes = new Set(positions.map((p) => p.code))
    const filtered: Record<string, number> = {}
    for (const [code, n] of Object.entries(raw)) {
      if (activeCodes.has(code) && n > 0) filtered[code] = n
    }
    return filtered
  }, [complements, aircraftType, activeComplementKey, positions, customCrewCounts])
  const cockpitCount =
    activeComplementKey === 'custom'
      ? (() => {
          const cockpitCodes = new Set(positions.filter((p) => p.category === 'cockpit').map((p) => p.code))
          return Object.entries(customCrewCounts)
            .filter(([code]) => cockpitCodes.has(code))
            .reduce((s, [, n]) => s + (n || 0), 0)
        })()
      : activeComplementKey === 'aug2'
        ? 4
        : activeComplementKey === 'aug1'
          ? 3
          : 2
  const cabinCount = useMemo(() => {
    if (!resolvedCrewCounts) return 0
    const cabinCodes = new Set(positions.filter((p) => p.category === 'cabin').map((p) => p.code))
    return Object.entries(resolvedCrewCounts)
      .filter(([code]) => cabinCodes.has(code))
      .reduce((sum, [, n]) => sum + (n || 0), 0)
  }, [resolvedCrewCounts, positions])

  // Derived status badge mirroring the pairing-status badge used for
  // committed pairings. Maps legality → badge color + label.
  const statusColor =
    legality.overallStatus === 'violation' ? '#FF3B3B' : legality.overallStatus === 'warning' ? '#FF8800' : '#06C270'
  const statusLabel =
    legality.overallStatus === 'violation' ? 'Violation' : legality.overallStatus === 'warning' ? 'Warning' : 'Legal'

  const suggestedKey: 'standard' | 'aug1' | 'aug2' =
    selectedFlights.length >= 4 ? 'aug2' : selectedFlights.length >= 2 ? 'aug1' : 'standard'
  const COMPLEMENT_OPTIONS = [
    { key: 'standard', label: 'Standard' },
    { key: 'aug1', label: 'Aug 1' },
    { key: 'aug2', label: 'Aug 2' },
    { key: 'custom', label: 'Other' },
  ] as const

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-[16px] font-bold tracking-tight tabular-nums" style={{ color: textPrimary }}>
            {previewCode}
            <span
              className="ml-2 inline-flex items-center text-[10px] font-bold tracking-[0.08em] uppercase px-1.5 h-4 rounded align-middle"
              style={{
                background: `${INSPECTOR_ACCENT}22`,
                color: INSPECTOR_ACCENT,
                border: `1px solid ${INSPECTOR_ACCENT}55`,
              }}
            >
              Preview
            </span>
          </h3>
          <span
            className="inline-flex items-center gap-1 text-[12px] font-bold px-2 h-[22px] rounded-full tabular-nums"
            style={{
              background: `${statusColor}18`,
              color: statusColor,
              border: `1px solid ${statusColor}55`,
            }}
          >
            {legality.overallStatus === 'pass' ? (
              <CheckCircle size={11} strokeWidth={2.4} />
            ) : legality.overallStatus === 'warning' ? (
              <AlertTriangle size={11} strokeWidth={2.4} />
            ) : (
              <XCircle size={11} strokeWidth={2.4} />
            )}
            {statusLabel}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 text-[12px] font-medium tabular-nums mb-1"
          style={{ color: textSecondary }}
        >
          <Plane size={11} strokeWidth={2} style={{ color: textTertiary }} />
          <span className="truncate">{routeChain}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] tabular-nums" style={{ color: textTertiary }}>
          <span>{baseAirport || '—'} base</span>
          <span>·</span>
          <span>{pairingDays}d</span>
          <span>·</span>
          <span>{(totalBlockMinutes / 60).toFixed(1)}h block</span>
          <span>·</span>
          <span>
            {selectedFlights.length} leg{selectedFlights.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4">
        {/* Complement */}
        <InspectorSectionHeader title="Complement" isDark={isDark} />
        <div className="flex items-center gap-2 text-[13px]" style={{ color: textPrimary }}>
          <UsersIcon size={13} strokeWidth={2} style={{ color: INSPECTOR_ACCENT }} />
          <span className="font-semibold">{complementLabel(activeComplementKey)}</span>
          <span className="text-[12px]" style={{ color: textTertiary }}>
            ({cockpitCount} cockpit
            {resolvedCrewCounts ? `, ${cabinCount} cabin` : ''})
          </span>
        </div>

        {/* Complement selector — kept inline so the planner can swap templates
            without hunting for a toolbar. Suggestion sparkle matches v1. */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${divider}` }}>
          {COMPLEMENT_OPTIONS.map((opt) => {
            const active = activeComplementKey === opt.key
            const isSuggested = suggestedKey === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChangeComplement(opt.key)}
                className="relative flex-1 h-8 flex items-center justify-center gap-1 text-[12px] font-semibold transition-colors"
                style={{
                  background: active ? INSPECTOR_ACCENT : 'transparent',
                  color: active ? '#fff' : textSecondary,
                }}
              >
                {opt.label}
                {isSuggested && !active && (
                  <Sparkles size={10} className="absolute top-1 right-1" style={{ color: INSPECTOR_ACCENT }} />
                )}
              </button>
            )
          })}
        </div>

        {activeComplementKey === 'custom' && (
          <CustomComplementEditor
            counts={customCrewCounts}
            positions={positions}
            onChange={setCustomCrewCounts}
            isDark={isDark}
            divider={divider}
            textSecondary={textSecondary}
            textTertiary={textTertiary}
          />
        )}

        {/* Legs — mirrors the committed-pairing inspector, adds remove X. */}
        <InspectorSectionHeader title={`Legs (${selectedFlights.length})`} isDark={isDark} />
        <div className="space-y-1">
          {selectedFlights.length === 0 ? (
            <div
              className="text-[12px] italic px-2.5 py-2 rounded-md"
              style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                border: `1px solid ${divider}`,
                color: textTertiary,
              }}
            >
              Click flights on the canvas to add them to this chain.
            </div>
          ) : (
            selectedFlights.map((f, i) => {
              const next = selectedFlights[i + 1]
              if (!next) {
                return (
                  <Fragment key={f.id}>
                    <BuildLegRow
                      index={i}
                      flight={f}
                      isDeadhead={deadheadFlightIds.has(f.id)}
                      onRemove={() => onRemoveFlight(f.id)}
                      isDark={isDark}
                    />
                  </Fragment>
                )
              }
              const gap = groundTimeMinutes(f, next)
              return (
                <Fragment key={f.id}>
                  <BuildLegRow
                    index={i}
                    flight={f}
                    isDeadhead={deadheadFlightIds.has(f.id)}
                    onRemove={() => onRemoveFlight(f.id)}
                    isDark={isDark}
                  />
                  {gap >= LAYOVER_THRESHOLD_MIN ? (
                    <LayoverRow minutes={gap} station={f.arrivalAirport} isDark={isDark} />
                  ) : (
                    <GroundTimeRow minutes={gap} station={f.arrivalAirport} isDark={isDark} />
                  )}
                </Fragment>
              )
            })
          )}
        </div>
      </div>

      {/* Legality — pinned above the actions so the planner always sees it
          while deciding whether to commit. */}
      <div className="shrink-0 px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${divider}` }}>
        <InspectorSectionHeader title="Legality" isDark={isDark} />
        {selectedFlights.length === 0 ? (
          <div
            className="text-[12px] italic px-2.5 py-2 rounded-md"
            style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
              border: `1px solid ${divider}`,
              color: textTertiary,
            }}
          >
            Add at least one flight to run FDTL checks.
          </div>
        ) : (
          <LegalityChecks result={legality} isDark={isDark} />
        )}
        {legalityUsingMock && (
          <p className="text-[10px] italic" style={{ color: textTertiary }}>
            Preview — FDTL rule set not configured for this operator.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 px-4 pt-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${divider}` }}>
        {bulkMode ? (
          <>
            {/* Bulk Queue strip */}
            {bulkQueue.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Layers size={12} style={{ color: INSPECTOR_ACCENT }} />
                  <span className="text-[12px] font-semibold" style={{ color: INSPECTOR_ACCENT }}>
                    Queue ({bulkQueue.length})
                  </span>
                </div>
                <div className="space-y-1 max-h-[156px] overflow-y-auto">
                  {bulkQueue.map((q) => {
                    const routeChain =
                      q.legs.length > 0
                        ? [q.legs[0].depStation, ...q.legs.map((l) => l.arrStation)].join('→')
                        : q.pairingCode
                    const statusColor =
                      q.fdtlStatus === 'violation' ? '#FF3B3B' : q.fdtlStatus === 'warning' ? '#FF8800' : '#06C270'
                    return (
                      <div
                        key={q.localId}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                          border: `1px solid ${divider}`,
                        }}
                      >
                        <span
                          className="inline-flex items-center justify-center w-2 h-2 rounded-full shrink-0"
                          style={{ background: statusColor }}
                        />
                        <span className="flex-1 text-[12px] font-medium truncate" style={{ color: textPrimary }}>
                          {routeChain}
                        </span>
                        <span className="text-[11px]" style={{ color: textTertiary }}>
                          {q.legs.length}L
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveFromQueue(q.localId)}
                          className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
                          style={{ color: textTertiary }}
                          title="Remove from queue"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <Tooltip content={selectedFlights.length < 2 ? 'Select at least 2 flights' : 'Add to queue (Enter)'}>
              <button
                type="button"
                disabled={selectedFlights.length < 2}
                onClick={onAddToQueue}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                  color: textPrimary,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)'}`,
                }}
              >
                <ListPlus size={13} strokeWidth={2.2} />
                Add to Queue
              </button>
            </Tooltip>
            <Tooltip
              content={
                bulkQueue.length === 0
                  ? 'No pairings queued'
                  : `Write ${bulkQueue.length} pairing(s) to database (Shift+Enter)`
              }
            >
              <button
                type="button"
                disabled={bulkQueue.length === 0 || bulkSaving}
                onClick={onBulkCreate}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                  color: textPrimary,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)'}`,
                }}
              >
                {bulkSaving ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} strokeWidth={2.2} />}
                {bulkSaving ? 'Saving…' : `Bulk Create (${bulkQueue.length})`}
              </button>
            </Tooltip>
            <Tooltip
              content={
                bulkQueue.length === 0
                  ? 'No pairings queued'
                  : 'Bulk Create, then replicate each queued pairing across the loaded period. Dates with missing flights or schedule mismatches are skipped. (Ctrl+Shift+Enter)'
              }
              multiline
              maxWidth={260}
            >
              <button
                type="button"
                disabled={bulkQueue.length === 0 || bulkSaving}
                onClick={onBulkCreateAndReplicate}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                  color: textPrimary,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)'}`,
                }}
              >
                {bulkSaving ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} strokeWidth={2.2} />}
                {bulkSaving ? 'Saving…' : 'Bulk Create and Replicate'}
              </button>
            </Tooltip>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Tooltip content="Cancel build (Esc)">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: 'rgba(230,53,53,0.12)',
                  color: '#E63535',
                  border: '1px solid rgba(230,53,53,0.35)',
                }}
              >
                <Trash2 size={13} strokeWidth={2.2} />
                Cancel
              </button>
            </Tooltip>
            <Tooltip
              content={
                legality.overallStatus === 'violation'
                  ? 'Create with FDTL violation (Enter — requires override confirmation)'
                  : selectedFlights.length < 2
                    ? 'Select at least 2 flights'
                    : 'Create (Enter)'
              }
            >
              <button
                type="button"
                disabled={selectedFlights.length < 2 || saving}
                onClick={onCreate}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: legality.overallStatus === 'violation' ? '#FF3B3B' : INSPECTOR_ACCENT,
                  border: `1px solid ${legality.overallStatus === 'violation' ? '#FF3B3B' : INSPECTOR_ACCENT}`,
                }}
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : legality.overallStatus === 'violation' ? (
                  <AlertTriangle size={13} strokeWidth={2.2} />
                ) : (
                  <CheckCircle2 size={13} strokeWidth={2.2} />
                )}
                {saving ? (editingPairingId ? 'Updating…' : 'Creating…') : editingPairingId ? 'Update' : 'Create'}
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

/** Small inline chip rendering one or more keycaps plus a short label.
 *  Used in the build inspector footer so the planner sees the Enter /
 *  Shift+Enter / B shortcut contract at a glance. */
function KbdHint({ keys, label, isDark }: { keys: string[]; label: string; isDark: boolean }) {
  const kbdBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  const kbdBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'
  const kbdColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)'
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <Fragment key={k}>
          {i > 0 && <span style={{ opacity: 0.45 }}>+</span>}
          <kbd
            className="inline-flex items-center justify-center px-1.5 h-[18px] rounded text-[10px] font-bold"
            style={{ background: kbdBg, border: `1px solid ${kbdBorder}`, color: kbdColor }}
          >
            {k}
          </kbd>
        </Fragment>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  )
}

/** Single row inside the build leg list. Same visual language as
 *  `SelectedLegRow` in the inspector helpers but with a trailing remove X so
 *  the planner can drop a leg without re-selecting on the canvas. */
function BuildLegRow({
  index,
  flight,
  isDeadhead,
  onRemove,
  isDark,
}: {
  index: number
  flight: PairingFlight
  isDeadhead: boolean
  onRemove: () => void
  isDark: boolean
}) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
      style={{
        background: isDeadhead
          ? isDark
            ? 'rgba(30,41,59,0.60)'
            : 'rgba(30,41,59,0.08)'
          : isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(15,23,42,0.02)',
        border: `1px solid ${isDeadhead ? 'rgba(148,163,184,0.25)' : divider}`,
      }}
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums shrink-0"
        style={{ background: `${INSPECTOR_ACCENT}22`, color: INSPECTOR_ACCENT }}
      >
        {index + 1}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[12px] font-bold tabular-nums" style={{ color: textPrimary }}>
          {flight.flightNumber}
        </span>
        <span className="text-[12px] font-medium tabular-nums" style={{ color: textSecondary }}>
          {flight.departureAirport} → {flight.arrivalAirport}
        </span>
        {isDeadhead && (
          <span
            className="text-[10px] font-bold tracking-wide px-1 py-px rounded"
            style={{ background: 'rgba(30,41,59,0.80)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.30)' }}
          >
            DHD
          </span>
        )}
      </div>
      <span className="text-[11px] tabular-nums" style={{ color: textTertiary }}>
        {flight.stdUtc.slice(11, 16)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 -mr-1 rounded hover:opacity-70 transition-opacity"
        aria-label="Remove flight"
        title="Remove from chain"
      >
        <X size={12} style={{ color: textTertiary }} />
      </button>
    </div>
  )
}

/** Ground time between two consecutive legs in minutes. */
function groundTimeMinutes(prev: PairingFlight, next: PairingFlight): number {
  const prevArr = Date.parse(prev.staUtc)
  const nextDep = Date.parse(next.stdUtc)
  if (!Number.isFinite(prevArr) || !Number.isFinite(nextDep)) return 0
  return Math.max(0, Math.round((nextDep - prevArr) / 60000))
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-hz-text-tertiary">{label}</span>
      <span className="font-semibold text-hz-text">{value}</span>
    </div>
  )
}

function CustomComplementEditor({
  counts,
  positions,
  onChange,
  isDark,
  divider,
  textSecondary,
  textTertiary,
}: {
  counts: Record<string, number>
  positions: import('@skyhub/api').CrewPositionRef[]
  onChange: (next: Record<string, number>) => void
  isDark: boolean
  divider: string
  textSecondary: string
  textTertiary: string
}) {
  const active = positions.filter((p) => p.isActive).sort((a, b) => a.rankOrder - b.rankOrder)
  const bump = (code: string, delta: number) => {
    const current = counts[code] ?? 0
    const next = Math.max(0, Math.min(99, current + delta))
    onChange({ ...counts, [code]: next })
  }
  const stepperBtn = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'
  const rowBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)'
  return (
    <div className="rounded-lg p-2 space-y-1" style={{ border: `1px solid ${divider}`, background: rowBg }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: textTertiary }}>
        Positions
      </div>
      {active.length === 0 ? (
        <div className="text-[12px] italic px-1 py-1" style={{ color: textTertiary }}>
          No crew positions configured.
        </div>
      ) : (
        active.map((p) => {
          const n = counts[p.code] ?? 0
          return (
            <div key={p.code} className="flex items-center gap-2 py-0.5">
              <span className="w-10 text-[12px] font-mono font-bold" style={{ color: textSecondary }}>
                {p.code}
              </span>
              <span className="flex-1 text-[12px] truncate" style={{ color: textSecondary }}>
                {p.name}
              </span>
              <button
                type="button"
                onClick={() => bump(p.code, -1)}
                disabled={n <= 0}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[13px] font-bold disabled:opacity-30"
                style={{ background: stepperBtn, color: textSecondary }}
              >
                −
              </button>
              <span
                className="w-6 text-center text-[13px] font-mono font-bold tabular-nums"
                style={{ color: isDark ? '#F5F2FD' : '#1C1C28' }}
              >
                {n}
              </span>
              <button
                type="button"
                onClick={() => bump(p.code, 1)}
                disabled={n >= 99}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[13px] font-bold disabled:opacity-30"
                style={{ background: stepperBtn, color: textSecondary }}
              >
                +
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}

function computeCockpitCount(
  key: 'standard' | 'aug1' | 'aug2' | 'custom',
  counts: Record<string, number> | null,
): number {
  if (key === 'custom') {
    if (!counts) return 2
    return (counts.CP ?? 0) + (counts.FO ?? 0) + (counts.SO ?? 0) + (counts.CM ?? 0)
  }
  return key === 'aug2' ? 4 : key === 'aug1' ? 3 : 2
}

function makePairingCode(f: PairingFlight): string {
  const letter = (f.departureAirport || 'X').charAt(0).toUpperCase()
  const numericMatch = f.flightNumber.match(/\d+/)
  const num = numericMatch ? numericMatch[0] : f.flightNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)
  return `${letter}${num}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function formatBlock(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
