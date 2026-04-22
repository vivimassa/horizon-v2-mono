# Automatic Crew Assignment (4.1.6.1) — Implementation Plan

## Context

Module 4.1.6 Crew Scheduling was split into two children:

- **4.1.6.1 Automatic Crew Assignment** — currently a "Coming soon" stub.
- **4.1.6.2 Crew Schedule — Gantt Chart** — the existing manual drag-drop planner.

  4.1.6.2 already carries:

- Data-driven FDTL validator (`validateCrewAssignment`) with 7 generic evaluators keyed on `computation_type`.
- Pure duty builder (`buildScheduleDuties` / `buildCandidateDuty`).
- Pure seat-eligibility check (`isEligibleForSeat`).
- Server aggregator that derives the per-period uncrewed shortfall list.
- Commander-discretion override capture + audit collection.

A **Clear Assignments** function does NOT yet exist. It must be built as part of this feature — it's the authoritative undo path for auto-commit (the user's expected workflow: solve → review → wipe → re-tune → re-solve).

Auto-Roster will consume those primitives and add a constraint solver that fills every uncrewed seat in a user-picked period + filter scope under FDTL + eligibility constraints. Chosen solver: **Google OR-Tools CP-SAT** via a Python microservice (same deployment pattern as the existing ML Cloud Run service).

Objective hierarchy (lexicographic):

1. **Coverage** — maximize seats filled.
2. **Balanced Block Hours** — minimize variance of total block time per crew across the period.
3. **Balanced Flight Legs** — minimize variance of sector count per crew.
4. **Balanced Layovers** — minimize variance of overnight-away counts per crew.

Behavior:

- **Auto-commit** on solve. Planner uses `Clear Assignments` to wipe and re-run.
- **Partial solve**: fill whatever is legal, leave infeasible seats in the uncrewed tray. Report gap count.
- **Server-side streaming (SSE)** so the UI shows live progress + cancel; survives tab close via persisted `AutoRosterRun` doc.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│ apps/web  /crew-ops/control/crew-scheduling/ │
│           auto-roster/page.tsx               │
│  • Config form (period, base, ac-type)       │
│  • Objective-weights slider (future)         │
│  • Run button → EventSource(SSE)             │
│  • Live progress bar + gap report            │
│  • "Open Gantt" link after apply             │
└───────────────────┬──────────────────────────┘
                    │ GET /auto-roster/stream?runId=...
                    ▼
┌──────────────────────────────────────────────┐
│ server/src/routes/auto-roster.ts (Fastify)   │
│  POST  /auto-roster/run   → spawn run        │
│  GET   /auto-roster/stream/:runId → SSE      │
│  GET   /auto-roster/runs  → list history     │
│                                              │
│  Orchestrator (TS):                          │
│    1. Load period uncrewed + eligible crew   │
│    2. Pre-filter ineligible (AC type + rank) │
│    3. POST problem JSON to Python service    │
│    4. Stream Python progress back via SSE    │
│    5. Validate each assignment through       │
│       validateCrewAssignment() (safety net)  │
│    6. Bulk-insert CrewAssignment (commit)    │
│    7. Upsert AutoRosterRun stats             │
└───────────────────┬──────────────────────────┘
                    │ HTTP / gRPC
                    ▼
