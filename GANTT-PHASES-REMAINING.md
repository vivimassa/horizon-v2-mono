# Mobile Gantt — Remaining Phases (4–9)

Module 1.1.2 Schedule Gantt port. Phases 0–3 shipped:

- **Phase 0** — shared logic in `packages/types/src/gantt.ts`, `packages/logic/src/utils/gantt-{time,colors,hit-testing,layout}.ts`. Web `apps/web/src/lib/gantt/{types,time-axis,colors,hit-testing,layout-engine}.ts` are now thin re-exports. Single source of truth.
- **Phase 1** — Skia canvas + pan/pinch + sticky time header + sticky row labels + filter sheet + toolbar (read-only) + route entry. Files under `apps/mobile/src/components/gantt/`, `apps/mobile/src/lib/gantt/`, `apps/mobile/src/stores/use-mobile-gantt-store.ts`. API client extended with `api.getGanttFlights`, `api.ganttAssignFlights`, `api.ganttUnassignFlights`.
- **Phase 2** — Detail bottom sheet with Flight / Cycle / Aircraft / Day tabs (`gantt-detail-sheet.tsx` + `detail/{flight,cycle,aircraft,day}-tab.tsx` + `detail/detail-helpers.ts`, `detail-ui.tsx`). Time-header tap → day. Focus highlights on canvas.
- **Phase 3** — Long-press selection mode: jiggle (Reanimated `useFrameCallback` + per-bar Skia `Group transform` rotation), `SelectionActionBar` slide-down with Select All → Selected Day / Entire Period scope picker, tap-toggle during selection, haptic on entry, Done clears.

Below: phases 4–9 ready to execute. Each phase lists its tasks, files to touch / create, acceptance, and gotchas.

---

## Phase 4 — Toolbar + Polish + Color Modes (3–4 days)

**Goal:** parity with web read-only feature set. Production-grade rendering.

### Tasks

1. **Toolbar full controls** — extend `apps/mobile/src/components/gantt/gantt-toolbar.tsx`:
   - Search button → opens `gantt-search-sheet.tsx` (new) — `BottomSheetView` with `TextInput`, filtered `FlatList` of flights matching number / route / aircraft. Tap result → set scrollX/scrollY shared values to bring bar into viewport (use `utcToX(stdUtc, startMs, pph)` minus half viewport width for centering) + dispatch `openDetailSheet({kind:'flight', flightId})`.
   - TAT toggle (`showTat` already in store from Phase 1 store skeleton; if missing add it) — when on, draw TAT minutes between consecutive bars on same row.
   - Slot risk toggle — when on, draw a thin colored bar above flight bars colored by `slotRiskLevel`.
   - Missing-times toggle — when on, draw orange triangle flags at corners of bars missing OOOI given current `oooiGraceMins`.
   - Delays toggle — when on, draw red dot + minutes label above bars with `delays` array.
   - Refresh, Go-to-today, Fullscreen, Help — refresh exists, add the others.
2. **Color modes** — toggle in filter sheet (segmented control) writes `colorMode` to store. Already wired through layout engine; just add UI.
3. **Bar label modes** — flight number vs sector. `barLabelMode` already in store + layout. Add toggle to filter sheet.
4. **Row height levels** — toolbar already cycles 0–3.
5. **Slot risk lines + missing-time flags + overlap warnings + TAT labels** — implement in `apps/mobile/src/lib/gantt/draw.tsx` as new `<TatLabelsLayer>`, `<SlotRiskLayer>`, `<MissingTimesLayer>`, `<DelaysLayer>` components.
6. **Virtual draw** — already culling bars by viewport. Confirm row culling. Profile with Skia debug via `<Canvas debug={__DEV__}>`.
7. **Empty / loading / error states** — already in `gantt-shell.tsx`. Polish copy + add empty-state illustration if available in `@skyhub/ui`.
8. **Now-line auto-advance** — already recomputed every render of canvas via `useMemo`. Force a re-render every 60s via a `useEffect` interval bumping a tick state.
9. **Orientation** — add `useWindowDimensions` listener; row label width: 96 in landscape, 76 in portrait; recompute layout when width changes (already wired via `setContainerSize`).
10. **Search bottom sheet** — already covered above.

### Files

- Edit: `gantt-toolbar.tsx`, `gantt-filter-sheet.tsx`, `lib/gantt/draw.tsx`, `gantt-shell.tsx`, `use-mobile-gantt-store.ts`.
- New: `gantt-search-sheet.tsx`.

