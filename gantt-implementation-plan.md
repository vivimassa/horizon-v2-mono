# SkyHub v2 — Network Gantt (1.1.3) Implementation Plan

**Module:** Network → Schedule Planning → Gantt Chart
**Route:** `/network/schedule/gantt`
**Priority:** High — core fleet visualization and tail assignment tool
**Phases:** 6 sequential phases, each a standalone Claude Code prompt

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ apps/web/src/app/network/schedule/gantt/page.tsx         │  ← Page shell
│   └─ components/network/gantt/                           │
│       ├─ gantt-shell.tsx        (≤400 lines)             │  ← Layout orchestrator
│       ├─ gantt-toolbar.tsx      (≤300 lines)             │  ← Zoom, nav, actions
│       ├─ gantt-filter-panel.tsx (≤300 lines)             │  ← Left sidebar filters
│       ├─ gantt-canvas.tsx       (≤400 lines)             │  ← Canvas2D renderer
│       ├─ gantt-tooltip.tsx      (≤150 lines)             │  ← Hover tooltip
│       ├─ gantt-context-menu.tsx (≤150 lines)             │  ← Right-click menu
│       ├─ gantt-detail-panel.tsx (≤200 lines)             │  ← Floating flight details
│       ├─ gantt-histogram.tsx    (≤100 lines)             │  ← Bottom utilization strip
│       └─ gantt-status-bar.tsx   (≤ 80 lines)             │  ← Footer info strip
├─────────────────────────────────────────────────────────┤
│ apps/web/src/stores/use-gantt-store.ts                   │  ← Zustand state
├─────────────────────────────────────────────────────────┤
│ apps/web/src/lib/gantt/                                  │  ← Pure logic (no React)
│   ├─ types.ts              (Gantt-specific interfaces)   │
│   ├─ time-axis.ts          (zoom, PPH, ticks, now-line)  │
│   ├─ layout-engine.ts      (rows → bar positions)        │
│   ├─ hit-testing.ts        (click/tap → bar ID)          │
│   └─ colors.ts             (bar color by status/mode)    │
├─────────────────────────────────────────────────────────┤
│ server/src/routes/gantt.ts                               │  ← API endpoint
│   └─ GET /gantt/flights?operatorId=&from=&to=            │
│   └─ PATCH /gantt/assign                                 │
│   └─ PATCH /gantt/unassign                               │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Server API + Types

### Context

The Gantt needs a dedicated endpoint that joins ScheduledFlights + AircraftRegistrations + AircraftTypes and expands date patterns into concrete per-date flight instances. The existing `/flights` endpoint returns FlightInstances (operational) but the Gantt primarily works with ScheduledFlights (planning).

### Task

**1a. Create `server/src/routes/gantt.ts`**

```
GET /gantt/flights?operatorId=X&from=2026-04-07&to=2026-04-10&scenarioId=Y
```

Logic:

1. Query `ScheduledFlight.find({ operatorId, scenarioId, status: { $in: ['draft','active'] }, effectiveFrom: { $lte: to }, effectiveUntil: { $gte: from } })`
2. Query `AircraftRegistration.find({ operatorId, isActive: true })` — include all, even unassigned
3. Query `AircraftType.find({ operatorId, isActive: true })`
4. For each ScheduledFlight, expand dates: iterate each day in [from, to] range. For each day, check if DOW matches `daysOfWeek` field (1=Mon, 7=Sun) and date is within `effectiveFrom`–`effectiveUntil`. Emit one `GanttFlight` per match.
5. Return `{ flights: GanttFlight[], aircraft: GanttAircraft[], aircraftTypes: GanttAircraftType[] }`

Response shapes:

```typescript
interface GanttFlight {
  id: string              // scheduledFlight._id + "|" + operatingDate
  scheduledFlightId: string
  flightNumber: string
  depStation: string      // ICAO
  arrStation: string      // ICAO
  stdUtc: number          // ms epoch
  staUtc: number          // ms epoch
  blockMinutes: number
  operatingDate: string   // "2026-04-07"
  aircraftTypeIcao: string | null
  aircraftReg: string | null  // tail assignment
  status: 'draft' | 'active' | 'suspended'
  serviceType: string
  scenarioId: string | null
}

interface GanttAircraft {
  id: string
  registration: string
  aircraftTypeId: string
  aircraftTypeIcao: string  // joined from AircraftType
  status: string
  homeBaseIcao: string | null
}

interface GanttAircraftType {
  id: string
  icaoType: string
  name: string
  color: string | null      // per-type color for group headers
  tat: { defaultMinutes: number | null, domDom: number | null, ... }
}
```

