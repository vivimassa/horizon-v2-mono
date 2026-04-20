# PAIRING_MASTER_PLAN.MD — Crew Pairing 4.1.5 (V1 → SkyHub port)

> **Target file on approval**: `C:\Users\ADMIN\horizon-v2-mono\PAIRING_MASTER_PLAN.MD`
> (Plan-mode rules require this draft at `.claude/plans/…` — Step 0 of execution copies it to repo root.)

---

## Context

V1 (`C:\Users\ADMIN\horizon`) ships a **very polished** Crew Pairing workspace at module `3.1.5` (Workforce → Crew Control → Pairing) with three sub-features:

| V1 slot | Screen | V1 LOC (key files) |
|--------|--------|--------------------|
| 3.1.5.1 | Text-based pairing workspace | `pairing-workspace.tsx` 1527, `pairing-list-panel.tsx` 976, `pairing-inspector-panel.tsx` 865, `flight-pool-panel.tsx` 418, `use-pairing-workspace.ts` ~1700, `pairing-legality-checker.ts` 1001 |
| 3.1.5.2 | Gantt pairing | `pairing-gantt-v2/gantt-shell.tsx` 690 + 10+ sub-files |
| 3.1.5.3 | Pairing Optimizer | `optimizer/*.tsx` ~2200 total |

SkyHub currently has **only** a `<ComingSoon />` stub at `/apps/web/src/app/crew-ops/control/pairing/page.tsx` and an aspirational entry in `navData.ts` (4.1.1).

**Goal**: Port V1's three pairing surfaces to SkyHub at new module slot **4.1.5**, preserving UX/UI fidelity while complying with SkyHub's design system, filter-panel kit, 400-LOC component limit, NativeWind-only styling, and multi-tenant (`operatorId`) data model. Text-based view ships functionally deep today; Gantt + Optimizer ship as shells with read-only render (Gantt) and animated mock run (Optimizer). Real optimizer solver deferred to Phase 4.

---

## Locked Decisions (user-confirmed)

1. **Module slot = 4.1.5 under Crew Ops › Control, rendered as THREE separate hub tiles** (user-confirmed refinement). The single `4.1.5 Crew Pairing` tile in `module-registry.ts:584` is replaced by three distinct level-2 tiles with 4-segment codes, each with its own route and page.tsx:
   - **`4.1.5.1`** Crew Pairing — Text-based — `/crew-ops/control/pairing/text`
   - **`4.1.5.2`** Crew Pairing — Gantt Chart — `/crew-ops/control/pairing/gantt`
   - **`4.1.5.3`** Pairing Optimizer — `/crew-ops/control/pairing/optimizer`
   - The existing `apps/web/src/app/crew-ops/control/pairing/page.tsx` stub becomes a **redirect to `/pairing/text`** (preserves URL as valid).
   - Three new route files created at `pairing/{text,gantt,optimizer}/page.tsx`, each rendering its dedicated shell.
   - A shared workspace context (filter panel, stores, period) stays consistent across the three routes via shared Zustand stores with session-persisted period — clicking between the three tiles feels like navigating a workspace, not isolated pages.
   - Stale legacy nav files (`packages/ui/src/navigation/navData.ts:567-573` and `navTree.ts:352-358`) still reference the old `4.1.1 /crew-ops/planning/crew-pairing`. Reconcile to match new 3-tile structure during Phase 0.
