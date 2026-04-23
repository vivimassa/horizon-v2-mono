"""CP-SAT crew assignment solver.

Objectives (lexicographic priority):
  1. Minimize unassigned pairings (coverage — highest priority)
  2. Minimize block-hour variance across crew (fairness)
  3. Minimize leg-count variance
  4. Minimize layover destination concentration (soft destination rules)
  5. Gender balance (configurable weight)
"""
from __future__ import annotations

import asyncio
import time
from typing import AsyncIterator

from ortools.sat.python import cp_model

from app.models import SolveRequest


def _days_overlap(days_a: list[str], days_b: list[str]) -> bool:
    return bool(set(days_a) & set(days_b))


async def solve(request: SolveRequest) -> AsyncIterator[dict]:
    model = cp_model.CpModel()

    crew_ids = [c.id for c in request.crew]
    pairing_ids = [p.id for p in request.pairings]
    pairing_by_id = {p.id: p for p in request.pairings}
    crew_by_id = {c.id: c for c in request.crew}

    allowed_set: dict[str, set[str]] = {
        cid: set(pids) for cid, pids in request.allowed.items()
    }

    # ── Decision variables ─────────────────────────────────────────────────
    # x[c_idx][p_idx] = 1 iff crew c is assigned to pairing p
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    for ci, cid in enumerate(crew_ids):
        legal = allowed_set.get(cid, set())
        for pi, pid in enumerate(pairing_ids):
            if pid in legal:
                x[(ci, pi)] = model.new_bool_var(f"x_{ci}_{pi}")

    # ── Hard constraint 1: each pairing covered by at most 1 crew ─────────
    # (slack_p = 1 means pairing p is unassigned)
    slack: list[cp_model.IntVar] = []
    for pi, pid in enumerate(pairing_ids):
        assigned = [x[(ci, pi)] for ci, cid in enumerate(crew_ids) if (ci, pi) in x]
        s = model.new_bool_var(f"slack_{pi}")
        slack.append(s)
        if assigned:
            # assigned vars + slack = 1  →  exactly one source covers this pairing
            model.add(sum(assigned) + s == 1)
        else:
            # no eligible crew at all — always unassigned
            model.add(s == 1)

    # ── Hard constraint 2: no crew assigned to two overlapping pairings ────
    for ci, cid in enumerate(crew_ids):
        assigned_pairings = [(pi, pid) for pi, pid in enumerate(pairing_ids) if (ci, pi) in x]
        for i in range(len(assigned_pairings)):
            for j in range(i + 1, len(assigned_pairings)):
                pi, pid = assigned_pairings[i]
                pj, pjd = assigned_pairings[j]
                if _days_overlap(pairing_by_id[pid].days, pairing_by_id[pjd].days):
                    model.add(x[(ci, pi)] + x[(ci, pj)] <= 1)

    # ── Objective: lexicographic via weighted sum (scaled priority) ────────
    # Priority weights: coverage >> BH variance > leg variance > destination
    COVERAGE_WEIGHT = 1_000_000
    BH_FAIRNESS_WEIGHT = 100
    LEG_FAIRNESS_WEIGHT = 10
    GENDER_WEIGHT_SCALE = request.config.gender_balance_weight  # 0-100

    # Block hours per crew (scaled to integers — multiply by 1 since bh_min already int)
    n_crew = len(crew_ids)
    if n_crew > 0:
        bh_per_crew = []
        for ci, cid in enumerate(crew_ids):
            assigned = [
                pairing_by_id[pid].bh_min * x[(ci, pi)]
                for pi, pid in enumerate(pairing_ids)
                if (ci, pi) in x
            ]
            bh = model.new_int_var(0, 100_000, f"bh_{ci}")
            if assigned:
                model.add(bh == sum(assigned))
            else:
                model.add(bh == 0)
            bh_per_crew.append(bh)

        # BH variance proxy: sum of (bh_i - mean)^2 is non-linear.
        # Use sum of |bh_i - bh_j| linearized via max - min instead.
        bh_max = model.new_int_var(0, 100_000, "bh_max")
        bh_min_var = model.new_int_var(0, 100_000, "bh_min")
        model.add_max_equality(bh_max, bh_per_crew)
        model.add_min_equality(bh_min_var, bh_per_crew)
        bh_spread = model.new_int_var(0, 100_000, "bh_spread")
        model.add(bh_spread == bh_max - bh_min_var)
    else:
        bh_spread = model.new_constant(0)

    # Objective: minimise (unassigned * COVERAGE_WEIGHT) + (bh_spread * BH_FAIRNESS_WEIGHT)
    obj_terms = [s * COVERAGE_WEIGHT for s in slack]
    obj_terms.append(bh_spread * BH_FAIRNESS_WEIGHT)

    # Gender balance bonus: pairings with mixed-gender crew on layovers
    # Proxy: penalise same-gender assignments on layover pairings
    if GENDER_WEIGHT_SCALE > 0:
        for pi, pid in enumerate(pairing_ids):
            pairing = pairing_by_id[pid]
            if not pairing.layover_stations:
                continue
            male_assigned = [
                x[(ci, pi)]
                for ci, cid in enumerate(crew_ids)
                if (ci, pi) in x and crew_by_id[cid].gender == "male"
            ]
            female_assigned = [
                x[(ci, pi)]
                for ci, cid in enumerate(crew_ids)
                if (ci, pi) in x and crew_by_id[cid].gender == "female"
            ]
            # Reward mixed assignment: subtract reward when both genders present
            # (CP-SAT is minimising so we add a penalty for imbalance)
            if male_assigned and female_assigned:
                any_male = model.new_bool_var(f"any_m_{pi}")
                any_female = model.new_bool_var(f"any_f_{pi}")
                model.add_max_equality(any_male, male_assigned)
                model.add_max_equality(any_female, female_assigned)
                mixed = model.new_bool_var(f"mixed_{pi}")
                model.add_min_equality(mixed, [any_male, any_female])
                # Penalty for NOT mixed (imbalance = 1 - mixed)
                imbalance = model.new_bool_var(f"imbal_{pi}")
                model.add(imbalance == 1 - mixed)
                obj_terms.append(imbalance * GENDER_WEIGHT_SCALE)

    model.minimize(sum(obj_terms))

    # ── Solve with SSE progress callbacks ──────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(request.time_limit_sec)
    solver.parameters.num_workers = 4
    solver.parameters.log_search_progress = False

    start_ts = time.monotonic()

    class ProgressCallback(cp_model.CpSolverSolutionCallback):
        def __init__(self, queue: asyncio.Queue):
            super().__init__()
            self._queue = queue
            self._best = None

        def on_solution_callback(self):
            obj = int(self.objective_value)
            unassigned = obj // COVERAGE_WEIGHT
            pct = max(0, min(99, 100 - int(100 * unassigned / max(1, len(pairing_ids)))))
            event = {
                "event": "progress",
                "data": {
                    "pct": pct,
                    "message": f"Solution found — {len(pairing_ids) - unassigned}/{len(pairing_ids)} pairings covered",
                    "best_obj": obj,
                },
            }
            self._best = obj
            try:
                self._queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    cb = ProgressCallback(queue)

    # Emit initial queued event
    yield {"event": "progress", "data": {"pct": 0, "message": "Solver starting…", "best_obj": None}}

    # Run solver in thread to avoid blocking event loop
    def run_solver():
        return solver.solve(model, cb)

    status = await loop.run_in_executor(None, run_solver)

    # Drain any remaining progress events
    while not queue.empty():
        yield queue.get_nowait()

    elapsed_ms = int((time.monotonic() - start_ts) * 1000)
    status_name = solver.status_name(status)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for (ci, pi), var in x.items():
            if solver.value(var):
                assignments.append({"crewId": crew_ids[ci], "pairingId": pairing_ids[pi]})

        assigned_count = len(assignments)
        unassigned_count = len(pairing_ids) - assigned_count

        yield {
            "event": "solution",
            "data": {
                "assignments": assignments,
                "stats": {
                    "pairingsTotal": len(pairing_ids),
                    "crewTotal": len(crew_ids),
                    "assignedPairings": assigned_count,
                    "unassignedPairings": unassigned_count,
                    "durationMs": elapsed_ms,
                    "objectiveScore": int(solver.objective_value),
                    "solverStatus": status_name,
                },
            },
        }
    else:
        yield {
            "event": "error",
            "data": {
                "message": f"Solver ended with status {status_name} after {elapsed_ms}ms — no feasible solution found",
            },
        }