**1b. Add assign/unassign endpoints:**

```
PATCH /gantt/assign   { flightIds: string[], registration: string }
PATCH /gantt/unassign { flightIds: string[] }
```

These update `aircraftReg` on the ScheduledFlight docs.

**1c. Create `apps/web/src/lib/gantt/types.ts`**

Define all Gantt-specific TypeScript interfaces used across components and the store. Mirror the API response types + add client-side types:

```typescript
type ZoomLevel = '1D' | '2D' | '3D' | '4D' | '5D' | '7D' | '14D' | '28D'
type ColorMode = 'status' | 'ac_type' | 'service_type' | 'route_type'
type BarLabelMode = 'flightNo' | 'sector'

interface BarLayout {
  flightId: string
  x: number
  y: number
  width: number
  height: number
  color: string
  textColor: string
  label: string
  row: number
}

interface RowLayout {
  type: 'group_header' | 'aircraft'
  registration?: string
  aircraftTypeIcao?: string
  y: number
  height: number
  collapsed?: boolean
}
```

### Design Rules

- operatorId on every query
- All times in UTC milliseconds
- DOW expansion: 1=Monday (ISO), match against `daysOfWeek` string where char position = day number
- Use Zod validation on query params

### Acceptance Criteria

- [ ] `GET /gantt/flights` returns expanded flights for a 4-day period with correct DOW filtering
- [ ] Response includes joined aircraft type ICAO on each aircraft record
- [ ] `PATCH /gantt/assign` updates aircraftReg on matching ScheduledFlight docs
- [ ] `types.ts` exports all interfaces needed by later phases
- [ ] No hardcoded operatorId — always from query params

---

## Phase 2 — Zustand Store + Pure Logic

### Context

Replace v1's 60+ useState hooks with a single Zustand store. Also create the pure logic functions for coordinate math.

### Task

**2a. Create `apps/web/src/stores/use-gantt-store.ts`**

Slices:

```typescript
interface GanttState {
  // Data
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  loading: boolean

  // View
  zoomLevel: ZoomLevel
  startDate: Date // left edge of visible window
  periodFrom: string | null // committed period
  periodTo: string | null
  rowHeightLevel: number // 0=compact, 1=default, 2=large, 3=xlarge
  collapsedTypes: Set<string> // collapsed AC type ICAOs
  colorMode: ColorMode
  barLabelMode: BarLabelMode

  // Selection
  selectedFlightIds: Set<string>
  hoveredFlightId: string | null

  // Actions
  setFlights: (f: GanttFlight[]) => void
  setAircraft: (a: GanttAircraft[]) => void
  setZoom: (z: ZoomLevel) => void
  setStartDate: (d: Date) => void
  toggleTypeCollapse: (icao: string) => void
  selectFlight: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  // ... etc
}
```

Use sliced selectors pattern — components subscribe to only the slice they need.

**2b. Create `apps/web/src/lib/gantt/time-axis.ts`**

Pure functions:

- `getZoomConfig(zoom: ZoomLevel) → { days: number, hoursPerTick: number }`
- `computePixelsPerHour(containerWidth: number, zoomDays: number) → number`
- `getTickPositions(startDate: Date, totalDays: number, hoursPerTick: number, pph: number) → TickMark[]`
- `getNowLineX(startDate: Date, pph: number) → number`

**2c. Create `apps/web/src/lib/gantt/layout-engine.ts`**

Pure function: takes `(flights, aircraft, aircraftTypes, collapsedTypes, rowHeight, pph, startDate)` and returns `{ rows: RowLayout[], bars: BarLayout[] }`.

Logic:

1. Group aircraft by type ICAO
2. For each group: emit a group header row, then one row per aircraft (skip if collapsed)
3. For each aircraft row: find flights where `aircraftReg === registration`, compute x/width from stdUtc/staUtc relative to startDate using pph
4. Unassigned flights: collect into a separate "Unassigned" group at the bottom

**2d. Create `apps/web/src/lib/gantt/hit-testing.ts`**