2. **Filter pattern = SkyHub left filter-panel kit** (`apps/web/src/components/filter-panel/`). Collapsible 300 px glass rail → 44 px collapsed. Draft-then-Go pattern. Same primitives used by Network Gantt + Schedule Grid + Manpower.
3. **Scope today = All 3 shells + Text view deep**: Text-based is fully wired (backend, CRUD, FDTL legality, filter panel); Gantt renders flight bars from real data but editing is read-only stubs; Optimizer is scenario list + mock solver ticker.
4. **Model naming**: existing `CrewPairing` (buddy-pairing) left untouched. NEW Mongoose model `Pairing` → new collection `pairings`. No migration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  apps/web/src/app/crew-ops/control/pairing/                         │
│    page.tsx         → redirects to /pairing/text                    │
│    text/page.tsx    → renders <PairingTextShell />      (4.1.5.1)   │
│    gantt/page.tsx   → renders <PairingGanttShell />     (4.1.5.2)   │
│    optimizer/page.tsx → renders <PairingOptimizerShell />(4.1.5.3)  │
│                                                                     │
│  apps/web/src/components/crew-ops/pairing/                          │
│    shell/   filter-panel/   text-view/   gantt-view/                │
│    optimizer-view/   dialogs/   shared/                             │
│                                                                     │
│  apps/web/src/stores/ (shared across the 3 routes)                  │
│    use-pairing-store  use-pairing-filter-store                      │
│    use-pairing-gantt-store  use-optimizer-store                     │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ TanStack Query + typed API client
┌──────────────────────┴──────────────────────────────────────────────┐
│  packages/api/src/client.ts  (new pairing methods)                  │
│  packages/logic/src/operating-pairing/  (FDTL engine port)          │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ Fastify REST
┌──────────────────────┴──────────────────────────────────────────────┐
│  server/src/routes/pairings.ts     (CRUD + legality + flight pool) │
│  server/src/routes/pairing-scenarios.ts  (optimizer scenarios)      │
│  server/src/models/Pairing.ts          PairingScenario.ts          │
│                    PairingConstraint.ts PairingCost.ts              │
└─────────────────────────────────────────────────────────────────────┘
```

**Reuse (zero new code)**: filter-panel kit, `apps/web/src/lib/gantt/` canvas primitives (layout-engine, hit-testing, draw-helpers), `use-gantt-store` pattern, `useRunwayLoader`, `ScreenContainer`/`PageShell`, existing `FdtlTable`/`FdtlScheme`/`FdtlRule` models + `packages/logic/src/fdtl/validator.ts`.

**Port verbatim from V1** (adapted to SkyHub rules): data model in `pairing-types.ts`, FDTL tier cascade in `pairing-legality-checker.ts`, reporting-time tables, augmented-crew suggestion, connectivity checks, Gantt virtualization math.

---

## Phase Plan — today's session

### Phase 0 — Prep (20 min)
- Copy this file to `C:\Users\ADMIN\horizon-v2-mono\PAIRING_MASTER_PLAN.MD` at repo root (first act on execution).
- **Update `packages/constants/src/module-registry.ts`** (canonical source): delete the single `4.1.5 Crew Pairing` entry (lines 583–592) and insert three level-2 entries in its place:
  ```ts
  { code:'4.1.5.1', name:'Crew Pairing — Text-based',
    description:'Build pairings from the flight pool with FDTL legality checks',
    icon:'List', route:'/crew-ops/control/pairing/text',
    parent_code:'4.1', module:'workforce', level:2 },
  { code:'4.1.5.2', name:'Crew Pairing — Gantt Chart',
    description:'Visualize and build pairings on an aircraft-row timeline',
    icon:'GanttChart', route:'/crew-ops/control/pairing/gantt',
    parent_code:'4.1', module:'workforce', level:2 },
  { code:'4.1.5.3', name:'Pairing Optimizer',
    description:'Generate optimal pairings under cost and FDTL constraints',
    icon:'Sparkles', route:'/crew-ops/control/pairing/optimizer',
    parent_code:'4.1', module:'workforce', level:2 },
  ```
- **Replace** `apps/web/src/app/crew-ops/control/pairing/page.tsx` (ComingSoon) with a server-side redirect to `/crew-ops/control/pairing/text`.
- **Create three new route pages**:
  - `apps/web/src/app/crew-ops/control/pairing/text/page.tsx` → `<PairingTextShell />`
  - `apps/web/src/app/crew-ops/control/pairing/gantt/page.tsx` → `<PairingGanttShell />`
  - `apps/web/src/app/crew-ops/control/pairing/optimizer/page.tsx` → `<PairingOptimizerShell />`
- Reconcile stale nav sources so all three agree on the 3-tile structure:
  - `packages/ui/src/navigation/navData.ts:567-573` — replace single entry with three page entries under `4.1 Control` section.
  - `packages/ui/src/navigation/navTree.ts:352-358` — same.

### Phase 1 — Backend & Shared Logic (90 min, parallel to Phase 2 UI once models land)

**Models** (new files under `server/src/models/`):

- **`Pairing.ts` → collection `pairings`**: see schema below. Indexes `{operatorId, scenarioId, startDate, endDate}`, `{operatorId, pairingCode}`, `{"legs.flightId": 1, "legs.flightDate": 1}`, `{operatorId, baseAirport, startDate}`. Legs **embedded** (MongoDB doc design; atomic updates; no cross-pairing leg analytics needed).
- **`PairingScenario.ts` → `pairingScenarios`**: weights, constraints summary, solver config, cached result.
- **`PairingConstraint.ts` → `pairingConstraints`**: one doc per (scenarioId, ruleCode).
- **`PairingCost.ts` → `pairingCosts`**: one doc per (scenarioId, category, itemKey).

Every `find` includes `operatorId: request.operatorId`. Stamping on create. 404-not-403 on cross-tenant access.

**Fastify routes** (new files under `server/src/routes/`):

- **`pairings.ts`** — GET `/pairings`, GET `/pairings/:id`, POST `/pairings`, PATCH `/pairings/:id`, DELETE `/pairings/:id`, POST `/pairings/bulk-delete`, POST `/pairings/copy`, POST `/pairings/legality/check`, GET `/pairings/flight-pool`, GET `/pairings/uncovered-count`, GET `/pairings/context`.
- **`pairing-scenarios.ts`** — full CRUD + `/:id/run` (stub), `/:id/status` (stub), `/:id/cancel`, `/:id/transfer-production`, constraints + costs sub-resources.

Registered in `server/src/index.ts` alongside existing routes. Zod schemas mirror the patterns in `server/src/routes/scenarios.ts`.

**Shared logic port** (new files under `packages/logic/src/operating-pairing/`):

```
packages/logic/src/operating-pairing/
├── types.ts              — Flight, Pairing, PairingLegMeta, LegalityCheck,
│                            LegalityResult, PairingOptions, CrewConfig,
│                            FdtlContext  (copy V1 pairing-types.ts)
├── fdp-tables.ts         — FDP lookup + tier cascade (normal/extended/augmented)
├── reporting-time.ts     — getReportingMinutes, DEFAULT_TIMING, ReportingTimeRow
├── connectivity.ts       — ground time, base routing, MULT detection, cross-midnight
├── augmented-crew.ts     — suggestAugmentedComplement
├── duty-math.ts          — FDP/duty/block/rest minute aggregators, rolling windows
├── legality-checker.ts   — orchestrator computeLegality(flights, options, fdtlContext)
└── index.ts              — public re-exports
```

V1's `pairing-legality-checker.ts` (47 KB, 1001 lines) is split into ~8 files each < 300 LOC. FDTL tables are NOT baked in — loaded from Mongo `FdtlTable` → passed as `FdtlContext`. Drop V1's hardcoded CAAV fallback; operators MUST configure FDTL before pairing works (error message).

**API client** — add to `packages/api/src/client.ts`:
types `ExpandedFlight`, `OperatingPairing`, `PairingLegRef`, `PairingScenarioRef`, `PairingConstraintRef`, `PairingCostRef`, `LegalityResult`, `WorkspaceContextRef`; methods `fetchPairings`, `fetchPairing`, `createPairing`, `updatePairing`, `deletePairing`, `bulkDeletePairings`, `copyPairings`, `checkPairingLegality`, `fetchPairingWorkspaceContext`, `fetchFlightPool`, `fetchUncoveredFlightCount`, `fetchPairingScenarios`, `createPairingScenario`, `updatePairingScenario`, `runPairingScenario`, `fetchPairingScenarioStatus`, `cancelPairingScenario`, constraints + costs helpers.

Query keys in `packages/api/src/query-keys.ts`: `['pairings', scenarioId, dateFrom, dateTo]`, `['pairing', id]`, `['pairing-scenarios']`, `['pairing-scenario', id]`, `['flight-pool', params]`, `['pairing-context']`.

### Phase 2 — Text View (4.1.5.1) — 3–4 h

Files under `apps/web/src/components/crew-ops/pairing/`, every file targets < 300 LOC. Source columns reference V1 files.

```
shell/
  pairing-shell.tsx            ~220  [layout + filter panel + view switcher + Runway loader]
  pairing-toolbar.tsx          ~260  [period display, scenario dropdown, zoom, uncovered count, create button]  ← from pairing-workspace.tsx
  pairing-view-switcher.tsx    ~80   [Text | Gantt | Optimizer segmented]