### Acceptance

- 60 fps with 1000+ flights, all overlays on.
- Color modes correct in dark + light.
- Search jumps to flight + opens sheet.

### Gotchas

- TAT needs flight ordering by `aircraftReg` + `stdUtc` per row. Compute once at layout time and store on `BarLayout` extension OR pre-compute a map in `draw.tsx`.
- Skia `Text.measureText` is expensive. Pre-measure labels at zoom-change time, not per frame.

---

## Phase 5 — Mutations: Drag, Cancel, Reschedule, Swap, Diversion, Add Flight (7–10 days)

**Goal:** tablet becomes a control surface.

### Tasks

1. **Drag-to-assign** —
   - Distinguish from selection long-press: enter "drag" only when long-press fires AND finger moves > 10 px.
   - During drag: ghost bar follows finger via Reanimated SharedValue; render in canvas as a translucent overlay group; source row dashed; target row accent border; invalid (wrong AC type / overlap with TAT buffer) red.
   - On drop: optimistic patch via `forcedPlacements` map → `recomputeLayout()`; call `api.ganttAssignFlights(operatorId, [flightId], targetReg)`; on failure revert + toast.
   - Multi-flight: if `selectionMode + selectionConfirmed`, dragging one moves all `selectedFlightIds`.
2. **Cancel** — `dialogs/cancel-sheet.tsx`. Date picker for "from this date forward" range, reason textarea, confirm → `api.cancelFlights` (web's PATCH `/gantt/remove-from-date` — add to `packages/api/src/client.ts`). Show slot impact preview via `api.fetchCancelImpact`.
3. **Reschedule** — `dialogs/reschedule-sheet.tsx`. New STD picker (HH:MM), propagate-to-rotation toggle. Web equivalent: `gantt-reschedule-dialog.tsx`. Reuse server endpoint.
4. **Swap** — `dialogs/swap-sheet.tsx`. Two flights selected → action bar "Swap" button → preview both bars + confirm. `api.swapFlights`.
5. **Diversion** — `dialogs/diversion-sheet.tsx`. New arrival airport autocomplete + reason. Reuse server endpoint.
6. **Add Flight** — toolbar "+" button → `dialogs/add-flight-sheet.tsx`. Number, route (DEP/ARR airport pickers), date, AC type, schedule (STD HH:MM, STA HH:MM). Web equivalent: `add-flight-panel.tsx`.
7. **Bulk assign popover** — for selection mode → action bar "Assign" button → `dialogs/assign-sheet.tsx` listing aircraft of matching type + tap-to-assign. `api.ganttAssignFlights` already in client.
8. **Aircraft context** — long-press on row label opens a small action sheet: Block all / Maintenance / Unassign all / View aircraft. Use `Gesture.LongPress` on `gantt-row-labels.tsx`.
9. **Day context** — long-press on time-header day opens action sheet: Cancel all this day / Bulk reassign.
10. **Mutation pipeline** — all mutations: optimistic store patch → server call → on success refetch the period (`commitPeriod`) → on failure revert + toast.

### Files

- New: `dialogs/{cancel,reschedule,swap,diversion,add-flight,assign}-sheet.tsx`. Each ≤ 250 LOC.
- Edit: `gantt-canvas.tsx` (drag overlay, drag detection), `selection-action-bar.tsx` (Assign / Swap / Cancel buttons), `gantt-toolbar.tsx` (+ button), `gantt-row-labels.tsx` (long-press), `gantt-time-header.tsx` (long-press), `lib/gantt/draw.tsx` (ghost bar + dashed source row + target highlight layers), `packages/api/src/client.ts` (add `ganttCancelFlights`, `ganttRescheduleFlights`, `ganttSwapFlights`, `ganttDivertFlight`, `ganttCreateFlight`, `ganttFetchCancelImpact`).

### Acceptance

- Drag-assign optimistic; reverts cleanly on API failure.
- All dialogs are bottom sheets (no modal popups).
- Add-flight new bar appears immediately at correct row + position.

### Gotchas

- Drag gesture must coexist with pan + pinch + tap + long-press. Use `Gesture.Race(longPress, pan)` so the longer-held one wins, then if movement > 10 px transition to drag mode (track in a SharedValue `dragArmed`).
- `forcedPlacements` already supported by `computeLayout()` — pass into layout input on optimistic update.
- `api.cancelFlights` endpoint name on server is `/gantt/remove-from-date` (not `/gantt/cancel`).

---

## Phase 6 — Flight Information Sheet (8 tabs) (5–7 days)

**Goal:** full editor reachable from a flight bar's "Edit" action.

### Tasks

1. `flight-information-sheet.tsx` — full-height bottom sheet (95% snap), tab bar, info header (route + identity strip).
2. Tab files under `apps/mobile/src/components/gantt/info/{times,delays,passengers,fuel-cargo,crew,memos,messages,audit}-tab.tsx`.
3. **Times tab** — edit STD/STA/ETD/ETA/ATD/OFF/ON/ATA. HH:MM time picker (use `@react-native-community/datetimepicker` if not present). Per-field save on blur or batched on tab dismiss.
4. **Delays tab** — list `flight.delays`, add via picker over delay-codes master data (existing screen pattern in `apps/mobile/app/(tabs)/settings/activity-codes.tsx`).
5. **Passengers tab** — pax counts (adult/child/infant expected vs actual), load factor.
6. **Fuel/Cargo tab** — fuel burn, cargo weight.
7. **Crew tab** — list crew assignments, add jumpseater button.
8. **Memos tab** — text-area edits, add / delete.
9. **Messages tab** — read-only list of messages to/from crew.
10. **Audit tab** — read-only timeline of changes.
11. Save per tab via existing or new endpoints; web's `apps/web/src/lib/gantt/flight-detail-api.ts` is the reference. Move shared logic to `packages/logic/src/utils/flight-detail-*` if cross-app reuse.

### Files

- New: `flight-information-sheet.tsx` + 8 tab files.
- Edit: `gantt-detail-sheet.tsx` — add "Edit details" button on Flight tab that opens `flight-information-sheet`.
- Edit: `packages/api/src/client.ts` — add per-tab mutation endpoints.

### Acceptance

- Edits persist; bar shifts on STD change.
- Tab swipes don't lose unsaved edits (warn + confirm).

---

## Phase 7 — Scenario, Compare, Optimizer (7–10 days)

**Goal:** advanced workflows. Heaviest dialogs on web. Optional — may ship without these and revisit.

### Tasks

1. **Scenario panel sheet** — list `api.getScenarios`, switch active (`store.scenarioId`), create new, archive.
2. **Compare dialog** — side-by-side scenario diff. Tablet-only (split view). Re-uses two parallel layout computes + diff highlight.
3. **Optimizer** — port web's tail-optimizer wizard from `apps/web/src/lib/gantt/tail-optimizer.ts` + `optimizer-dialog.tsx` (39 KB). Move tail-optimizer to `packages/logic` first. May need its own sub-phase.

### Files

- New: `dialogs/scenario-sheet.tsx`, `dialogs/compare-sheet.tsx`, `dialogs/optimizer-sheet.tsx`.
- Move: `apps/web/src/lib/gantt/tail-optimizer.ts` → `packages/logic/src/utils/tail-optimizer.ts` with web re-export.

---

## Phase 8 — Phone Variant (3 days)

**Goal:** read-only Gantt on phones (< 768 px).

### Tasks

1. Branch on `useResponsive().isTablet` in `gantt-shell.tsx`.
2. Phone path:
   - No drag, no assign, no add (toolbar buttons hidden).
   - Tap → detail sheet only. Long-press → detail sheet (no selection mode).
   - Single column row labels (registration only, no type name).
   - Default zoom: `1D`.
   - Filter sheet stays.
3. Hide selection action bar entirely on phone.
4. Hide all mutation dialogs on phone.

### Files

- Edit: `gantt-shell.tsx`, `gantt-canvas.tsx` (skip long-press wiring), `gantt-toolbar.tsx` (skip + button), `gantt-row-labels.tsx` (compact mode).

---

## Phase 9 — Offline + Sync (5 days)

**Goal:** WatermelonDB-backed Gantt. CLAUDE.md rule 13.

### Tasks

1. **WatermelonDB models** — `GanttFlightInstance` (mirrors `GanttFlight`), reuse existing `AircraftRegistration`, `AircraftType`. Schema migration in mobile's WatermelonDB schema folder (find via `apps/mobile/src/database/`).
2. **Fetch flow** — on `commitPeriod`: API → write to WatermelonDB → read from local DB into store.
3. **Offline reads** — if offline (use existing network detection), query WatermelonDB directly; flag store with `isStale`.
4. **Mutation queue** — write change to WatermelonDB with `pendingSync: true` flag → push when online.
5. **Conflict resolution** — server wins on assignment conflict (another user assigned same flight). Local edits not yet pushed → keep local, surface badge.
6. **Sync indicator** — small badge in toolbar showing `Synced` / `Pending changes (N)` / `Offline`.

### Files

- New: WatermelonDB model + schema migration. `apps/mobile/src/lib/gantt/sync.ts` for queue logic. Toolbar sync badge.
- Edit: `use-mobile-gantt-store.ts` — wire WatermelonDB reads/writes around the API calls.

---

## Cross-cutting

- **Performance budget**: single canvas, single draw pass per frame; layout memoized; offscreen culled; jiggle drives only matched bars.
- **400-line rule per file** (CLAUDE.md). Split tabs / dialogs into one file each.
- **Theming**: all colors via `useAppTheme()` palette + accent. Status / slot / type colors from `@skyhub/logic` (gantt-colors).
- **Telemetry**: hook into existing analytics stub. Track period commits, sheet opens, drag-assigns, scenario switches, optimizer runs.

## Verification (each phase)

1. `npx tsc --noEmit` from `apps/mobile/` — green (ignore the small pool of pre-existing errors elsewhere).
2. Run on iPad simulator + physical iPad. Test pan, pinch, all gestures.
3. Run web `/network/schedule/gantt` to confirm shared-package extraction didn't regress.
4. Profile FPS in Skia debug overlay — target 55 fps with 500 flights / 50 aircraft.
5. Dark + light + landscape + portrait visual pass.

## Smoke test (after Phase 5)

1. Login → Network → Gantt.
2. Pick 7-day period, AC type filter A320 family, hit Go.
3. Bars render grouped by AC type, scroll to today.
4. Tap bar → sheet on Flight tab → swipe to Cycle tab → close.
5. Long-press bar → jiggle → Select All → Selected Day → cycle sheet opens.
6. Drag bar to a different aircraft row → assignment confirmed via toast.
7. Toolbar refresh → state preserved.

## Out of scope (v1)

- Print / PDF export.
- Keyboard shortcuts (no keyboard primary path on iPad).
- Realtime WebSocket; poll-on-focus instead.
- Crew pairing Gantt rows — separate feature, not 1.1.2.

---

## File map (current state, end of Phase 3)

```
packages/types/src/gantt.ts                              [Phase 0]
packages/logic/src/utils/gantt-time.ts                   [Phase 0]
packages/logic/src/utils/gantt-colors.ts                 [Phase 0]
packages/logic/src/utils/gantt-hit-testing.ts            [Phase 0]
packages/logic/src/utils/gantt-layout.ts                 [Phase 0]

apps/web/src/lib/gantt/{types,time-axis,colors,
  hit-testing,layout-engine}.ts                          [thin re-exports]

apps/mobile/app/(tabs)/network/gantt.tsx                 [Phase 1, route entry]
apps/mobile/src/stores/use-mobile-gantt-store.ts         [Phase 1+3]
apps/mobile/src/lib/gantt/draw.tsx                       [Phase 1+3 jiggle]
apps/mobile/src/components/gantt/
  gantt-shell.tsx                                        [Phase 1, mounts everything]
  gantt-scroll-context.tsx                               [Phase 1]
  gantt-canvas.tsx                                       [Phase 1+2+3]
  gantt-time-header.tsx                                  [Phase 1+2]
  gantt-row-labels.tsx                                   [Phase 1]
  gantt-toolbar.tsx                                      [Phase 1]
  gantt-filter-sheet.tsx                                 [Phase 1]
  gantt-detail-sheet.tsx                                 [Phase 2]
  selection-action-bar.tsx                               [Phase 3]
  detail/
    detail-helpers.ts                                    [Phase 2]
    detail-ui.tsx                                        [Phase 2]
    flight-tab.tsx                                       [Phase 2]
    cycle-tab.tsx                                        [Phase 2]
    aircraft-tab.tsx                                     [Phase 2]
    day-tab.tsx                                          [Phase 2]

apps/mobile/lib/hub-route-map.ts                         [/network/control/schedule-gantt → /(tabs)/network/gantt]
apps/mobile/app/(tabs)/network/index.tsx                 [1.1.2 card route wired]

packages/api/src/client.ts                               [+ getGanttFlights, ganttAssignFlights, ganttUnassignFlights]
```

## Plan reference

Full architectural plan: `C:\Users\ADMIN\.claude\plans\now-onto-the-biggest-agile-fiddle.md`.