┌──────────────────────────────────────────────┐
│ services/auto-roster-solver (Python)         │
│  POST /solve  { problem, objectives }        │
│    ├─ Build CP-SAT model                     │
│    ├─ Add hard constraints (FDTL, eligibility│
│    ├─ Lexicographic objectives               │
│    └─ Stream callback logs                   │
│  Returns { assignments, gaps, stats }        │
└──────────────────────────────────────────────┘
```

---

## Phase Plan

### Phase 0 — Clear Assignments (prerequisite)

**New endpoint:** `DELETE /crew-schedule/assignments/bulk` in `server/src/routes/crew-schedule.ts`.

- Body: `{ fromIso, toIso, baseIds?, acTypeIcaos?, positionIds?, crewIds?, scenarioId? }`.
- Filters `CrewAssignment` docs whose `startUtcIso/endUtcIso` overlap the window AND (crew matches filter OR pairing matches filter).
- Strategy: soft-set `status='cancelled'` (keeps audit history + lets downstream reconcile) rather than hard-delete. Same shape as individual cancel in existing POST.
- On success: re-invoke `reevaluateCrewRoster` so `CrewLegalityIssue` entries tied to wiped assignments prune.
- Response: `{ cancelled: number, periodFromIso, periodToIso }`.

**API client:** `api.clearCrewAssignments(payload)` in `packages/api/src/client.ts`.

**UI affordances:**

- Gantt-chart page: Ribbon toolbar → "Clear Assignments…" button (destructive style). Opens confirm dialog with period + filter summary.
- Auto-Roster page: "Clear & Re-run" button on result card (one-click undo → re-solve).

### Phase A — Data layer + types (server + @skyhub/api)

**Files:**

- `server/src/models/AutoRosterRun.ts` (new) — mirror `OptimizerRun.ts` pattern.
  - Fields: `_id, operatorId, scenarioId?, periodFromIso, periodToIso, filters, status ('queued'|'running'|'ok'|'error'|'cancelled'), stats, startedAtUtc, finishedAtUtc, elapsedMs, errorMessage?`
  - Stats: `totalPairings, totalSeats, assigned, unfilled, ineligibleCount, objectiveValues { coverage, bhVar, legVar, layoverVar }`
- `packages/api/src/client.ts` — add `AutoRosterRunRef`, `api.startAutoRosterRun`, `api.getAutoRosterRun`, `api.listAutoRosterRuns`, `api.openAutoRosterStream(runId)` (returns EventSource).

### Phase B — Python solver service

**New package:** `services/auto-roster-solver/` (FastAPI + OR-Tools CP-SAT)

- `app.py` — `POST /solve` endpoint, `GET /healthz`.
- `model.py` — CP-SAT model builder:
  - **Vars**: `x[crewId, pairingId, seatPositionId, seatIndex] ∈ {0,1}`.
  - **Coverage constraint**: `sum over crew = demand` per (pairing, seat, index).
  - **Exclusivity**: each crew on ≤ 1 concurrent pairing (time-overlap clique).
  - **FDTL constraints** injected as pre-computed infeasibility list from the TS side (see Phase C rationale).
  - **Objectives** (lexicographic via AddHint + layered Optimize):
    - `Maximize sum(x)` (coverage)
    - Then minimize `sum(|bh[i] - meanBh|)` (block balance — L1 surrogate for variance)
    - Then minimize `sum(|legs[i] - meanLegs|)`
    - Then minimize `sum(|layovers[i] - meanLayovers|)`
- `requirements.txt` — ortools, fastapi, uvicorn.
- `Dockerfile` — slim Python base, healthcheck, PORT env.
- Deployment: Cloud Run beside existing ML service.

### Phase C — TS Orchestrator (FDTL compile step)

**Key insight:** CP-SAT doesn't natively understand FDTL. Strategy:

1. For each (crew, pairing) candidate pair, pre-compute FDTL legality via `validateCrewAssignment` in TS. Emit a boolean `allowed[crew][pairing]` matrix.
2. Ship that matrix + cumulative-window aggregates to Python. Python treats FDTL as hard constraint: `x[c,p,s,i] = 0` whenever `!allowed[c][p]`.
3. For **inter-pairing rolling cumulative** (MAX_BLOCK_28D, etc.), Python adds:
   - `sum(x[c,p,*,*] * pairingBlockMin[p]) ≤ limitMin - priorBlockMin[c]` per crew per window.
4. This keeps the FDTL logic inside `@skyhub/logic` (single source of truth) while letting CP-SAT optimize the global choice.

**New file:** `server/src/services/auto-roster-orchestrator.ts`

- `buildProblem(operatorId, period, filters)` — assembles JSON for Python.
- Reuses:
  - `loadSerializedRuleSet` (server/src/services/fdtl-rule-set.ts)
  - `buildScheduleDuties` + `buildCandidateDuty` (@skyhub/logic)
  - `validateCrewAssignment` (@skyhub/logic)
  - `isEligibleForSeat` (moved to @skyhub/logic first — currently only in apps/web)
  - Uncrewed derivation from `crew-schedule.ts:260-299`
- `commitSolution(runId, assignments)` — bulk `CrewAssignment.insertMany` with status='planned', then re-invoke `reevaluateCrewRoster` so left-panel badges pick up the new state.
- SSE progress events: `{ phase: 'preflight' | 'compiling' | 'solving' | 'committing' | 'done', pct, msg }`.

### Phase D — Fastify routes

**New file:** `server/src/routes/auto-roster.ts`

- `POST /auto-roster/run` — body `{ fromIso, toIso, baseIds?, acTypeIcaos?, positionIds?, scenarioId? }`. Creates `AutoRosterRun(status='queued')`, returns `{ runId }`. Spawns async orchestrator (not awaited).
- `GET /auto-roster/stream/:runId` — SSE stream; ends on `done | error | cancelled`.
- `POST /auto-roster/run/:runId/cancel` — sets `cancelled`; orchestrator polls.
- `GET /auto-roster/runs?from=&to=` — list with stats.
- `GET /auto-roster/runs/:runId` — single run detail.
- Register in `server/src/routes/index.ts`.

### Phase E — Move `isEligibleForSeat` to @skyhub/logic

Currently at `apps/web/src/lib/crew-schedule/seat-eligibility.ts`. Orchestrator needs it server-side. Move to `packages/logic/src/crew/seat-eligibility.ts`, keep the apps/web file as a thin re-export so existing imports don't break.

### Phase F — UI: Auto-Roster page

Replace stub at `apps/web/src/app/crew-ops/control/crew-scheduling/auto-roster/page.tsx`:

- **Config panel** (left): date-range picker, base multi-select, AC-type multi-select, position multi-select (optional), objective-weights placeholder for later.
- **Run button**: disabled until valid config; on click → `api.startAutoRosterRun` → opens EventSource.
- **Progress panel** (right): large progress bar, phase text, live stats (pairings processed, legal candidates found, seats filled so far). Cancel button.
- **Result card**: when status=ok, show coverage metric (e.g., 487/512 seats, 95.1%), objective scores (bh variance, leg variance, layover variance), button "Open Gantt in period" (→ gantt-chart route with period query).
- **History list**: collapsible — last 10 runs, click to re-open result card.

### Phase G — Safety net + observability

- After orchestrator receives solver output, re-validate each assignment via `validateCrewAssignment` before commit. Any violation = reject that assignment, increment `ineligibleCount`. Prevents solver bugs from producing illegal rosters.
- Log structured JSON: `{ runId, phase, elapsedMs, seatsFilled, infeasiblePairs }` so ops can correlate.
- Emit Prometheus metrics: `auto_roster_runs_total{status}`, `auto_roster_duration_seconds`, `auto_roster_coverage_ratio`.

---

## Critical Files to Modify or Create

| Path                                                                         | Action                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------- |
| `services/auto-roster-solver/app.py`                                         | Create (Python FastAPI + OR-Tools)                 |
| `services/auto-roster-solver/model.py`                                       | Create (CP-SAT model)                              |
| `services/auto-roster-solver/Dockerfile`                                     | Create                                             |
| `server/src/models/AutoRosterRun.ts`                                         | Create                                             |
| `server/src/routes/auto-roster.ts`                                           | Create                                             |
| `server/src/services/auto-roster-orchestrator.ts`                            | Create                                             |
| `server/src/routes/index.ts`                                                 | Register new route                                 |
| `packages/logic/src/crew/seat-eligibility.ts`                                | Move from apps/web                                 |
| `apps/web/src/lib/crew-schedule/seat-eligibility.ts`                         | Thin re-export                                     |
| `packages/api/src/client.ts`                                                 | Add AutoRosterRunRef + methods                     |
| `apps/web/src/app/crew-ops/control/crew-scheduling/auto-roster/page.tsx`     | Replace stub                                       |
| `server/src/routes/crew-schedule.ts`                                         | Add `DELETE /assignments/bulk` (Clear Assignments) |
| `apps/web/src/components/crew-ops/schedule/crew-schedule-ribbon-toolbar.tsx` | Add "Clear Assignments…" button + confirm dialog   |

## Reused (not modified)

- `packages/logic/src/fdtl/crew-schedule-validator.ts` — `validateCrewAssignment`
- `packages/logic/src/fdtl/evaluators.ts` — evaluator registry
- `packages/logic/src/fdtl/schedule-duty-builder.ts` — `buildScheduleDuties` / `buildCandidateDuty`
- `server/src/services/fdtl-rule-set.ts` — `loadSerializedRuleSet`
- `server/src/services/evaluate-crew-roster.ts` — re-invoked post-commit
- `server/src/routes/crew-schedule.ts:260-299` — uncrewed derivation logic (extract to helper)

---

## Verification

### Unit

- `packages/logic/src/crew/seat-eligibility.test.ts` — pure function, cover downrank flag + family AC.
- Python solver: `test_model.py` — small handcrafted cases (3 crew, 3 pairings), assert coverage + variance.

### Integration

- `server/src/services/auto-roster-orchestrator.test.ts` — stub Python service, assert FDTL pre-filter emits correct `allowed[c][p]` and commit inserts CrewAssignment docs.
- `server/src/routes/auto-roster.test.ts` — SSE stream lifecycle; cancel mid-solve.

### E2E

1. Seed operator with 20 crew + 30 pairings across 7 days, unassigned.
2. `POST /auto-roster/run` with full-period filter.
3. Watch SSE stream to completion.
4. Assert:
   - `GET /crew-schedule/uncrewed` returns gap ≤ solver-reported unfilled.
   - `GET /crew-schedule/reevaluate-roster` reports 0 FDTL violations post-commit.
   - Each crew's total block hours within ±10% of the fleet mean (balanced objective met).
5. Call `Clear Assignments` → re-run → assert idempotent.

### Manual UX

- Solver must emit progress events within 2s of Run click (UX floor).
- Cancel button must abort solver within 5s.
- Partial solve must render "N seats unfilled" banner with link to uncrewed tray.

---

## Out of scope for MVP

- Seniority bidding / preference bid system.
- Training / leave / medical availability checks (validator gap; flagged in Phase G as future).
- Crew-group (e.g., trainer-trainee pairing).
- Cost-based objective (per-diem, positioning).
- Multi-scenario comparison (parallel runs against different `scenarioId`).
- Undo individual assignment (use Clear Assignments for bulk).
