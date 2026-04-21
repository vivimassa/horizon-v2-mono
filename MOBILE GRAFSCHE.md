# Mobile Graphical Crew Schedule — Implementation Plan (4.1.6 · apps/mobile)

> **STATUS: DEFERRED** (as of 2026-04-21)
>
> Mobile work on 4.1.6 is on hold. The team is focusing on shipping the full **web** experience first (Phases 2 → 4 from the main plan). Pick up this document when web Phase 2 (drag-to-assign + block ops + planner swap) lands, at which point the data model / store / pure layout engine will be stable enough to mirror on mobile without churn.
>
> Nothing in this document is invalidated by the web-first pivot — all prep steps (M1.0 shared-package relocation, tech-baseline installs, schema planning) are still the right things to do when mobile resumes. Preserving this file as a head-start for that sprint.

---

## Prerequisites before resuming mobile work

When mobile work restarts, re-verify these web-side items are in place (they harden the shared layer mobile will import):

- [ ] `layout.ts` moved from `apps/web/src/lib/crew-schedule/` to `packages/logic/src/crew-schedule/layout.ts` (M1.0)
- [ ] `use-crew-schedule-store.ts` moved to a shared `packages/stores/` (M1.0)
- [ ] All web phases ≤ 2 shipped — so the mobile clone doesn't chase a moving target
- [ ] `SwapRequest` model + endpoints (from main plan Phase 3.5) exist, since mobile crew-app is where swap requests are composed
- [ ] Memo system (Phase 4.4) at least scoped — mobile will render memo dots

---

## 1 · Intent

Port Crew Schedule 4.1.6 to the existing Expo app so planners can run the schedule from an iPad or phone, and so crew members can request swaps from their own device. The mobile build reuses **all non-UI code** from the web: pure layout engine, API client, seat-eligibility, Zustand store. Only the rendering surface and the gestures change.

The quality bar: **native-feeling gestures** — smooth pinch zoom at 60 fps, 120 Hz pan on ProMotion devices, haptic feedback on long-press, no jank with 8000+ crew.

---

## 2 · Tech Baseline (as-of 2026-04-21)

`apps/mobile/package.json`

| Dep                            | Present | Needed    | Purpose                                       |
| ------------------------------ | ------- | --------- | --------------------------------------------- |
| `expo`                         | 54.0    | ✓         | Dev client rebuild after adding native libs   |
| `react-native`                 | 0.81    | ✓         |                                               |
| `react-native-reanimated`      | 4.3     | ✓         | Worklet animations, gesture driver            |
| `react-native-gesture-handler` | —       | **~2.20** | Pan, pinch, long-press, simultaneous gestures |
| `@shopify/react-native-skia`   | —       | **~1.7**  | Canvas — bars, time axis, rest stripes        |
| `@gorhom/bottom-sheet`         | —       | **~5.0**  | Action / filter / inspector sheets            |
| `expo-haptics`                 | —       | **~14.0** | `selectionAsync()` on long-press              |
| `@nozbe/watermelondb`          | —       | **~0.27** | Offline read cache (writes still online)      |

**Ordering**: install in one commit, then `eas build --profile development` to produce a dev-client with the native modules linked. All three (GH / Skia / Bottom-sheet) require native linking.

---

## 3 · Architecture

### 3.1 Shared code (zero changes needed)

These live in monorepo packages and the web app; mobile imports them as-is:

| Location                                               | What mobile uses                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/api/src/client.ts`                           | `api.getCrewSchedule`, `createCrewActivity`, `createCrewAssignment`, etc.                                                   |
| `packages/logic/src/crew-schedule/seat-eligibility.ts` | Downrank-aware seat eligibility                                                                                             |
| `packages/logic/src/fdtl/validator.ts`                 | Legality checks                                                                                                             |
| `apps/web/src/lib/crew-schedule/layout.ts`             | **Pure** layout engine — moved to `packages/logic/src/crew-schedule/layout.ts` as part of P1.0 so mobile can import cleanly |
| `apps/web/src/stores/use-crew-schedule-store.ts`       | Zustand store — no DOM deps; **also moves to** `packages/stores/use-crew-schedule-store.ts` so both apps share one truth    |

> **Prep step (P1.0)** before any mobile work: relocate `layout.ts` and `use-crew-schedule-store.ts` to shared packages. Web imports rewrite; no behavior change.

### 3.2 Mobile-only code

All under `apps/mobile/src/features/crew-schedule/`:

```
crew-schedule/
├─ index.tsx                         — screen entry (expo-router route)
├─ crew-schedule-screen.tsx          — orchestrator (fetch + layout + regions)
├─ gantt/
│  ├─ gantt-canvas.tsx               — Skia Canvas root
│  ├─ gantt-bars.tsx                 — pairing + activity bar draw calls
│  ├─ gantt-rest-strips.tsx          — diagonal rest pattern
│  ├─ gantt-time-axis.tsx            — day header
│  ├─ gantt-grid.tsx                 — weekend shading + gridlines
│  ├─ use-gantt-gestures.ts          — composed gesture definitions
│  └─ use-gantt-scroll.ts            — scroll shared values + bounds
├─ left-panel/
│  ├─ crew-rail.tsx                  — virtualized crew column (FlashList)
│  └─ crew-row.tsx                   — memo'd row
├─ sheets/
│  ├─ action-sheet.tsx               — target-dispatched actions (§2 of web plan)
│  ├─ filter-sheet.tsx               — Period / Base / Position / AC Type
│  ├─ inspector-sheet.tsx            — Duty/Assign/Bio/Expiry tabs
│  ├─ activity-picker-sheet.tsx      — group-collapsed list identical to web
│  ├─ uncrewed-sheet.tsx             — uncrewed pairings chips
│  └─ swap-compose-sheet.tsx         — crew-facing swap request (Phase 3.5)
├─ toolbar/
│  ├─ schedule-header.tsx            — top bar (period label, filter, 🔍, more)
│  └─ format-sheet.tsx               — mobile equivalent of Format popover
├─ db/
│  ├─ schema.ts                      — WatermelonDB tables
│  ├─ models.ts                      — CrewAssignment, CrewActivity, Pairing, CrewMember (read cache)
│  └─ sync-crew-schedule.ts          — pull-only sync using packages/api
└─ hooks/
   ├─ use-schedule-data.ts           — online fetch + cache hydrate
   ├─ use-fit-to-viewport.ts         — layout width measurement
   └─ use-keyboard-noop.ts           — mobile has no keyboard shortcuts; stubs the web ones
```

### 3.3 Routing (Expo Router)

```
apps/mobile/app/
├─ (tabs)/
│  └─ crew-ops/
│     └─ crew-schedule.tsx           — exports <CrewScheduleScreen />
```

Tab already exists (`apps/mobile/app/(tabs)/crew-ops/`). Just add this file as one more screen.

---

## 4 · Canvas with Skia

### 4.1 Why Skia (not View-based)

8000+ bars rendered as `<View>` would crush the bridge. Skia draws to a GPU-backed surface in a single Reanimated worklet — 60 fps target.

### 4.2 Component tree

```tsx
<Canvas style={{ flex: 1 }} onLayout={measure}>
  <Group transform={[{ translateX: -scrollX.value }, { translateY: -scrollY.value }]}>
    <GanttGrid /> {/* weekend shading + verticals */}
    <GanttBars /> {/* iterates layout.bars + layout.activityBars */}
    <GanttRestStrips /> {/* diagonal pattern for rest gaps */}
  </Group>
  <GanttTimeAxis /> {/* sticky top; reads scrollX only */}
  <NowLine />
