# Mobile Gantt Chart — Implementation Plan

## Overview

Full-featured Gantt chart for tablet and phone, built with React Native + Skia. This is a competitive differentiator — no airline ops system has ever shipped an interactive Gantt on mobile. The mobile version shares data types, API, and business logic with the web Gantt but has its own rendering engine, interaction model, and layout system optimized for touch.

---

## Interaction Model

### Single Tap on Flight Bar

- Opens a **bottom sheet** with flight summary
- Bottom sheet has swipeable tabs: **Flight** | **Cycle** (if rotationId) | **Aircraft** | **Day**
- Dismissible via swipe-down or tap on backdrop

### Long Press on Flight Bar

- All flights in the **same rotation** begin **jiggling** (iOS delete-mode animation)
- A **top action bar** slides in with a **"Select All"** button
- Tapping **Select All** reveals two scope buttons: **"Selected Day"** | **"Entire Period"**
- After scope selection → all matching rotation flights are highlighted
- Bottom sheet opens with **Cycle Summary** context
- Tap backdrop or "Done" in action bar to exit selection mode

### Single Tap on Aircraft Registration (row label)

- Opens bottom sheet on **Aircraft** tab

### Single Tap on Day/Date Header

- Opens bottom sheet on **Day** tab

### Pan / Scroll

- **One finger horizontal** = scroll timeline
- **One finger vertical** = scroll aircraft rows
- **Two finger pinch** = zoom in/out time axis

### Selection Mode (entered via long press)

- Individual flight taps add/remove from selection
- "Select All" → "Selected Day" / "Entire Period" for rotation-wide selection
- "Done" button exits selection mode

---

## Architecture

### Dependencies to Add

```
apps/mobile/package.json:
  @shopify/react-native-skia
  react-native-gesture-handler (already present via expo)
  @gorhom/bottom-sheet (production-grade bottom sheet with Reanimated)
```

### Shared (already exists, reuse as-is)

| Asset               | Location                                        | Notes                                        |
| ------------------- | ----------------------------------------------- | -------------------------------------------- |
| API types           | `apps/web/src/lib/gantt/types.ts`               | Move to `packages/shared/src/types/gantt.ts` |
| Virtual placement   | `packages/logic/src/utils/virtual-placement.ts` | Rotation-aware block solver                  |
| Layout engine logic | `apps/web/src/lib/gantt/layout-engine.ts`       | Extract core to `packages/logic/`            |
| Gantt settings      | `packages/constants/src/gantt-settings.ts`      | TAT, colors, zoom configs                    |
| Color helpers       | `packages/logic/src/utils/color-helpers.ts`     | Bar coloring                                 |
| Server API          | `server/src/routes/gantt.ts`                    | GET /gantt/flights, PATCH assign/unassign    |
| Theme tokens        | `packages/ui/src/theme/`                        | Colors, typography, shadows                  |

### Mobile-Specific (new)

| Component     | Location                                                    | Purpose                                         |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Gantt screen  | `apps/mobile/app/(tabs)/network/gantt.tsx`                  | Entry point, navigation                         |
| Gantt store   | `apps/mobile/src/stores/use-mobile-gantt-store.ts`          | Zustand store (mobile-specific view state)      |
| Skia canvas   | `apps/mobile/src/components/gantt/gantt-canvas.tsx`         | Skia-based flight bar + grid renderer           |
| Time header   | `apps/mobile/src/components/gantt/time-header.tsx`          | Sticky date/hour header                         |
| Row labels    | `apps/mobile/src/components/gantt/row-labels.tsx`           | Aircraft registration column                    |
| Bottom sheet  | `apps/mobile/src/components/gantt/gantt-detail-sheet.tsx`   | Tabbed detail sheet (Flight/Cycle/Aircraft/Day) |
| Selection bar | `apps/mobile/src/components/gantt/selection-action-bar.tsx` | Top bar during selection mode                   |
| Filter sheet  | `apps/mobile/src/components/gantt/gantt-filter-sheet.tsx`   | Period picker + filters (bottom sheet)          |
| Hit testing   | `apps/mobile/src/lib/gantt/hit-testing.ts`                  | Touch coordinate → flight/row/header mapping    |

---

## Phases

### Phase 1 — Read-Only Gantt Canvas

**Goal:** Render flights on a scrollable Skia canvas. No interaction beyond scroll/zoom.

**Tasks:**

