# Gantt Right-Click Interactions — Implementation Plan

## Status

| #   | Interaction                                 | Status      | Notes                                                                                            |
| --- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| 1   | Right-click flight bar → Flight Information | Done        | Context menu + 8-tab dialog with editable Times/Delays/PAX/Fuel/Crew/Memos                       |
| 2   | Right-click aircraft reg → Aircraft Info    | Done        | Context menu + persistent popover with fuselage/LOPA, period stats, overnight stations           |
| 3   | Right-click day header → Daily Summary      | Not started | See below                                                                                        |
| 4   | Right-click empty row → Daily Rotation      | Not started | See below                                                                                        |
| 5   | Flight bar context menu actions             | Partial     | Only "Flight Information" active; Assign/Unassign/Cut/Swap/Edit/Remove are disabled placeholders |

---

## 3. Right-Click on Day/Date Header → Daily Summary

### UX Flow

1. User right-clicks on a day column header (e.g. "THU 02 APR")
2. Context menu appears with **"Daily Summary"** (F3 shortcut)
3. User clicks → persistent inverted-glass popover opens (same style as Aircraft Info)
4. Popover stays until X is clicked or Escape

### Popover Content

#### Section A: Date Header

- Date display: "Thursday, 2 April 2026"
- Period badge if multi-day selection: "2 Apr — 4 Apr (3 days)"

#### Section B: Summary Metrics (2x2 grid)

| Metric              | Source                                                      |
| ------------------- | ----------------------------------------------------------- |
| Total Flights       | Count flights with `operatingDate` matching selected day(s) |
| Total Block Hours   | Sum `blockMinutes / 60`                                     |
| Aircraft in Service | Count distinct `aircraftReg` (assigned) for the day         |
| Fleet Size          | Total aircraft count from store                             |

#### Section C: Activity by Aircraft Type

Table with one row per ICAO type active that day:

| Type | Flights | Block Hrs | Active AC / Fleet |
| ---- | ------- | --------- | ----------------- |
| A320 | 24      | 48.5h     | 6 / 8             |
| A321 | 18      | 42.0h     | 5 / 6             |

Data source: group store flights by `aircraftTypeIcao` for the selected date(s).

#### Section D: Utilization per Type

- Per type: average block hours per active aircraft
- Visual bar with color coding (green >= 10h, amber >= 6h, accent below)
- Fleet-wide average shown as reference line

#### Section E: Overnight Stations

- Same donut chart + station list as Aircraft Info popover
- But aggregated across ALL aircraft for the selected day
- "Where does the fleet sleep tonight?"

### Store Changes

```
// Add to GanttState:
dayContextMenu: { x: number; y: number; date: string } | null
dailySummaryPopover: { x: number; y: number; date: string } | null

// Actions:
openDayContextMenu(x, y, date)
closeDayContextMenu()
openDailySummary(x, y, date)
closeDailySummary()
```

### Files to Create/Modify

- `gantt-canvas.tsx` — add `onContextMenu` on time header date labels
- `day-context-menu.tsx` — new component, same pattern as `aircraft-context-menu.tsx`
- `daily-summary-popover.tsx` — new component, persistent inverted-glass popover
- `use-gantt-store.ts` — add state + actions
- `use-gantt-keyboard.ts` — add F3 shortcut + Escape handling

### Data Strategy

All data computed client-side from `flights` array in the Gantt store. No new server endpoint needed.

### Implementation Steps

1. Add store state: `dayContextMenu`, `dailySummaryPopover`, 4 actions
2. Add `onContextMenu` to date header cells in `gantt-canvas.tsx`
3. Create `day-context-menu.tsx` — single item "Daily Summary" with F3
4. Create `daily-summary-popover.tsx` — computes stats from store flights filtered by date
5. Add F3 to keyboard hook
6. Hide tooltip when popover is open
7. Wire into canvas rendering

---

## 4. Right-Click on Empty Aircraft Row → Daily Rotation

### UX Flow

1. User right-clicks on an empty area of an aircraft row (not on a flight bar)
2. Context menu appears with **"Daily Rotation"** (F4 shortcut)
3. User clicks → persistent inverted-glass popover opens
4. Shows that aircraft's flight sequence for the day of the click position

### Detecting the Click Target

- Right-click on the canvas scroll area
- Hit-test: if NO flight bar is hit, determine which aircraft row was clicked
- Determine the date from the X coordinate: `xToUtc(clickX) → operatingDate`
- Open context menu with the registration + date

### Popover Content

#### Section A: Header

- Registration + aircraft type
- Date: "Thursday, 2 April 2026"

#### Section B: Daily Utilization

| Metric        | Source                            |
| ------------- | --------------------------------- |
| Flights Today | Count flights for this reg + date |
| Block Hours   | Sum block minutes                 |
| Utilization % | Block hours / 24h                 |

- Color-coded utilization bar (green >= 85%, amber >= 60%, red < 60%)

#### Section C: Flight Sequence (chronological list)

For each flight assigned to this aircraft on this date:

```
VJ57  SGN → HAN  02:30 — 04:00   [Active]
         ↕ TAT: 1h30m ✓
VJ58  HAN → SGN  05:30 — 07:00   [Active]
         ↕ TAT: 3h00m ✓
VJ71  SGN → DAD  10:00 — 11:15   [Draft]
```

Each flight shows:

- Flight number
- Route (DEP → ARR)
- STD — STA times
- Status badge (Active/Draft/Suspended)
- TAT indicator between consecutive flights

#### Section D: TAT Validation

Between each pair of consecutive flights:

- **Green check**: TAT >= minimum required (from AircraftType TAT setting)
- **Amber warning**: Station mismatch (arrival ≠ next departure)
- **Red alert**: Insufficient TAT or time overlap