</Canvas>
```

Each of `GanttGrid`, `GanttBars`, etc. is a Skia `<Group>` that reads the same `layout` object the web uses. Reanimated `useSharedValue` holds `scrollX` and `scrollY`.

### 4.3 Draw helpers

Port `drawBar`, `drawActivityBar`, `drawRoundedRect` from `apps/web/src/components/crew-ops/schedule/crew-schedule-canvas.tsx` to Skia primitives (`<RoundedRect>`, `<Text>`, `<Paint>`). Keep signatures pure; most code is 1:1 except `ctx.measureText` → `Skia.Font.measureText`.

### 4.4 Rest stripe pattern

Reusable shader:

```tsx
const stripeShader = Skia.Shader.MakeLinearGradient(
  { x: 0, y: 0 },
  { x: 6, y: 6 },
  [Skia.Color('rgba(154,155,168,0.22)'), Skia.Color('rgba(154,155,168,0.08)')],
  [0, 1],
  TileMode.Repeat,
)
```

Applied as `<Paint shader={stripeShader} />` on each rest rect.

---

## 5 · Gestures (`use-gantt-gestures.ts`)

Gesture Handler lets us compose simultaneous + exclusive gestures. One file owns them all:

| Gesture                       | Handler                                          | Bound shared values     | Notes                                                 |
| ----------------------------- | ------------------------------------------------ | ----------------------- | ----------------------------------------------------- |
| 1-finger pan (scroll)         | `Gesture.Pan()`                                  | `scrollX`, `scrollY`    | Deceleration via Reanimated `withDecay`               |
| 2-finger pinch X (range zoom) | `Gesture.Pinch()` + focal-point math             | `pph`                   | Debounced 150 ms — applied to store on release        |
| 2-finger pinch Y (row zoom)   | Same pinch, separate handler                     | `rowHeightLevel`        | Axis with larger delta wins                           |
| Long-press                    | `Gesture.LongPress().minDuration(500)`           | target id, pageX, pageY | Fires `Haptics.selectionAsync()` + opens action sheet |
| Double-tap (empty cell)       | `Gesture.Tap().numberOfTaps(2).maxDuration(300)` | —                       | Opens activity picker sheet                           |
| Long-press-drag (move bar)    | `Gesture.LongPress().then(Gesture.Pan())`        | drag state              | After 500 ms hold, drag kicks in                      |

Composition:

```ts
Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(longPressDrag, longPress, doubleTap))
```

The exclusive cluster ensures long-press-drag wins over plain long-press when the finger moves.

### Pull-to-refresh

Only when `scrollY.value === 0`. Detect with Reanimated `useAnimatedReaction`; show Gluestack `Spinner` above the time axis; on release past threshold call `commitPeriod()` from store.

### Edge auto-scroll while dragging

When a long-press-drag's finger is within 80 px of any viewport edge, increment `scrollX`/`scrollY` by `4 px × frame` (worklet). Stops on release.

---

## 6 · Bottom Sheets

All user-invoked surfaces on mobile are `@gorhom/bottom-sheet` instances. Three-snap-point pattern:

| Sheet                                       | Snap points           | Opens on                                               |
| ------------------------------------------- | --------------------- | ------------------------------------------------------ |
| Action sheet (context menu)                 | `40%` · `70%`         | Long-press any target                                  |
| Activity picker                             | `60%` · `95%`         | Double-tap empty cell · action sheet → Assign Activity |
| Filter sheet                                | `50%` · `90%`         | Header filter button · left-edge swipe                 |
| Inspector sheet                             | `35%` · `65%` · `95%` | Tap a bar (landscape uses side-sheet instead)          |
| Uncrewed sheet                              | `25%` · `75%`         | Header icon                                            |
| Format sheet (row height / range / refresh) | `45%` only            | Header Format button                                   |

All sheets render the same items as their web counterparts. Action items dispatch to the shared store actions.

### Inspector responsive behavior

- **Portrait**: bottom sheet (3 snaps). Dragging the handle above the top snap pushes canvas to fill remaining height.
- **Landscape** (planner use case on iPad): 360 px right sidebar, identical to web.

Detection via `useWindowDimensions()` + aspect-ratio check.

---

## 7 · State (shared store)

`packages/stores/use-crew-schedule-store.ts` (shared with web) gains nothing new for mobile — mobile reuses:

- `selectedCrewId`, `selectedPairingId`, `selectedActivityId`, `selectedDateIso`
- `contextMenu: { kind, targetId, crewId, pageX, pageY } | null`
- `filters`, `zoom`, `barLabelMode`, `rowHeightLevel`, `refreshIntervalMins`
- Actions: `selectCrew`, `selectPairing`, `selectActivity`, `selectDateCell`, `openContextMenu`, `closeContextMenu`, `commitPeriod`, `setFilters`, …

Mobile-only additions live in a thin wrapper `use-crew-schedule-store-mobile.ts`:

- `sheetOpen: 'action' | 'filter' | 'inspector' | 'picker' | 'format' | 'uncrewed' | null`
- `openSheet(sheet)`, `closeSheet()`
- Viewport orientation ref for responsive decisions

---

## 8 · Offline Read Cache (WatermelonDB)

### 8.1 Tables

```ts
// apps/mobile/src/features/crew-schedule/db/schema.ts
export const crewScheduleSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'crew_members',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'employee_id', type: 'string' },
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'base', type: 'string', isOptional: true, isIndexed: true },
        { name: 'position', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'seniority', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'pairings',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'scenario_id', type: 'string', isOptional: true },
        { name: 'pairing_code', type: 'string' },
        { name: 'base_airport', type: 'string' },
        { name: 'aircraft_type_icao', type: 'string', isOptional: true },
        { name: 'fdtl_status', type: 'string' },
        { name: 'start_date', type: 'string', isIndexed: true },
        { name: 'end_date', type: 'string' },
        { name: 'report_time', type: 'string', isOptional: true },
        { name: 'legs_json', type: 'string' },
        { name: 'crew_counts_json', type: 'string' },
        { name: 'updated_at', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'crew_assignments',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'crew_id', type: 'string', isIndexed: true },
        { name: 'pairing_id', type: 'string', isIndexed: true },
        { name: 'seat_position_id', type: 'string' },
        { name: 'seat_index', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'start_utc_iso', type: 'string' },
        { name: 'end_utc_iso', type: 'string' },
        { name: 'updated_at', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'crew_activities',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'crew_id', type: 'string', isIndexed: true },
        { name: 'activity_code_id', type: 'string' },
        { name: 'start_utc_iso', type: 'string' },
        { name: 'end_utc_iso', type: 'string' },
        { name: 'date_iso', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'activity_codes',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'group_id', type: 'string' },
        { name: 'code', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'short_label', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
      ],
    }),
  ],
})
```

### 8.2 Sync strategy

**Pull-only** for Phase 1. After a successful `api.getCrewSchedule()`:

1. Begin WDB transaction.
2. Upsert pairings / crew / assignments / activities / codes for that period.
3. Commit.

On app start (offline detected): read from WDB for the last-loaded period, render immediately, then retry network silently.

**Writes** (create/delete assignment, create activity, swap, etc.) call the API directly. Failure → toast with "Retry" that re-submits. No write queue in Phase 1.

### 8.3 Store integration

```ts
// use-schedule-data.ts
export function useScheduleData() {
  const periodFrom = useCrewScheduleStore((s) => s.periodFromIso)
  const periodTo = useCrewScheduleStore((s) => s.periodToIso)

  return useQuery({
    queryKey: ['crew-schedule', periodFrom, periodTo],
    queryFn: async () => {
      try {
        const res = await api.getCrewSchedule({ from: periodFrom, to: periodTo })
        await hydrateCacheFromResponse(res)
        return res
      } catch (e) {
        // offline? fall back to cache
        const cached = await readFromCache(periodFrom, periodTo)
        if (cached) return cached
        throw e
      }
    },
  })
}
```

---

## 9 · Phase Breakdown (mobile only)

### Phase M1 — Read-only view (3 sprints)

| Ticket | Work                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| M1.0   | Relocate `layout.ts` + `use-crew-schedule-store.ts` to shared packages; web import rewrite |
| M1.1   | Install native deps; `eas build --profile development`; verify app opens                   |
| M1.2   | WatermelonDB schema + models + adapter init in `apps/mobile/src/db/index.ts`               |
| M1.3   | Expo Router tab screen skeleton; calls `api.getCrewSchedule` online; Zustand store wired   |
| M1.4   | Skia canvas — grid + bars + rest strips (read-only)                                        |
| M1.5   | Virtualized crew rail (FlashList, same patterns as web virtualized panel)                  |
| M1.6   | Header bar: period label + filter button + format button + search button                   |
| M1.7   | 1-finger pan (X and Y); basic scroll bounds                                                |
| M1.8   | WDB cache hydrate / read path; offline smoke test                                          |

Ship target: open the app offline, see yesterday's roster rendered.

### Phase M2 — Interactivity + action sheets (2–3 sprints)

| Ticket | Work                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| M2.1   | Long-press on pairing bar → action sheet with §2A items; route to store actions    |
| M2.2   | Long-press on activity bar → §2B                                                   |
| M2.3   | Long-press on crew name → §2E                                                      |
| M2.4   | Long-press on empty cell → §2C                                                     |
| M2.5   | Long-press on date header → §2D                                                    |
| M2.6   | Double-tap on empty cell → activity-picker sheet                                   |
| M2.7   | Inspector sheet (Duty / Assign / Bio / Expiry) — reuse right-panel markup patterns |
| M2.8   | Activity picker sheet — single-column, collapsible groups, 44 pt rows              |
| M2.9   | Filter sheet — Period / Base / Position / AC Type                                  |
| M2.10  | Uncrewed sheet — pairing chips                                                     |
| M2.11  | Format sheet — row height + range + refresh (reuse shared FormatPopover contract)  |

### Phase M3 — Advanced gestures (2 sprints)

| Ticket | Work                                                                       |
| ------ | -------------------------------------------------------------------------- |
| M3.1   | Pinch-horizontal = zoom range (debounced, commits on release)              |
| M3.2   | Pinch-vertical = zoom row height                                           |
| M3.3   | Two-finger pan (redundant with pinch gesture but improves discoverability) |
| M3.4   | Long-press-drag pairing bar → Move to another crew; drop target highlight  |
| M3.5   | Edge auto-scroll during drag                                               |
| M3.6   | Haptics + visual selection ring on long-press                              |
| M3.7   | Date range selection: action sheet → "Start range here" → tap end date     |
| M3.8   | Pull-to-refresh                                                            |

### Phase M4 — Crew-facing swap requests (1–2 sprints, see plan Phase 3.5)

| Ticket | Work                                                              |
| ------ | ----------------------------------------------------------------- |
| M4.1   | `swap-compose-sheet.tsx` — crew picks target pairing to swap with |
| M4.2   | Render pending swap request indicators on affected bars           |
| M4.3   | Notifications when planner responds (Expo Notifications stubbed)  |

### Phase M5 — Polish + accessibility (1 sprint)

| Ticket | Work                                                                           |
| ------ | ------------------------------------------------------------------------------ |
| M5.1   | VoiceOver / TalkBack labels on every bar, sheet item, row                      |
| M5.2   | Dynamic type support (iOS)                                                     |
| M5.3   | Dark mode parity with web (already driven by store)                            |
| M5.4   | Landscape inspector side-sheet                                                 |
| M5.5   | iPad trackpad/pointer handling (hover → highlight; right-click → action sheet) |

---

## 10 · Performance Budget

| Metric                                | Target                               | Why                                                                 |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Gantt 60 fps during pan               | < 16 ms per frame                    | Matches web                                                         |
| Gantt 120 fps on ProMotion during pan | < 8 ms                               | iPad Pro planners                                                   |
| Bars drawn at 8000 crew × 30 days     | < 60 ms frame budget                 | Needs culling by viewport row range + day range (already in layout) |
| Long-press latency                    | 500 ms threshold (industry standard) | Any lower = conflicts with scroll                                   |
| Pinch → zoom commit                   | 150 ms debounce                      | Avoids thrashing layout rebuild                                     |
| Cold-start to first paint (cached)    | < 1.5 s                              | WDB hydrate + Skia init                                             |

### Optimizations

- Skia `<Group>` with `transform` translates on scroll — one matrix multiply, no per-bar re-layout.
- Layout engine already returns pure arrays; memoize by `{period, zoom, filters, rowHeightLevel, containerWidth}`.
- FlashList for the crew rail (`estimatedItemSize=rowH`) — far faster than FlatList for 8000+ items.
- Defer icon rendering on crew rows until dwell > 300 ms (saves draw on fast scrolls).

---

## 11 · Accessibility

- Every Skia bar wrapped in an invisible `<Pressable accessibilityLabel>` sized to the bar — screen readers announce "Pairing P4180, SGN to HAN, reports 0600 UTC, 4 sectors".
- Sheets use Gluestack primitives with built-in accessibility.
- Minimum touch target 44×44 pt enforced via a transparent hit layer on bars shorter than that (see web left panel's `contain: layout style` analog).
- Reduced-motion: disable gesture deceleration and sheet bounce when `AccessibilityInfo.isReduceMotionEnabled()` is true.
- High-contrast: CLAUDE.md tokens already provide dark/light; we don't introduce non-token colors in mobile.

---

## 12 · Testing

- **Unit**: layout engine + seat eligibility (already tested on web).
- **Integration (Detox or Maestro)**: long-press on bar → action sheet opens → Delete → bar removed.
- **Gesture regression (Jest + Reanimated mocks)**: verify pinch handler updates `pph` within bounds.
- **Device matrix**: iPhone 14 (iOS 17), iPhone SE 2022 (smallest), iPad Pro 11" (landscape flagship), Pixel 7 (Android 14), Galaxy A54 (mid-range Android).
- **Offline smoke**: toggle airplane mode after loading → pan/zoom still works from cache.

---

## 13 · Rollout

- Feature-flag: `ENABLE_MOBILE_CREW_SCHEDULE` in `packages/env` — default off; enable per operator via server config.
- Staged rollout: internal → pilot operator → GA.
- Sentry: new transaction `mobile.crew-schedule.render` with `rowCount`, `barCount`, `frameDropCount` attributes.
- Crash-free rate target: ≥ 99.5% before GA.

---

## 14 · Risks & Mitigations

| Risk                                                | Mitigation                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Skia on low-end Android = slow                      | Fallback to reduced bar detail (no rest stripes, no deadhead overlay) below 30 fps rolling |
| Gesture conflicts (pinch vs pan vs long-press)      | Strict `Gesture.Exclusive` + `Simultaneous` composition tested per device                  |
| WDB schema drift vs Mongoose                        | Shared TypeScript types in `packages/types`; regenerate WDB schema from those in CI        |
| Huge period loads OOM                               | Cap period to 90 days; refuse longer with a toast                                          |
| Reanimated / Skia version conflicts at Expo upgrade | Pin versions; Renovate bot + dev-client rebuild in CI on major bump                        |

---

## 15 · Out of Scope (explicitly, for this mobile plan)

- Full offline-write queue and conflict resolution (deferred to a future "Mobile Offline v2" initiative).
- Leg mode on mobile (pairings-only for M1–M5; leg mode parity after web leg mode ships).
- Push notifications for planner (crew app only in M4).
- Widget / Live Activity / complications.
- Tablet-split-view layouts beyond inspector side-sheet.
- Cross-device hand-off (starting on iPhone, finishing on iPad).

---

## 16 · Definition of Done (per phase)

**M1** — An operator can open the screen offline and see a read-only snapshot of the last loaded period. No edits.
**M2** — Every web-side right-click menu is reachable via long-press on mobile. All action-sheet items dispatch to the same store actions the web does. Assign/delete flows work round-trip to the server.
**M3** — Pinch-zoom matches 4.1.5.2 web polish. Long-press-drag moves a pairing between crew. Pull-to-refresh works.
**M4** — Crew can request swaps from the app; planner sees them in the web inbox.
**M5** — VoiceOver passes, reduced-motion passes, landscape side-sheet works, Android crash-free ≥ 99.5%.