Pure function: `hitTest(x: number, y: number, bars: BarLayout[]) → string | null` — returns flightId or null. Uses binary search on y (rows are sorted) then linear scan on x within the row.

**2e. Create `apps/web/src/lib/gantt/colors.ts`**

Pure function: `getBarColor(flight: GanttFlight, colorMode: ColorMode, acTypeColors: Map<string,string>, isDark: boolean) → { bg: string, text: string }`

Status-mode colors:

- active + assigned → emerald-500/70
- active + unassigned → amber-500/65
- draft + assigned → blue-500/65
- draft + unassigned → slate-500/55

### Design Rules

- Zero React imports in `lib/gantt/*.ts` — these are pure TS
- Store uses `immer` middleware for immutable updates on Sets
- All coordinate math uses UTC milliseconds, never local time

### Acceptance Criteria

- [ ] Store hydrates from API response and re-renders only subscribed slices
- [ ] `layout-engine` produces correct bar x/width for flights spanning midnight UTC
- [ ] `hit-testing` returns correct flight ID for coordinates within a bar
- [ ] `colors.ts` returns different colors per status in both light and dark mode
- [ ] No component file imports anything from `lib/gantt/` except through the store or direct function call

---

## Phase 3 — Page Shell + Filter Panel + Toolbar

### Context

Build the page layout, filter sidebar, and toolbar. No Gantt canvas yet — just the frame with a placeholder.

### Task

**3a. Create `apps/web/src/app/network/schedule/gantt/page.tsx`**

Minimal page that renders `<GanttShell />`. Fetches initial data on mount using the store.

**3b. Create `gantt-shell.tsx`**

Layout orchestrator:

```
┌──────────────────────────────────────────────┐
│ gantt-filter-panel │ gantt-toolbar            │
│ (280px, left)      │ gantt-canvas (flex-1)    │
│                    │ gantt-histogram (40px)    │
│                    │ gantt-status-bar (24px)   │
└──────────────────────────────────────────────┘
```

Filter panel is collapsible (280px → 0 with transition).

**3c. Create `gantt-filter-panel.tsx`**

Contents (top to bottom):

1. Period selector: two date inputs (From / To) + "Go" button (accent primary)
2. Aircraft type filter: multi-select with color swatches per type
3. Schedule status toggles: Published ✓, Finalized ✓, Draft ✓
4. Color mode selector: segmented control (Status | AC Type | Service | Route)
5. Legend: colored dots matching current color mode