1. Add `@shopify/react-native-skia` and `@gorhom/bottom-sheet` to `apps/mobile`
2. Move shared Gantt types from `apps/web/src/lib/gantt/types.ts` to `packages/shared/src/types/gantt.ts`. Update web imports.
3. Extract core layout computation from `apps/web/src/lib/gantt/layout-engine.ts` into `packages/logic/src/utils/gantt-layout.ts` (pure function, no DOM/web dependencies). Keep web's `layout-engine.ts` as a thin wrapper.
4. Create mobile Gantt Zustand store (`use-mobile-gantt-store.ts`):
   - Period state (from/to, committed)
   - Flight/aircraft/aircraftType data from API
   - Zoom level, scroll position
   - Selection state (selectedFlightIds, selectionMode)
   - Computed layout (reuses shared layout engine)
5. Create Skia canvas component:
   - `drawGrid()` — horizontal row lines, vertical time lines
   - `drawBars()` — rounded rect flight bars with labels
   - `drawGroupHeaders()` — aircraft type group headers
   - `drawNowLine()` — current time indicator
   - `drawTatLabels()` — turnaround time between consecutive bars
6. Create row label column (React Native `ScrollView`, synced with canvas vertical scroll)
7. Create time header (React Native, synced with canvas horizontal scroll)
8. Implement scroll sync: `GestureDetector` for pan → update canvas translate + sync row labels and time header via `SharedValue`
9. Implement pinch-to-zoom: two-finger gesture → adjust pixels-per-hour, recompute layout
10. Create filter bottom sheet (period picker, AC type filter, status filter, "Go" button)
11. Wire up API: fetch flights on "Go", populate store, trigger layout computation
12. Create gantt screen at `apps/mobile/app/(tabs)/network/gantt.tsx`

**Acceptance criteria:**

- Flights render as colored bars on correct aircraft rows
- Smooth 60fps scroll and pinch-zoom
- Aircraft type groups collapsible via tap on group header
- Now-line visible and auto-updates
- TAT labels between consecutive flights
- Filter sheet allows period and AC type selection

---

### Phase 2 — Tap-to-Inspect (Bottom Sheet)

**Goal:** Single tap on flight bar, aircraft reg, or day header opens a tabbed detail bottom sheet.

**Tasks:**

1. Implement hit testing for Skia canvas:
   - Touch coordinate → flight bar (using bar layout positions)
   - Touch on row label area → aircraft registration
   - Touch on time header → date
2. Create `GanttDetailSheet` component using `@gorhom/bottom-sheet`:
   - Snap points: 40% (peek), 75% (expanded), 100% (full)
   - Tab bar at top: **Flight** | **Cycle** | **Aircraft** | **Day**
   - Each tab is a scrollable content area
3. **Flight tab** content:
   - Flight number badge with status color
   - Route section: DEP — block time — ARR (same layout as web tooltip)
   - STD/STA (UTC), date, AC type, registration, service type
   - If assigned: daily utilization of that aircraft (flight count, block hours, utilization %)
4. **Cycle tab** content (visible only if flight has `rotationId`):
   - Rotation label (e.g., "57/58/59")
   - List of all flights in the rotation, ordered by `rotationSequence`
   - Each flight: number, route, times, TAT to next flight
   - Total cycle block hours, total TAT, cycle duration
   - Station chain visualization (SGN → HAN → SGN)
5. **Aircraft tab** content:
   - Registration, type (ICAO + name)
   - Period summary: flight count, total block hours, utilization %
   - Overnight stations list with counts
6. **Day tab** content:
   - Date display
   - Total flights, total block hours for that date
   - Aircraft in service vs fleet count
   - Activity breakdown by AC type
7. Wire tap gestures:
   - Tap on flight bar → open sheet on Flight tab
   - Tap on row label → open sheet on Aircraft tab
   - Tap on time header date → open sheet on Day tab
8. Highlight the tapped flight/aircraft/day on canvas while sheet is open

**Acceptance criteria:**

- Single tap opens bottom sheet instantly (<100ms to first frame)
- Sheet is swipeable between snap points
- Tabs switch without re-rendering the entire sheet
- Tapping a different flight while sheet is open updates content (no close/reopen)
- Swipe down dismisses sheet and clears highlight

---

### Phase 3 — Long Press Selection Mode

**Goal:** Long press enters selection mode for rotation-based multi-select.

**Tasks:**

1. Implement long-press gesture detection (500ms threshold) on flight bars
2. On long press trigger:
   - Enter selection mode (`selectionMode: true` in store)
   - Identify the pressed flight's `rotationId`
   - Start jiggle animation on all flights sharing that `rotationId` (Skia: slight rotation oscillation ±1.5deg at 3Hz, applied during `drawBars()`)
   - Slide in `SelectionActionBar` from top (Reanimated slide-down)
3. `SelectionActionBar` component:
   - Shows: rotation label, count of jiggling flights
   - **"Select All"** button (accent color, prominent)
   - **"Done"** button (secondary, exits selection mode)