filter-panel/
  pairing-filter-panel.tsx     ~180  [composes FilterPanel kit — Period, Base, Fleet, Status, Duration, Scenario]

text-view/
  text-view-layout.tsx         ~120  [3-column flex: list | pool | inspector]
  pairing-list-panel/
    index.tsx                  ~220  ← from pairing-list-panel.tsx §header+body
    pairing-list-header.tsx    ~120  ← §header
    pairing-list-filter-bar.tsx ~180 ← §inline filters (status pills, duration)
    pairing-list-row.tsx       ~280  ← §row card + context menu
    pairing-list-empty.tsx     ~80   ← §empty state
  flight-pool-panel/
    index.tsx                  ~180  ← flight-pool-panel.tsx
    flight-pool-filter-bar.tsx ~120
    flight-pool-list.tsx       ~150
  inspector-panel/
    index.tsx                  ~220  ← pairing-inspector-panel.tsx mode router
    inspector-header.tsx       ~150  ← pairing code, status badge, actions
    build-mode-panel.tsx       ~260  ← selected flights, complement selector, Create
    legality-panel.tsx         ~200  ← FDTL rows
    inspector-footer.tsx       ~60   ← copy/delete/commit actions

shared/
  pairing-status-badge.tsx     ~70   [legal/warning/violation tri-state]
  legality-check-row.tsx       ~100
  context-menu.tsx             ~140  [radix-based]
  crew-complement-selector.tsx ~150  ← crew-complement-selector.tsx
  fleet-multi-select.tsx       ~120  [thin wrapper over MultiSelectField]