Format: `TAT: 1h30m ✓` or `TAT: 0h20m ⚠ (min: 0h45m)` or `STATION MISMATCH: HAN ≠ SGN`

#### Section E: Conflict Summary

If any conflicts detected, show count + list:

- Overlaps: "Flight VJ58 departs before VJ57 arrives"
- Station mismatches: "VJ57 arrives HAN but VJ58 departs SGN"
- Insufficient TAT: "30min gap, minimum 45min required"

### Store Changes

```
// Add to GanttState:
rowContextMenu: { x: number; y: number; registration: string; aircraftTypeIcao: string; date: string } | null
rotationPopover: { x: number; y: number; registration: string; aircraftTypeIcao: string; date: string } | null

// Actions:
openRowContextMenu(x, y, registration, aircraftTypeIcao, date)
closeRowContextMenu()
openRotationPopover(x, y, registration, aircraftTypeIcao, date)
closeRotationPopover()
```

### Files to Create/Modify

- `gantt-canvas.tsx` — modify canvas `onContextMenu`: if no flight bar hit, detect row + date
- `row-context-menu.tsx` — new component, single item "Daily Rotation" with F4
- `rotation-popover.tsx` — new component, persistent popover with flight list + TAT validation
- `use-gantt-store.ts` — add state + actions
- `use-gantt-keyboard.ts` — add F4 shortcut
- Need `xToUtc` or similar from `time-axis.ts` to convert click X → date

### Data Strategy

All data computed client-side from the store's `flights` array + `aircraftTypes` (for TAT defaults). No new server endpoint needed.

### Implementation Steps

1. Add store state: `rowContextMenu`, `rotationPopover`, 4 actions
2. Modify canvas `onContextMenu`: if hitTestBars returns null, detect aircraft row via Y coordinate + date via X coordinate
3. Create `row-context-menu.tsx` — single item "Daily Rotation" with F4
4. Create `rotation-popover.tsx`:
   - Filter store flights by registration + operatingDate
   - Sort by stdUtc
   - Compute TAT gaps between consecutive flights
   - Validate: overlap, station mismatch, insufficient TAT (from `aircraftTypes[].tatDefaultMinutes`)
   - Render flight sequence with TAT indicators
5. Add F4 to keyboard hook
6. Wire into canvas rendering

---

## 5. Flight Bar Context Menu — Remaining Actions

These are currently disabled placeholders in `gantt-context-menu.tsx`. Implementation order by priority:

### 5a. Assign Aircraft Registration (Ctrl+A)

- Opens a dropdown/popover listing available aircraft of the correct type
- Selecting one calls `assignToAircraft(flightIds, registration)` (already in store)
- Should show: registration, home base, current utilization for the day

### 5b. Unassign Aircraft Registration

- Calls `unassignFromAircraft(flightIds)` (already in store)
- Confirmation: "Remove VN-A160 from VJ57?"

### 5c. Cut (Ctrl+X)

- Stores selected flights in a clipboard state
- Visual: cut flights appear dimmed/dashed on canvas
- Paste via right-click on target aircraft row

### 5d. Swap (Ctrl+S)

- Enters "swap mode" — next click on another flight swaps their aircraft assignments
- Visual: cursor changes, source flight highlighted
- Cancel with Escape

### 5e. Edit Schedule Pattern

- Opens the ScheduledFlight in a mini editor
- Fields: flight number, DOW, effective dates, STD/STA, AC type
- Saves back to ScheduledFlight model

### 5f. Remove from Date (Del)

- Removes flight from this specific operating date
- Does NOT delete the ScheduledFlight pattern
- Implementation: add date to an exclusion list or mark instance as cancelled

---

## Keyboard Shortcut Summary

| Key    | Action                             | Scope                                |
| ------ | ---------------------------------- | ------------------------------------ |
| F1     | Flight Information                 | Flight selected or context menu open |
| F2     | Aircraft Info                      | Aircraft context menu open           |
| F3     | Daily Summary                      | Day context menu open                |
| F4     | Daily Rotation                     | Row context menu open                |
| Ctrl+A | Assign Aircraft                    | Flight context menu open             |
| Ctrl+X | Cut                                | Flight(s) selected                   |
| Ctrl+S | Save (in dialog) / Swap (in gantt) | Context-dependent                    |
| Del    | Remove from Date                   | Flight(s) selected                   |
| Escape | Close topmost overlay              | Any overlay open                     |

---

## Popover Styling (consistent across all)

All persistent popovers follow the same inverted-glass pattern:

- **Light mode**: dark bg `rgba(24,24,27,0.92)`, light text
- **Dark mode**: light bg `rgba(244,244,245,0.95)`, dark text
- Backdrop blur 20px + saturate 180%
- Shadow: `0 8px 32px rgba(0,0,0,0.18)`
- Width: 400px (consistent)
- Portal to `document.body`
- X close button top-right
- Closes on Escape
- Tooltip hides when any popover is open

---

## Build Order

| Phase   | What                                           | Est. Files            |
| ------- | ---------------------------------------------- | --------------------- |
| Phase 1 | Daily Summary (day header right-click)         | 3 new + 3 modified    |
| Phase 2 | Daily Rotation (empty row right-click)         | 3 new + 3 modified    |
| Phase 3 | Assign/Unassign aircraft (flight context menu) | 1 new + 2 modified    |
| Phase 4 | Cut/Paste (flight context menu)                | 2 modified            |
| Phase 5 | Swap mode (flight context menu)                | 2 modified            |
| Phase 6 | Edit schedule pattern (flight context menu)    | 1 new + 1 modified    |
| Phase 7 | Remove from date (flight context menu)         | 1 modified + 1 server |