4. On "Select All" tap:
   - Replace "Select All" with two scope buttons: **"Selected Day"** | **"Entire Period"**
   - Animate transition (Reanimated layout animation)
5. On scope selection:
   - "Selected Day": select all flights in this rotation for the operating date of the long-pressed flight
   - "Entire Period": select all flights in this rotation across the full loaded period
   - Highlight selected flights on canvas (accent border + glow, stop jiggle → solid selected state)
   - Open bottom sheet on **Cycle** tab with aggregated stats for selected flights
6. During selection mode, single taps on other flight bars toggle them in/out of selection (manual add/remove)
7. "Done" button or swipe-dismiss on bottom sheet exits selection mode, clears selection, stops all animations

**Acceptance criteria:**

- Long press feedback: haptic vibration (Expo Haptics) + jiggle starts
- Jiggle animation is smooth 60fps (Skia render loop, not React state)
- Action bar appears/disappears with spring animation
- Scope selection (Day/Period) correctly filters rotation flights
- Bottom sheet cycle summary aggregates all selected flights
- Clean exit: no lingering highlights or animations after "Done"

---

### Phase 4 — Canvas Polish & Performance

**Goal:** Production-quality rendering and interaction refinements.

**Tasks:**

1. Bar label rendering:
   - Auto-hide label when bar width < text width + padding
   - Two modes: flight number or sector (DEP-ARR), togglable from filter sheet
2. Color modes:
   - Status (published/draft → green/blue/orange/gray)
   - AC type (color from database or palette fallback)
3. Row height adjustment (compact / default / large) — toggle in filter sheet
4. Virtual rendering: only draw bars and rows within the visible viewport + buffer zone. Skip offscreen bars entirely in Skia draw loop.
5. Landscape optimization:
   - Detect orientation change
   - Landscape: row labels narrower (reg only, no type name), more timeline visible
   - Portrait: row labels wider (reg + type), less timeline
6. Empty state: when no period selected, show the shared `EmptyPanel` pattern (SkyHub logo + prompt text), adapted for React Native
7. Loading state: activity indicator centered in canvas area while API fetches
8. Error state: error message with retry button
9. Now-line auto-advance: `setInterval` every 60s to shift the now-line position
10. Dark mode: all canvas drawing respects `useTheme()` palette, no hardcoded colors

**Acceptance criteria:**

- 60fps scroll/zoom with 500+ flights loaded
- Smooth orientation transitions
- All color modes working
- Virtual rendering confirmed (profile with Skia debug overlay)
- Dark mode pixel-perfect

---

### Phase 5 — Drag-and-Drop Assignment (Tablet)

**Goal:** Drag a flight bar to a different aircraft row to assign/reassign.

**Tasks:**

1. Implement drag gesture on flight bars (long press + move, distinct from selection long press by movement threshold > 10px)
2. During drag:
   - Ghost bar follows finger (semi-transparent, Skia overlay)
   - Source row shows empty slot (dashed outline)
   - Target row highlights when finger is over it (accent border)
   - Invalid targets (wrong AC type, overlap) show red highlight
3. On drop:
   - Optimistic UI: immediately move bar to new row
   - API call: `PATCH /gantt/assign`
   - On failure: revert bar to original row, show toast error
4. On drop to "Unassigned" area or original row: cancel drag, no API call
5. Multi-flight drag: if multiple flights are selected (from Phase 3), dragging one moves all selected flights to the target aircraft
6. Validation during drag:
   - Check overlap with existing flights on target aircraft (including TAT buffer)
   - Check AC type match
   - Visual feedback: green drop zone = valid, red = invalid

**Acceptance criteria:**

- Drag initiates only after 10px movement (prevents conflict with long-press selection)
- Ghost bar is visually distinct (50% opacity, slight scale up)
- Drop validation prevents invalid assignments
- Optimistic update feels instant
- Multi-drag moves entire selection atomically

---

### Phase 6 — Offline Support & Sync

**Goal:** Gantt works offline using WatermelonDB, syncs when reconnected.

**Tasks:**

1. Create WatermelonDB models mirroring Gantt data:
   - `GanttFlightInstance` (expanded per-date flights)
   - `AircraftRegistration` (already exists in WatermelonDB)
   - `AircraftType` (already exists)
2. On "Go" button: fetch from API → write to WatermelonDB → render from local DB
3. Offline reads: query WatermelonDB directly if no network
4. Assignment changes: write to WatermelonDB with sync queue flag → push to server when online
5. Conflict resolution: server wins for assignment conflicts (another user assigned the same flight)
6. Sync indicator: subtle badge in toolbar showing "Synced" / "Pending changes" / "Offline"