dialogs/
  copy-pairing-dialog.tsx      ~180  ← copy-pairing-dialog.tsx
  delete-period-dialog.tsx     ~150  ← delete-pairing-period-dialog.tsx
  adopt-scenario-dialog.tsx    ~120  ← scenario adopt flow
```

**Stores** (new files under `apps/web/src/stores/`):
- **`use-pairing-store.ts`** (~350 LOC) — period, scenarioId, selection, build mode, inspector target, pairing options. Session-persisted period via `sessionStorage.horizon_pairing_ws_period`.
- **`use-pairing-filter-store.ts`** (~80 LOC) — draft filters, `apply()` pushes to pairing store + triggers period commit.

**Visual polish (must-haves per CLAUDE.md)**:
- `<SectionHeader>` 3px accent bar on: Inspector sections (Flights, Legality, Crew Config), List panel header, Flight pool header.
- `<Card variant="glass">` on toolbar ribbon (matches `gantt-shell.tsx` pattern). Interior list/pool/inspector cards stay flat.
- Accent color ≥ 3 touches: filter panel active badge, view-switcher active tab, Create Pairing button (primary), selected-row left border, legality-pass bar.
- Shadow level 2 on workspace panels; level 3 on context menu; level 5 on dialogs.
- All icons via `<Icon name="..."/>` wrapper from `@horizon/ui` — zero emoji, zero direct `lucide-react-native` imports in screens.
- Status badges use XD vibrant RGBA (`colors.status.success`, `colors.status.warning`, `colors.status.error`), never Tailwind `bg-green-*` / `bg-red-*`.
- Min text 13 px throughout. Dark mode mandatory — every color via `useTheme()`.

**Keyboard shortcuts (port from V1)**:
- `Ctrl+Enter` → commit period
- `Ctrl+Z` → undo last flight selection
- `Escape` → close dialogs, clear build-mode selection
- `F2` → edit draft pairing (production only)
- `F5` → hard refresh context + pairings
- `F1` **reserved for Help** (per memory rule — do NOT bind)

### Phase 3 — Gantt View (4.1.5.2) — 2 h, read-only render

Files under `apps/web/src/components/crew-ops/pairing/gantt-view/`. Reuse `apps/web/src/lib/gantt/*` (layout-engine, hit-testing, draw-helpers, time-axis, colors).

```
gantt-view/
  gantt-view-shell.tsx         ~280  ← pairing-gantt-v2/gantt-shell.tsx
  pairing-gantt-canvas.tsx     ~400  [reuses lib/gantt primitives; adds pairing-zone overlays]
  pairing-gantt-toolbar.tsx    ~280  ← gantt-toolbar.tsx (zoom, row height, label mode, search, fullscreen)
  grid-body.tsx                ~280  ← grid-body.tsx  [DOM row overlays over canvas]
  gantt-left-panel.tsx         ~120  ← left-panel.tsx [reg labels, tail groups]
  gantt-inspector-panel.tsx    ~220  ← inspector-panel.tsx  [shares build-mode-panel + legality-panel from text-view/shared]
  pairing-zone-layer.tsx       ~250  ← pairing-zone.tsx (rendering half)
  pairing-zone-filters.tsx     ~80
  flight-tooltip.tsx           ~220  ← flight-tooltip.tsx
  hooks/
    use-pairing-zones.ts       ~180  ← pairing-zone.tsx (math half)
    use-row-layout.ts          ~120  ← hooks/use-row-layout.ts
    use-virtual-assignment.ts  ~150  ← hooks/use-virtual-assignment.ts
    use-gantt-keyboard.ts      ~100
```

**Store**: new `apps/web/src/stores/use-pairing-gantt-store.ts` (~250 LOC) — zoom, rowHeightLevel, labelMode, collapsedGroups, fullscreen, searchOpen, pairingZoneFilters, showChains, rowSortOrder.

**Today's scope (read-only render)**:
- Flights rendered from real `/pairings/flight-pool` API.
- Selection highlights work (click, shift-click, ctrl-click, rubber-band).
- Context menu opens; actions show toast ("Create pairing from Gantt coming soon") — actual creation defers to Text view.
- Fullscreen + zoom + row-height + search pill all functional.
- Pairing-zone overlays render for existing pairings (from same store as Text view).

Mutations (drag-to-reassign, pairing-zone build) punt to Phase 4.

### Phase 4 — Optimizer (4.1.5.3) — 2 h, shell + mock run

Files under `apps/web/src/components/crew-ops/pairing/optimizer-view/`.

```
optimizer-view/
  optimizer-view-shell.tsx              ~240  ← pairing-optimizer-workspace.tsx
  left-rail/
    scenario-header.tsx                 ~120  [rail header, new + compare]
    scenario-list.tsx                   ~220
    scenario-row.tsx                    ~220
    scenario-empty.tsx                  ~80
  center/
    center-tabs.tsx                     ~160
    tabs/objective-weights-tab.tsx      ~180
    tabs/constraints-tab.tsx            ~180
    tabs/results-tab.tsx                ~180
  right-rail/
    live-stats-panel.tsx                ~200
    run-controls.tsx                    ~140
    scenario-detail-panel.tsx           ~120
  dialogs/compare-dialog.tsx            ~220
```

**Store**: new `apps/web/src/stores/use-optimizer-store.ts` (~280 LOC) — scenarios, activeScenarioId, runStatus, liveStats, weights, constraints, costs, activeTab.

**Today's scope (mock run)**:
- Scenario CRUD functional (real backend).
- Weights / constraints / costs editable, persist via PATCH.
- `POST /pairing-scenarios/:id/run` returns `{status:'queued'}` (server-side stub — no solver).
- Client-side **mock ticker** in `packages/logic/src/operating-pairing/optimizer-mock.ts` (new) animates `liveStats` for 6–10 s, then writes a synthesized result doc. Status polling loop reads real DB.
- "Adopt to production" button shows dialog but its server action returns 501 today.

Real solver (Python + OR-Tools or similar) is **Phase 5 deferred**.

---

## Filter Panel Specification (Phase 2 detail)

Composition in `pairing-filter-panel.tsx` using SkyHub kit (`apps/web/src/components/filter-panel/`). Mirrors `gantt-filter-panel.tsx`.

| Section | V1 Control | V2 Kit Field | Store field |
|---|---|---|---|
| **Period** | from/to date inputs | `<PeriodField>` | `draft.from` / `draft.to` |
| **Base** | `<BaseMultiSelect>` | `<MultiSelectField>` over operator bases | `draft.baseAirports` |
| **Fleet** | `<FleetMultiSelect>` | `<MultiSelectField>` over aircraft types | `draft.aircraftTypes` |
| **Pairing Status** | radio All/Legal/Warning/Violation | `<MultiSelectField>` with color swatches | `draft.statusFilter` |
| **Duration** | checkboxes 1d..7d | `<MultiSelectField>` summaryBy="key" | `draft.durations` |
| **Scenario** | `<ScenarioDropdown>` | `<SelectField>` + "Production" sentinel | `draft.scenarioId` |
| **Workflow** | (derived from status) | `<SegmentedField>` Draft/Committed/All | `draft.workflowFilter` |

**Go button behavior** (`<FilterGoButton>`):
1. Read draft from `use-pairing-filter-store`.
2. Push values into `use-pairing-store` (setPeriod, setScenario, setFleet, setBase, setStatus, setDuration, setWorkflow).
3. Call `pairingStore.commitPeriod()` → triggers `fetchPairings` + `fetchFlightPool` via TanStack Query.
4. Filter panel collapses to 44 px rail (built-in).

**Active count badge** = number of draft fields differing from defaults (same pattern as `gantt-filter-panel.tsx:117`).

Inline in list panel (NOT filter panel): text search (pairing code / route chain prefix) — stays instant, mirrors V1.

---

## Navigation Data Change

Three nav sources exist. The live Crew Ops hub reads from `module-registry.ts` (correct). The other two are stale and must be reconciled.

1. **`packages/constants/src/module-registry.ts:584`** — canonical, already correct:
   ```ts
   { code: '4.1.5', name: 'Crew Pairing', route: '/crew-ops/control/pairing', ... }
   ```
   No change.

2. **`packages/ui/src/navigation/navData.ts:567-573`** — update in place:
   ```ts
   // before
   { key: 'crew-pairing', label: 'Crew Pairing', num: '4.1.1',
     route: '/crew-ops/planning/crew-pairing', iconName: 'Users',
     desc: 'Build pairings from flights' }
   // after
   { key: 'crew-pairing', label: 'Crew Pairing', num: '4.1.5',
     route: '/crew-ops/control/pairing', iconName: 'Users',
     desc: 'Build and optimize crew pairings aligned with FDTL limits' }
   ```
   Move entry from the `planning` (4.1) section to the `control` (4.1) section if navData.ts has a `control` section; otherwise match module-registry's grouping. Verify no downstream consumer breaks.

3. **`packages/ui/src/navigation/navTree.ts:352-358`** — same change as navData.ts.

Net effect: all three agree `4.1.5 Crew Pairing → /crew-ops/control/pairing` under section 4.1 Control. Sub-views 4.1.5.1 / .5.2 / .5.3 are in-page tabs and do NOT need separate nav entries.

---

## Files Reference

### Files to DELETE
- *(none — the existing `pairing/page.tsx` stub is replaced in place, not deleted)*

### Files to CREATE — Backend + Logic
- `server/src/models/Pairing.ts`
- `server/src/models/PairingScenario.ts`
- `server/src/models/PairingConstraint.ts`
- `server/src/models/PairingCost.ts`
- `server/src/routes/pairings.ts`
- `server/src/routes/pairing-scenarios.ts`
- `packages/logic/src/operating-pairing/{types,fdp-tables,reporting-time,connectivity,augmented-crew,duty-math,legality-checker,optimizer-mock,index}.ts`
- Updated: `server/src/index.ts` (register 2 routes)
- Updated: `packages/api/src/client.ts` (~20 methods + types)
- Updated: `packages/api/src/query-keys.ts`

### Files to CREATE — Frontend
- All files listed under Phase 2, 3, 4 tables above (40+ files under `apps/web/src/components/crew-ops/pairing/`).
- `apps/web/src/stores/use-pairing-store.ts`
- `apps/web/src/stores/use-pairing-filter-store.ts`
- `apps/web/src/stores/use-pairing-gantt-store.ts`
- `apps/web/src/stores/use-optimizer-store.ts`

### Files to UPDATE
- `apps/web/src/app/crew-ops/control/pairing/page.tsx` — replace `<ComingSoon />` with `<PairingShell />`
- `packages/ui/src/navigation/navData.ts` — reconcile entry (4.1.1 → 4.1.5, route, section)
- `packages/ui/src/navigation/navTree.ts` — same reconcile
- Root `PAIRING_MASTER_PLAN.MD` — copy from this draft on execution

### Files to REFERENCE (read but not modify)
- V1 source of truth for porting:
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\pairing-types.ts`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\pairing-legality-checker.ts`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\pairing-workspace.tsx`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\pairing-list-panel.tsx`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\pairing-inspector-panel.tsx`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\flight-pool-panel.tsx`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing\use-pairing-workspace.ts`
  - `C:\Users\ADMIN\horizon\components\workforce\pairing-gantt-v2\*.tsx`
  - `C:\Users\ADMIN\horizon\components\workforce\optimizer\*.tsx`
  - `C:\Users\ADMIN\horizon\app\actions\pairing-workspace-actions.ts`
  - `C:\Users\ADMIN\horizon\app\actions\optimizer-actions.ts`
- SkyHub reuse templates:
  - `apps/web/src/components/filter-panel/panel.tsx` (kit shell)
  - `apps/web/src/components/network/gantt/gantt-filter-panel.tsx` (filter composition template)
  - `apps/web/src/components/network/gantt/gantt-shell.tsx` (shell + Runway pattern)
  - `apps/web/src/components/crew-ops/manpower-planning/manpower-planning-shell.tsx` (tab + store pattern)
  - `apps/web/src/lib/gantt/{layout-engine,hit-testing,draw-helpers,types}.ts` (canvas primitives)
  - `apps/web/src/stores/use-gantt-store.ts` (Zustand pattern)

---

## Pairing Mongoose Schema (Phase 1 detail)

```ts
// server/src/models/Pairing.ts
// Operating pairing — sequence of flights worked as one duty trip.
// NOTE: server/src/models/CrewPairing.ts is buddy-pairing (affinity rules). Different concept.
const PairingSchema = new Schema({
  _id:              { type: String, default: () => randomUUID() },
  operatorId:       { type: String, required: true, index: true },
  scenarioId:       { type: String, default: null, index: true },  // null = production
  seasonCode:       { type: String, default: null },
  pairingCode:      { type: String, required: true },
  baseAirport:      { type: String, required: true },
  baseId:           { type: String, default: null },
  aircraftTypeIcao: { type: String, default: null },
  aircraftTypeId:   { type: String, default: null },
  fdtlStatus:       { type: String, enum: ['legal','warning','violation'], default: 'legal' },
  workflowStatus:   { type: String, enum: ['draft','committed'], default: 'draft' },
  totalBlockMinutes:{ type: Number, default: 0 },
  totalDutyMinutes: { type: Number, default: 0 },
  pairingDays:      { type: Number, default: 1 },
  startDate:        { type: String, required: true },  // 'YYYY-MM-DD' UTC
  endDate:          { type: String, required: true },
  reportTime:       { type: String, default: null },   // ISO UTC
  releaseTime:      { type: String, default: null },
  numberOfDuties:   { type: Number, default: 1 },
  numberOfSectors:  { type: Number, default: 0 },
  layoverAirports:  { type: [String], default: [] },
  complementKey:    { type: String, default: 'standard' },
  cockpitCount:     { type: Number, default: 2 },
  facilityClass:    { type: String, default: null },
  crewCounts:       { type: Schema.Types.Mixed, default: null },
  legs: [{
    _id: false,
    flightId:         { type: String, required: true },
    flightDate:       { type: String, required: true },  // 'YYYY-MM-DD'
    legOrder:         { type: Number, required: true },
    isDeadhead:       { type: Boolean, default: false },
    dutyDay:          { type: Number, required: true },
    depStation:       { type: String, required: true },
    arrStation:       { type: String, required: true },
    flightNumber:     { type: String, required: true },
    stdUtcIso:        { type: String, required: true },
    staUtcIso:        { type: String, required: true },
    blockMinutes:     { type: Number, required: true },
    aircraftTypeIcao: { type: String, default: null },
  }],
  lastLegalityResult: { type: Schema.Types.Mixed, default: null },
  createdBy:        { type: String, required: true },
  createdAt:        { type: String, required: true },
  updatedAt:        { type: String, required: true },
}, { collection: 'pairings' });

PairingSchema.index({ operatorId: 1, scenarioId: 1, startDate: 1, endDate: 1 });
PairingSchema.index({ operatorId: 1, pairingCode: 1 });
PairingSchema.index({ 'legs.flightId': 1, 'legs.flightDate': 1 });
PairingSchema.index({ operatorId: 1, baseAirport: 1, startDate: 1 });
```

Similar shape for `PairingScenario`, `PairingConstraint`, `PairingCost` — full schemas in `backend-design-plan` (agent plan). Transcribe on execution.

---

## Verification Plan

### Phase-by-phase smoke test

**Phase 1 (Backend)**
```
pnpm -w run typecheck --filter=server     # zero errors
pnpm -w run build --filter=server          # succeeds
pnpm --filter server dev                   # boots
```
Probe endpoints via curl with an operator JWT:
- `GET /pairings/context` → returns bases + aircraft types + FDTL tables
- `GET /pairings?dateFrom=2026-04-20&dateTo=2026-04-26` → returns `[]` initially
- `POST /pairings` with 2 connectable flight IDs → returns pairing w/ legality computed
- `DELETE /pairings/:id` → 204

**Phase 2 (Text view)**
```
pnpm -w run typecheck --filter=web
pnpm -w run lint --filter=web
pnpm -w run build --filter=web
pnpm --filter web dev
```
Open http://localhost:3000/crew-ops/planning/pairing-workspace:
- Filter panel renders at 300 px, collapses to 44 px rail.
- Tab bar shows Text | Gantt | Optimizer; Text is active.
- Period → Go → list populates with real pairings (or empty-state card).
- Create flow: toolbar "Build" → select ≥2 flights in pool → legality updates live in inspector → Create → new pairing appears in list.
- Context menu on list row → Delete → confirmation dialog → pairing gone.
- Toggle dark mode — colors invert cleanly, no white-on-white, no invisible borders.
- Accent color scan: count `bg-module-accent` / accent tokens in rendered DOM ≥ 3.
- Console: zero errors, zero warnings.

Design-system sweep (grep in new files):
- `rg "StyleSheet.create" apps/web/src/components/crew-ops/pairing` → 0 matches
- `rg "#[0-9a-fA-F]{3,6}" apps/web/src/components/crew-ops/pairing` → only dynamic runtime values allowed
- `rg "font-size: 12" apps/web/src/components/crew-ops/pairing` → 0 matches
- `rg "import.*from ['\"]lucide-react-native['\"]" apps/web/src/components/crew-ops/pairing` → 0 matches (must use `<Icon>`)
- All `*.tsx` in this tree < 400 LOC; flag any > 300 in review.

**Phase 3 (Gantt)**
- Switch to Gantt tab — canvas renders flights from same data set.
- Zoom 1D/3D/7D/14D/M buttons work.
- Row-height cycle works.
- Fullscreen toggles.
- `Ctrl+F` opens search pill; Esc closes.
- Hover flight bar → tooltip with STD/STA + flight #.
- Rubber-band selection highlights multiple flights (visual only — toast "Gantt build pending").

**Phase 4 (Optimizer)**
- Switch to Optimizer tab — scenario list shows real scenarios (or empty state w/ "New scenario" CTA).
- Create scenario → edit weights → PATCH hits server → persists on refresh.
- Click "Run" → status chip: Queued → Running → live-stats animate for ~6 s → Completed with mocked results.
- Click "Cancel" mid-run → status resets.
- Compare dialog opens and selects two scenarios (no diff math today — can be blank tables).

### End-of-day verification
- Run `/verify` skill → build + types + lint + convention scan pass.
- Run `/code-review` skill on the diff → flag any SkyHub design-system regressions.
- Commit with Conventional Commits: `feat(crew-ops/pairing): land 4.1.5 text workspace + gantt render + optimizer shell`.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| V1 `use-pairing-workspace.ts` (~1700 LOC) coupling hidden deps | High | Port in layers: state shape first (empty handlers) → data loading → mutations. Unit-test each layer before moving up. |
| FDTL engine port regressions | Medium | Golden-file tests: capture ~20 V1 `computeLegality` I/O fixtures, assert byte-identical `LegalityResult`. |
| V1 Gantt `pairing-zone.tsx` (525 LOC) overlay math tightly coupled to V1 primitives | Medium | Defer drag-and-build to Phase 5. Today's Gantt renders and shows tooltip only. |
| CLAUDE.md says Skia for Gantt but reality is Canvas 2D on web | Low | Use Canvas 2D for web (matches existing). Note discrepancy in PR description. Skia rule applies to future mobile Gantt, not web. |
| Optimizer scope creep (real solver) | High | Explicit stub/mock today. Optimizer backend run endpoint returns `{status:'failed', error:'solver_not_implemented'}` unless `MOCK_OPTIMIZER=1` env set — then mock ticker populates result. |
| Multi-tenant leak via pairing queries | Critical | Every route filters by `request.operatorId`. Cross-entity refs (flightIds) re-verify with `ScheduledFlight.find({_id:{$in:flightIds}, operatorId})`. 404-not-403 on miss. |
| Existing `CrewPairing` model confusion | Low | Add header comments in both models explaining the two distinct concepts. |
| 400-LOC discipline slip on Gantt canvas file | Medium | `pairing-gantt-canvas.tsx` is budgeted at 400 LOC — strict. If it exceeds, extract draw helpers into `apps/web/src/lib/gantt/` additions (shared with Network Gantt). |

---

## Out of Scope (today)

- Real optimizer solver (Python/OR-Tools) — Phase 5.
- Drag-to-reassign and pairing-zone build in Gantt — Phase 5.
- Supabase-style realtime subscriptions — use TanStack Query polling + stale-while-revalidate.
- Mobile port (Expo) — desk-first tool; mobile is future.
- Offline-first WatermelonDB model — server reads only today; offline sync later.
- Adopt-scenario-to-production action (returns 501 stub).
- PDF export of pairing reports.

---

## Execution Order Summary

1. **Step 0**: Copy this plan to `PAIRING_MASTER_PLAN.MD` at repo root.
2. **Step 1**: Reconcile `navData.ts` + `navTree.ts` to match `module-registry.ts` (4.1.5, `/crew-ops/control/pairing`, Control section).
3. **Step 2**: Create 4 Mongoose models + register in index.
4. **Step 3**: Create 2 Fastify route files + register in `server/src/index.ts`. Verify with curl.
5. **Step 4**: Port FDTL engine to `packages/logic/src/operating-pairing/` — 8 files. Golden-file tests.
6. **Step 5**: Extend `packages/api/src/client.ts` + query-keys.
7. **Step 6**: Create 4 Zustand stores.
8. **Step 7**: Implement Text-view files (Phase 2 table). Verify end-to-end.
9. **Step 8**: Implement Gantt-view files (Phase 3 table). Read-only verify.
10. **Step 9**: Implement Optimizer shell (Phase 4 table). Mock run verify.
11. **Step 10**: `/verify` + `/code-review` + commit.

Total target: ~7–8 hours focused execution. Parallelizable between backend (Steps 2–4) and early UI stores (Step 6) once types land.

---

**End of plan.**
