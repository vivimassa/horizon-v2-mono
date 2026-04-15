# Disruption Management (2.1.3.3) — Follow-ups

Module: `/flight-ops/control/disruption-center/disruption-management`
Primary files:

- Shell: `apps/web/src/components/disruption-center/disruption-center-shell.tsx`
- Filter panel: `apps/web/src/components/disruption-center/disruption-filter-panel.tsx`
- Feed: `apps/web/src/components/disruption-center/disruption-feed.tsx`
- Detail panel: `apps/web/src/components/disruption-center/disruption-detail-panel.tsx`
- Store: `apps/web/src/stores/use-disruption-store.ts`
- API routes: `server/src/routes/disruptions.ts`
- Rule engine: `packages/logic/src/disruption/detectors.ts`
- Signal type contract: `packages/logic/src/disruption/types.ts`

Context behind what is already done lives in the plan file at
`C:\Users\ADMIN\.claude\plans\hidden-tinkering-rose.md`. This file
captures only what remains.

---

## 1. Auto-refresh tick for rolling mode

**What's there:** Rolling-period slider (default 3D) is wired and resolves
to `today → today+N` at scan time. Scan only runs when the user clicks the
Scan button.

**What's missing:** A refresh interval that re-runs scan while rolling mode
is active, mirroring Movement Control
(`apps/web/src/components/flight-ops/gantt/movement-control-shell.tsx:77-86`).

**Plan:**

- Add `refreshIntervalMins` to `useDisruptionStore` (default 5; same clamp
  range Movement Control uses — 5..59).
- In `DisruptionCenterShell`, add a `useEffect` that sets an interval when
  `hasScanned && filters.rollingPeriodDays !== null`. Each tick re-invokes
  `handleGo` silently (no runway animation on auto-refresh — only the
  in-panel `loading` spinner on `FilterGoButton`).
- Stop the interval when the user flips rolling to Off, unmounts, or
  manually triggers a fresh scan.

**Effort:** ~30 min. Self-contained in the shell and store.

**Risk:** Auto-scans hit `/disruptions/scan` which writes to the DB on
every run. Keep the rule engine idempotent (already is — upserts on
`sourceAlertId`).

---

## 2. Pre-select disrupted flight in recovery dialog

**What's there:** "Plan recovery" action in the detail panel deep-links to
Movement Control with `?disruptionId=…&openRecovery=1`. Movement Control
opens the recovery dialog automatically
(`apps/web/src/components/flight-ops/gantt/ops-toolbar.tsx:92-98`).

**What's missing:** `disruptionId` currently carries no weight — the
dialog opens on the same default flight set. Desired behaviour is that
the disrupted flight is pre-focused (e.g. pre-filtered, highlighted, or
the solver's available-flights set is narrowed to its rotation).

**Plan:**

- In `ops-toolbar.tsx`, resolve `disruptionId` via `api.getDisruption(id)`
  to get the flight number + date.
- Pass the resolved flight into `RecoveryDialog` via a new prop:
  `focusFlight?: { flightNumber: string; forDate: string; tail?: string }`.
- Inside `recovery-dialog.tsx`, use `focusFlight` to either:
  (a) preselect it on the config step, or
  (b) inject a solver constraint that locks the rest of the fleet and only
  evaluates solutions touching that flight.
- Server change (optional): extend `/recovery/solve` body with `focusFlightId`
  so the Python solver can prioritise.

**Effort:** ~1–2 hrs depending on solver integration depth.

**Risk:** Changing solver payload requires coordination with the Python
service. Stick with client-side preselect first; revisit solver change only
if the preselect is insufficient.

---

## 3. Cost + delay estimates on suggested actions

**What's there:** `SuggestedAction` type in
`packages/logic/src/disruption/types.ts:17-29` already defines
`estimatedDelayMinutes` and `estimatedCostUsd`. Detail panel's
`deriveActions()` currently returns hard-coded labels per category with no
numbers.

**What's missing:** Detectors populate the estimates; detail panel displays
them beside the action buttons (V1 regret was purely textual
recommendations).

**Plan:**

- In each detector in `packages/logic/src/disruption/detectors.ts`, compute
  the rough cost/delay impact. Reuse the same cost model the recovery
  solver uses (`server/src/routes/recovery.ts:40-44`):
  `delayCostPerMinute`, `cancelCostPerFlight`, `fuelPricePerKg`. Pull
  operator defaults via `Operator.findById(operatorId).recoveryConfig`.
- Populate `suggestedActions[].estimatedDelayMinutes` and
  `estimatedCostUsd` on each emitted signal.
- Extend `DisruptionIssue` schema + `mapSignalToIssueFields` in
  `server/src/routes/disruptions.ts` to persist `suggestedActions`.
- Extend `DisruptionIssueRef` in `packages/api/src/client.ts` to include
  `suggestedActions`.
- In `disruption-detail-panel.tsx`, replace `deriveActions()` with
  `issue.suggestedActions` and render the numbers as secondary text on
  each action card (e.g. `~12 min delay · $3,400`).

**Effort:** ~2–3 hrs. Touches model, route, detector logic, API types, UI.

**Risk:** Storing suggestedActions in the issue doc grows the row. Keep
actions minimal (3-5 fields per action) and cap array length at 5.

---

## 4. Empty-state copy + affordance before first scan

**What's there:** Before the first scan, the workspace card shows
`<EmptyPanel message="Set filters on the left and click Scan to load disruptions" />`.
Functional but lifeless.

**What's missing:**

- Better guidance about the default rolling window.
- Acknowledge that rolling is on by default (3 days forward).
- Optional: trigger an initial scan automatically on mount if the user has
  an operator selected and rolling is on — skip the empty state entirely.

**Plan:**

- Update `EmptyPanel` message in `disruption-center-shell.tsx:108` to
  something like:
  `"Rolling 3-day window — click Scan to load live disruptions."`
  (conditional: if rollingPeriodDays is set, mention the window; if off,
  remind the user to pick a period).
- Optional auto-scan on mount: in the `operatorId` effect, call
  `handleGo()` once when rollingPeriodDays is non-null. Gate behind a
  `skipAutoScan` flag so it doesn't fight with manual refresh.

**Effort:** ~15 min.

**Risk:** Auto-scan surprises users who navigate here and don't want to
kick off a backend run. Default `skipAutoScan = false` but add a toggle
in the shell if it becomes noisy.

---

## Suggested order for tomorrow

1. **#4** (15 min) — cheap win, improves first-impression.
2. **#1** (30 min) — rolling mode feels broken without it.
3. **#3** (2–3 hr) — the highest user value, but biggest scope.
4. **#2** (1–2 hr) — finishing the V1 → V2 recovery loop. Defer if
   solver work is required.