Style: dark surface background (#0E0E14), consistent with SkyHub design system.

**3d. Create `gantt-toolbar.tsx`**

Left: Zoom pills (1D–28D), row height ±, separator, Optimizer button, Compare button
Center: ◀ date range ▶, Today button
Right: search input, label toggle (Flight No ↔ Sector), settings gear, fullscreen

**3e. Create `gantt-status-bar.tsx`**

Single 24px line: flight count, aircraft count, zoom level, utilization %, UTC time, period range, sync status.

### Design Rules

- Follow SkyHub v2 design system: colors from `useTheme()`, no hardcoded hex in components
- All icons from `lucide-react` via the `<Icon>` wrapper
- Filter panel inputs use the existing SkyHub input/select components if available, otherwise raw Tailwind
- Toolbar buttons: 32px height minimum, 13px text minimum
- Glass effect on toolbar: `backdrop-blur-[20px] bg-[rgba(27,27,33,0.8)]`

### Acceptance Criteria

- [ ] Page loads at `/network/schedule/gantt` with filter panel, toolbar, and placeholder body
- [ ] Period selector triggers API fetch via store
- [ ] AC type filter updates store → will re-layout when canvas exists
- [ ] Zoom pills update store `zoomLevel`
- [ ] Date nav arrows shift `startDate` by zoom-days
- [ ] "Today" button resets startDate to current date
- [ ] Filter panel collapses/expands with 200ms transition
- [ ] All text sizes follow the project formatting rules (page title 20px semibold, etc.)

---

## Phase 4 — Canvas2D Renderer

### Context

The core of the Gantt — render flight bars, grid lines, time header, now-line, and group headers onto an HTML `<canvas>` element. This replaces v1's DOM-based absolute positioning with canvas drawing for performance.

### Task

**4a. Create `gantt-canvas.tsx`**

Component that:

1. Uses a `<canvas>` element with `ref`
2. On mount / resize: set canvas size to container size × devicePixelRatio
3. Subscribe to store: `flights`, `aircraft`, `zoomLevel`, `startDate`, `rowHeightLevel`, `collapsedTypes`, `colorMode`, `selectedFlightIds`, `hoveredFlightId`
4. On any store change: call `draw()` which:
   a. Clear canvas
   b. Call `layout-engine` to get rows + bars
   c. Draw grid lines (vertical hour ticks, horizontal row separators)
   d. Draw group headers (subtle tinted background, collapse arrow, type name, count, utilization)
   e. Draw flight bars (rounded rects with fill, border, label text)
   f. Draw selected bars with accent ring + glow
   g. Draw hovered bar with slight brightness boost
   h. Draw now-line (2px accent vertical line + top dot + time label)
   i. Draw TAT labels between consecutive bars on same row

**Fixed left column:**
Use a separate small canvas (or DOM overlay) for the aircraft registration labels that don't scroll horizontally. Pin it to the left with `position: sticky` or absolute positioning.

**Time header:**
Draw day labels and hour ticks on the top portion of the canvas (or a separate header canvas that syncs horizontal scroll).

**Horizontal scrolling:**
The canvas content is wider than the viewport. Use a scroll container `<div>` around the canvas with `overflow-x: auto`. Sync the header and row-label positions with `scrollLeft`.

**Performance techniques:**

- Only draw bars within the visible horizontal scroll range (horizontal virtualization)
- Use `requestAnimationFrame` for draw calls
- Cache `pixelsPerHour` in a ref, recompute only on zoom/resize
- Batch fill operations: set `fillStyle` once per color group, draw all bars of that color

**Mouse events on canvas:**

- `onMouseMove`: call `hitTest(x, y)` → update `hoveredFlightId` in store
- `onClick`: call `hitTest(x, y)` → update selection in store (Ctrl/Cmd for multi-select)
- `onContextMenu`: call `hitTest(x, y)` → open context menu at cursor position
- `onWheel`: horizontal scroll OR zoom (Ctrl+wheel = zoom)

### Design Rules

- Canvas text: use Inter 11px for bar labels, JetBrains Mono 10px for flight numbers, 9px for TAT labels
- Minimum bar width: 2px (degenerate case at 28D zoom)
- Bar corner radius: 4px (use `roundRect` API)
- Grid lines: `rgba(255,255,255,0.04)` for row separators, `rgba(255,255,255,0.08)` for day boundaries
- Now-line: primary-container color (#0061FF), 2px, top dot 6px
- DevicePixelRatio: always multiply canvas dimensions by `window.devicePixelRatio` for sharp text

### Acceptance Criteria

- [ ] Canvas renders 200+ bars across 8 aircraft rows at 60fps
- [ ] Horizontal scroll syncs between canvas body, time header, and row labels
- [ ] Now-line position updates every 60 seconds
- [ ] Zoom change redraws instantly (no visible lag)
- [ ] Mouse hover highlights correct bar
- [ ] Click selects bar with blue ring
- [ ] Bar labels adapt: show flight number when bar > 40px, truncate when smaller, hide when < 20px
- [ ] TAT labels appear between consecutive bars when gap > 30px
- [ ] Works correctly in both light and dark mode (read colors from theme)

---

## Phase 5 — Interactions (Tooltip, Context Menu, Detail Panel)

### Context

Overlay DOM elements on top of the canvas for rich UI that canvas can't handle well (text selection, animations, complex layouts).

### Task

**5a. Create `gantt-tooltip.tsx`**

Floating glass card that follows cursor when hovering a bar. Uses `position: fixed` and repositions with cursor coordinates.

Contents: flight number + date, route (dep → arr), STD — STA (UTC), block time, aircraft reg + type, status badge, TAT from previous flight if applicable.

Show with 100ms delay, hide immediately on mouse leave.

**5b. Create `gantt-context-menu.tsx`**

Right-click menu with glass panel background. Items:

- View Flight Details
- Assign to Aircraft… (opens picker)
- Unassign from Aircraft
- Swap Assignment…
- separator
- Select All on Row
- Select Same Route Group

**5c. Create `gantt-detail-panel.tsx`**

Fixed position bottom-right (320px wide). Shows when a flight is selected. Contains:

- Flight number (large mono heading)
- Route, times, block time
- Aircraft assignment
- Payload/config info
- "Edit Schedule" primary button
- "More" overflow button

Auto-hides when selection is cleared.

**5d. Create `gantt-histogram.tsx`**

40px strip below the canvas. For each hour bucket across the visible period, draw a vertical bar proportional to flight count. Heat-colored: blue (1-3 flights/hr) → amber (4-6) → red (7+).

Sync horizontal scroll with the canvas.

### Design Rules

- Tooltip max-width: 220px, glass-panel background, border-radius 12px
- Context menu: min-width 200px, 8px item padding, hover highlight
- Detail panel: glass-panel, rounded-xl, shadow-2xl
- All overlays use portal rendering (append to body) to avoid z-index issues
- Histogram bars: 2px gap, rounded-top-sm, same horizontal scale as canvas

### Acceptance Criteria

- [ ] Tooltip appears on hover with correct flight data, repositions to stay within viewport
- [ ] Context menu opens on right-click, closes on click-outside or Escape
- [ ] Detail panel slides in when flight selected, slides out when deselected
- [ ] Histogram reflects actual flight density and scrolls with canvas
- [ ] No z-index conflicts between overlays

---

## Phase 6 — Tail Assignment (Drag & Drop)

### Context

The killer feature — drag a flight bar from one aircraft row to another to reassign tail numbers. This is what makes the Gantt an assignment tool, not just a viewer.

### Task

**6a. Implement drag-and-drop on canvas:**

On `mousedown` on a bar:

1. Set drag state in store: `{ flightId, originRow, startX, startY }`
2. Draw ghost bar at origin (dashed outline, transparent)
3. On `mousemove`: draw dragged bar following cursor Y position, snap to nearest row
4. On `mouseup`: determine target row (aircraft registration), call assign API

**6b. Add assign/unassign API calls to store:**

```typescript
assignFlights: async (flightIds: string[], registration: string) => {
  await apiFetch('/gantt/assign', { method: 'PATCH', body: { flightIds, registration } })
  // Update local state optimistically
}

unassignFlights: async (flightIds: string[]) => {
  await apiFetch('/gantt/unassign', { method: 'PATCH', body: { flightIds } })
}
```

**6c. Multi-select drag:**
When multiple bars are selected and one is dragged, all selected bars move together. Show count badge on the drag preview.

**6d. Drop confirmation dialog:**
If the target aircraft already has a conflicting flight (time overlap), show a confirmation dialog before proceeding.

### Design Rules

- Dragged bar opacity: 0.65, scale: 1.03
- Ghost placeholder at origin: dashed border, transparent fill
- Drop target row: subtle highlight (primary/5% tint)
- Invalid drop (same row, or dropped outside grid): snap back with 150ms transition
- Cursor changes: grab → grabbing during drag

### Acceptance Criteria

- [ ] Drag flight from one aircraft row to another → updates in DB
- [ ] Ghost placeholder visible at origin during drag
- [ ] Multi-select drag moves all selected bars
- [ ] Conflict detection warns on overlapping flights
- [ ] Unassign via context menu removes aircraftReg
- [ ] Optimistic update: bar moves immediately, reverts on API error with toast

---

## Build Order Summary

| Phase | Description            | Dependencies    | Est. effort           |
| ----- | ---------------------- | --------------- | --------------------- |
| 1     | Server API + Types     | Existing models | Small                 |
| 2     | Store + Pure Logic     | Phase 1 types   | Medium                |
| 3     | Page Shell + UI Frame  | Phase 2 store   | Medium                |
| 4     | Canvas Renderer        | Phase 2 + 3     | Large (biggest phase) |
| 5     | Interactions           | Phase 4         | Medium                |
| 6     | Drag & Drop Assignment | Phase 4 + 5     | Medium                |

Execute sequentially. Git commit between each phase. Verify each phase works before starting the next.

---

## What's Deferred (post-MVP)

- Optimizer integration (greedy/MIP/CG solver) — port from v1 when ready
- Solution slots and comparison view
- Virtual tails (create/purge)
- Mini schedule builder (inline route editor)
- Flight search with highlight/scroll
- Aircraft search
- Settings panel (display options, TAT labels toggle)
- Export/print
- Keyboard shortcuts
- Mobile (Skia) renderer — separate initiative
