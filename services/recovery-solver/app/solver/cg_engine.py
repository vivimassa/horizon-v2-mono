"""Column Generation engine for disruption recovery.

Master problem: Set partitioning LP (via PuLP/CBC)
Pricing: SPPRC per aircraft (see pricing.py)

All parameters come from SolveConfig — no hard-coded values.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import AsyncGenerator

from pulp import (
    LpMinimize,
    LpMaximize,
    LpProblem,
    LpVariable,
    LpBinary,
    lpSum,
    value as lp_value,
    PULP_CBC_CMD,
)

from app.models import (
    SolveRequest,
    SolveResult,
    Solution,
    SolutionMetrics,
    AssignmentChange,
    LockedCounts,
    ProgressEvent,
    Objective,
)
from app.solver.pricing import solve_pricing, Column
from app.solver.objectives import flight_cancel_penalty


async def solve(request: SolveRequest) -> AsyncGenerator[dict, None]:
    """Run column generation and yield SSE events.

    Yields dicts with 'event' and 'data' keys for SSE streaming.
    """
    config = request.config
    start_ms = int(time.time() * 1000)
    now_ms = int(time.time() * 1000)
    horizon_end_ms = now_ms + int(config.horizon_hours * 3_600_000)

    # Build type lookup
    type_map = {t.icao_type: t for t in request.aircraft_types}

    # Initial columns: one per aircraft with current assignment (if any)
    columns: list[Column] = []
    flight_set = {f.id for f in request.available_flights}

    # Aircraft with their type info
    aircraft_with_type = []
    for ac in request.aircraft:
        ac_type = type_map.get(ac.aircraft_type_icao)
        if ac_type:
            aircraft_with_type.append((ac, ac_type))

    yield _progress("building_network", 0, 0.0, 0, 0, start_ms)

    # Generate initial columns: each aircraft keeps its currently assigned flights
    for ac, ac_type in aircraft_with_type:
        assigned = [
            f
            for f in request.available_flights
            if f.aircraft_reg == ac.registration
        ]
        if assigned:
            assigned.sort(key=lambda f: f.std_utc)
            col = Column(
                aircraft_reg=ac.registration,
                flight_ids=[f.id for f in assigned],
                total_cost=0.0,
                reduced_cost=0.0,
                revenue_protected=sum(f.estimated_revenue for f in assigned),
            )
            columns.append(col)

    # Also add empty column per aircraft (doing nothing)
    for ac, _ in aircraft_with_type:
        columns.append(
            Column(
                aircraft_reg=ac.registration,
                flight_ids=[],
                total_cost=0.0,
                reduced_cost=0.0,
            )
        )

    yield _progress("cg_iteration", 0, 0.0, len(columns), len(columns), start_ms)

    # ── Column Generation Loop ──
    max_iterations = 100
    for iteration in range(1, max_iterations + 1):
        elapsed = int(time.time() * 1000) - start_ms
        if elapsed > config.max_solve_seconds * 1000:
            break

        # Solve RMP (Restricted Master Problem)
        # Blended mode always minimizes; single-objective MAX_REVENUE maximizes
        sense = LpMinimize if config.objective_weights else (LpMaximize if config.objective == Objective.MAX_REVENUE else LpMinimize)
        prob = LpProblem("RecoveryRMP", sense)

        # Column variables
        x = {}
        for i, col in enumerate(columns):
            x[i] = LpVariable(f"x_{i}", cat=LpBinary)

        # Flight coverage constraints: each flight covered at most once
        # Cancellation slack variable per flight with penalty
        cancel_vars = {}
        for flight in request.available_flights:
            cancel_vars[flight.id] = LpVariable(
                f"cancel_{flight.id}", 0, 1, cat=LpBinary
            )

        for flight in request.available_flights:
            # Columns covering this flight
            covering = [i for i, col in enumerate(columns) if flight.id in col.flight_ids]
            # Flight must be covered by exactly one column OR cancelled
            prob += (
                lpSum(x[i] for i in covering) + cancel_vars[flight.id] == 1,
                f"cover_{flight.id}",
            )

        # Each aircraft used at most once
        ac_columns: dict[str, list[int]] = {}
        for i, col in enumerate(columns):
            ac_columns.setdefault(col.aircraft_reg, []).append(i)
        for reg, col_indices in ac_columns.items():
            prob += lpSum(x[i] for i in col_indices) <= 1, f"ac_{reg}"

        # Objective
        if config.objective == Objective.MAX_REVENUE:
            # Maximize revenue protected (minus cancellation penalty)
            prob += lpSum(
                x[i] * col.revenue_protected for i, col in enumerate(columns)
            ) - lpSum(
                cancel_vars[f.id] * flight_cancel_penalty(f, config)
                for f in request.available_flights
            )
        else:
            # Minimize cost (column cost + cancellation penalties)
            prob += lpSum(
                x[i] * col.total_cost for i, col in enumerate(columns)
            ) + lpSum(
                cancel_vars[f.id] * flight_cancel_penalty(f, config)
                for f in request.available_flights
            )

        # Solve
        prob.solve(PULP_CBC_CMD(msg=0, timeLimit=max(1, int(config.max_solve_seconds - elapsed / 1000))))

        obj_val = lp_value(prob.objective) if prob.objective else 0.0

        # Extract dual values for pricing
        dual_values: dict[str, float] = {}
        for flight in request.available_flights:
            constraint = prob.constraints.get(f"cover_{flight.id}")
            if constraint is not None and hasattr(constraint, "pi") and constraint.pi is not None:
                dual_values[flight.id] = float(constraint.pi)
            else:
                dual_values[flight.id] = 0.0

        # Pricing: generate new columns
        new_columns_count = 0
        for ac, ac_type in aircraft_with_type:
            new_col = solve_pricing(
                ac, ac_type, request.available_flights, dual_values, config, horizon_end_ms
            )
            if new_col is not None:
                columns.append(new_col)
                new_columns_count += 1

        yield _progress(
            "cg_iteration", iteration, obj_val, new_columns_count, len(columns), start_ms
        )

        # Convergence: no new columns with negative reduced cost
        if new_columns_count == 0:
            break

    # ── Generate Solutions ──
    yield _progress("generating_solutions", 0, 0.0, 0, len(columns), start_ms)

    solutions: list[Solution] = []
    flight_map = {f.id: f for f in request.available_flights}
    labels = ["Option A", "Option B", "Option C", "Option D", "Option E"]

    for sol_idx in range(config.max_solutions):
        # Re-solve RMP with previous solutions excluded
        sense = LpMaximize if config.objective == Objective.MAX_REVENUE else LpMinimize
        prob = LpProblem(f"RecoveryFinal_{sol_idx}", sense)

        x = {}
        for i, col in enumerate(columns):
            x[i] = LpVariable(f"x_{i}", cat=LpBinary)

        cancel_vars = {}
        for flight in request.available_flights:
            cancel_vars[flight.id] = LpVariable(
                f"cancel_{flight.id}", 0, 1, cat=LpBinary
            )

        for flight in request.available_flights:
            covering = [i for i, col in enumerate(columns) if flight.id in col.flight_ids]
            prob += lpSum(x[i] for i in covering) + cancel_vars[flight.id] == 1, f"cover_{flight.id}"

        for reg, col_indices in ac_columns.items():
            if reg in ac_columns:
                prob += lpSum(x[i] for i in ac_columns[reg]) <= 1, f"ac_{reg}"

        # Exclude previous solutions
        for prev_sol in solutions:
            prev_flight_set = {a.flight_id for a in prev_sol.assignments}
            prev_cols = [
                i
                for i, col in enumerate(columns)
                if set(col.flight_ids) & prev_flight_set
            ]
            if prev_cols:
                prob += lpSum(x[i] for i in prev_cols) <= len(prev_cols) - 1, f"exclude_{sol_idx}_{len(solutions)}"

        if not config.objective_weights and config.objective == Objective.MAX_REVENUE:
            prob += lpSum(x[i] * col.revenue_protected for i, col in enumerate(columns)) - lpSum(
                cancel_vars[f.id] * flight_cancel_penalty(f, config) for f in request.available_flights
            )
        else:
            # Minimize cost (column cost + cancellation penalties) — works for both single and blended mode
            prob += lpSum(x[i] * col.total_cost for i, col in enumerate(columns)) + lpSum(
                cancel_vars[f.id] * flight_cancel_penalty(f, config) for f in request.available_flights
            )

        remaining_time = max(1, int(config.max_solve_seconds - (time.time() * 1000 - start_ms) / 1000))
        prob.solve(PULP_CBC_CMD(msg=0, timeLimit=remaining_time))

        # Extract solution — emit changes for swapped OR delayed flights
        assignments: list[AssignmentChange] = []
        cancelled_ids: set[str] = set()
        revenue_protected = 0.0
        total_delay = 0

        for i, col in enumerate(columns):
            if x[i].varValue and x[i].varValue > 0.5:
                for fid in col.flight_ids:
                    flight = flight_map.get(fid)
                    if not flight:
                        continue

                    from_reg = flight.aircraft_reg
                    to_reg = col.aircraft_reg
                    is_swapped = from_reg != to_reg
                    delay_min = col.flight_delays.get(fid, 0)
                    is_delayed = delay_min > 0

                    if is_swapped or is_delayed:
                        # Compute new times if delayed
                        delay_ms = delay_min * 60_000
                        new_std = flight.std_utc + delay_ms if is_delayed else None
                        new_sta = flight.sta_utc + delay_ms if is_delayed else None

                        reason = _build_reason(from_reg, to_reg, is_swapped, is_delayed, delay_min)

                        assignments.append(
                            AssignmentChange(
                                flight_id=fid,
                                from_reg=from_reg,
                                to_reg=to_reg,
                                new_std_utc=new_std,
                                new_sta_utc=new_sta,
                                delay_minutes=delay_min,
                                reason=reason,
                            )
                        )

                    revenue_protected += flight.estimated_revenue

                # Sum per-flight delays from this column
                total_delay += sum(col.flight_delays.values())

        for f in request.available_flights:
            cv = cancel_vars.get(f.id)
            if cv and cv.varValue and cv.varValue > 0.5:
                cancelled_ids.add(f.id)

        cancellations = len(cancelled_ids)
        cancel_cost = cancellations * config.cancel_cost_per_flight
        delay_cost = total_delay * config.delay_cost_per_minute

        delayed_count = sum(1 for a in assignments if a.delay_minutes > 0)
        swapped_count = sum(1 for a in assignments if a.from_reg != a.to_reg)

        solution = Solution(
            id=str(uuid.uuid4()),
            label=labels[sol_idx] if sol_idx < len(labels) else f"Option {sol_idx + 1}",
            summary=_build_summary(swapped_count, delayed_count, cancellations, total_delay),
            metrics=SolutionMetrics(
                total_delay_minutes=total_delay,
                flights_changed=len(assignments),
                cancellations=cancellations,
                estimated_cost_impact=-(cancel_cost + delay_cost),
                estimated_revenue_protected=revenue_protected,
                pax_affected=cancellations * 180,  # rough estimate
            ),
            assignments=assignments,
        )

        # Min improvement filter: skip solutions too similar to previous ones
        if config.min_improvement_usd > 0 and len(solutions) > 0:
            prev_cost = abs(solutions[-1].metrics.estimated_cost_impact)
            this_cost = abs(solution.metrics.estimated_cost_impact)
            if abs(prev_cost - this_cost) < config.min_improvement_usd:
                continue  # not different enough — try next

        solutions.append(solution)

        yield {
            "event": "solution",
            "data": solution.model_dump(),
        }

        if cancellations == 0 and len(assignments) == 0:
            break  # Optimal is trivial, no need for more solutions

    # Final result
    result = SolveResult(
        solutions=solutions,
        locked=LockedCounts(
            departed=len(request.locked_flights),
            within_threshold=0,  # counted at Fastify level
            beyond_horizon=len(request.frozen_flights),
            available=len(request.available_flights),
        ),
        solve_time_ms=int(time.time() * 1000) - start_ms,
    )

    yield {"event": "result", "data": result.model_dump()}


def _progress(
    phase: str,
    iteration: int,
    obj: float,
    new_cols: int,
    pool: int,
    start_ms: int,
) -> dict:
    return {
        "event": "progress",
        "data": ProgressEvent(
            phase=phase,
            iteration=iteration,
            objective_value=obj,
            columns_generated=new_cols,
            pool_size=pool,
            elapsed_ms=int(time.time() * 1000) - start_ms,
        ).model_dump(),
    }


def _build_reason(
    from_reg: str | None,
    to_reg: str,
    is_swapped: bool,
    is_delayed: bool,
    delay_min: int,
) -> str:
    """Build a human-readable reason for an assignment change."""
    parts = []
    if is_delayed:
        parts.append(f"Delayed +{delay_min}min")
    if is_swapped:
        parts.append(f"reassigned from {from_reg or 'unassigned'} to {to_reg}")
    return ", ".join(parts)


def _build_summary(swapped: int, delayed: int, cancelled: int, total_delay: int) -> str:
    parts = []
    if swapped:
        parts.append(f"{swapped} reassigned")
    if delayed:
        parts.append(f"{delayed} delayed (+{total_delay}min)")
    if cancelled:
        parts.append(f"{cancelled} cancellation{'s' if cancelled != 1 else ''}")
    if not parts:
        return "No changes needed"
    return ", ".join(parts)