**Acceptance criteria:**

- Gantt loads from local cache instantly on revisit
- Assignments persist offline and sync on reconnect
- Conflict resolution doesn't lose data
- Sync status visible to user

---

## Screen Layout (Portrait Tablet)

```
┌──────────────────────────────────────────┐
│  [Filter]  Gantt Chart    [Zoom] [Today] │  ← Toolbar (48px)
├────────┬─────────────────────────────────┤
│        │  THU 02 APR        FRI 03 APR   │  ← Time header (44px)
│        │  02  04  06  08  10  12  14  16 │
├────────┼─────────────────────────────────┤
│ A380   │ ▸ A380 (9 aircraft)             │  ← Group header (28px)
├────────┼─────────────────────────────────┤
│SK-H912 │ ██ 53 ██  ██ 10 ██  ██ 3 ██    │  ← Aircraft row
│A380-800│                                 │
├────────┼─────────────────────────────────┤
│SK-H913 │ ██ 17 ██  ██ 58 ██  ██ 15 ██   │
│A380-800│                                 │
├────────┼─────────────────────────────────┤
│  ...   │         (Skia canvas)           │
│        │                                 │
└────────┴─────────────────────────────────┘
         ┌─────────────────────────────────┐
         │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  ← Bottom sheet (peek)
         │  Flight | Cycle | Aircraft | Day │
         │                                 │
         │  VJ 57                   Active │
         │  VVTS ———— 1:30 ———— VVNB     │
         │  STD 02:30z    STA 04:00z      │
         │  ...                            │
         └─────────────────────────────────┘
```

## Screen Layout (Selection Mode)

```
┌──────────────────────────────────────────┐
│  Rotation 57/58    [Select All]   [Done] │  ← Selection action bar
├────────┬─────────────────────────────────┤
│        │  THU 02 APR        FRI 03 APR   │
│        │  02  04  06  08  10  12  14  16 │
├────────┼─────────────────────────────────┤
│SK-H912 │ ██ 53 ██  ≋≋ 10 ≋≋  ██ 3 ██   │  ← ≋≋ = jiggling bars
│        │          ≋≋ 58 ≋≋               │
├────────┼─────────────────────────────────┤
│SK-H914 │ ≋≋ 57 ≋≋  ██ 18 ██  ██ 39 ██  │  ← 57 jiggling (same rotation)
│        │                                 │
└────────┴─────────────────────────────────┘
```

---

## File Structure

```
apps/mobile/
  app/(tabs)/network/
    gantt.tsx                          ← Screen entry point
  src/
    components/gantt/
      gantt-shell.tsx                  ← Layout orchestrator
      gantt-canvas.tsx                 ← Skia canvas (bars, grid, now-line)
      gantt-toolbar.tsx                ← Top toolbar (filter, zoom, today)
      gantt-detail-sheet.tsx           ← Bottom sheet with tabs
      gantt-filter-sheet.tsx           ← Period/filter bottom sheet
      selection-action-bar.tsx         ← Top bar during selection mode
      row-labels.tsx                   ← Aircraft registration column
      time-header.tsx                  ← Date/hour sticky header
      tabs/
        flight-tab.tsx                 ← Flight summary tab content
        cycle-tab.tsx                  ← Rotation/cycle summary tab content
        aircraft-tab.tsx               ← Aircraft statistics tab content
        day-tab.tsx                    ← Daily statistics tab content
    stores/
      use-mobile-gantt-store.ts        ← Zustand store
    lib/gantt/
      hit-testing.ts                   ← Touch → element mapping
      draw-helpers.ts                  ← Skia draw functions
      colors.ts                        ← Bar color computation (mobile-specific opacity/contrast)

packages/shared/src/types/
  gantt.ts                             ← Shared types (moved from web)

packages/logic/src/utils/
  gantt-layout.ts                      ← Shared layout engine (extracted from web)
```

---

## Key Principles

1. **Skia for all canvas rendering** — never View-based absolute positioning for timeline bars (per CLAUDE.md rule 14)
2. **60fps or nothing** — all animations via Skia render loop or Reanimated SharedValues, never React state for frame-by-frame updates
3. **Bottom sheet is the universal detail container** — one component, four tabs, adapts to context
4. **Touch gestures must never conflict** — tap (inspect), long-press (select), pan (scroll), pinch (zoom) are all distinct with clear thresholds
5. **Offline-first** — reads from WatermelonDB, writes queue for sync (Phase 6)
6. **Share logic, not UI** — types, layout engine, placement algorithm, and color computation are shared packages; rendering and interaction are mobile-specific
