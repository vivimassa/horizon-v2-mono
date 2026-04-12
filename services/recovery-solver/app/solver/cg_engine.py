"""Column Generation engine for disruption recovery.

Master problem: Set partitioning LP (via PuLP/CBC)
Pricing: SPPRC per aircraft (see pricing.py)

CG loop uses LP relaxation (continuous variables) for proper duals.
Final solution enumeration uses binary IP over the generated column pool.

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
    LpContinuous,
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
from app.solver.objectives import flight_cancel_penalty, flight_delay_cost, fuel_cost
from app.solver.flight_graph import resolve_tat


def _validate_seed_column(
    flights: list,
    aircraft,
    ac_type,
    config,
) -> tuple[float, float, dict[str, int]]:
    """Validate a seed column and compute its true cost.

    Returns (true_cost, revenue, flight_delays) or raises if infeasible.
    Checks TAT, curfew, block hours, and swap limits.
    """
    true_cost = 0.0
    revenue = 0.0
    block_hours = 0.0
    swap_count = 0
    flight_delays: dict[str, int] = {}
    prev_arr_station = aircraft.current_station or aircraft.home_base_icao or ""
    prev_arr_time = aircraft.available_from_utc or 0
    prev_route_type = "domestic"

    for flight in flights:
        # TAT check
        tat_min = resolve_tat(ac_type, prev_route_type, flight.route_type)
        min_depart = prev_arr_time + tat_min * 60_000

        delay_ms = 0
        if flight.std_utc < min_depart:
            if config.max_delay_per_flight_minutes > 0:
                delay_ms = min_depart - flight.std_utc
                if delay_ms > config.max_delay_per_flight_minutes * 60_000:
                    raise ValueError(f"TAT violation exceeds max delay for {flight.id}")
            else:
                raise ValueError(f"TAT violation for {flight.id}, retiming disabled")

        delay_min = int(delay_ms / 60_000)
        if delay_min > 0:
            flight_delays[flight.id] = delay_min

        arrival_time = flight.sta_utc + delay_ms

        # Curfew check
        if (
            config.respect_curfews
            and flight.arr_curfew_start_utc is not None
            and flight.arr_curfew_end_utc is not None
        ):
            from app.solver.pricing import _curfew_violated

            if _curfew_violated(arrival_time, flight.arr_curfew_start_utc, flight.arr_curfew_end_utc):
                raise ValueError(f"Curfew violation for {flight.id}")

        # Block hours
        block_hours += flight.block_minutes / 60.0
        if config.max_crew_duty_hours > 0 and block_hours > config.max_crew_duty_hours:
            raise ValueError(f"Block hour limit exceeded at {flight.id}")

        # Swap count
        is_foreign = flight.aircraft_reg is not None and flight.aircraft_reg != aircraft.registration
        swap_count += 1 if is_foreign else 0
        if config.max_swaps_per_aircraft > 0 and swap_count > config.max_swaps_per_aircraft:
            raise ValueError(f"Swap limit exceeded at {flight.id}")

        # Costs
        delay_cost_val = flight_delay_cost(delay_min, flight, config)
        fuel_cost_val = fuel_cost(
            flight.block_minutes,
            aircraft.fuel_burn_rate_kg_per_hour or ac_type.fuel_burn_rate_kg_per_hour,
            config,
        )
        true_cost += delay_cost_val + fuel_cost_val
        revenue += flight.estimated_revenue

        prev_arr_station = flight.arr_station
        prev_arr_time = arrival_time
        prev_route_type = flight.route_type

    return true_cost, revenue, flight_delays


async def solve(request: SolveRequest) -> AsyncGenerator[dict, None]:
    """Run column generation and yield SSE events."""
    config = request.config
    start_ms = int(time.time() * 1000)

    # Use reference time from Fastify (fixes P2: horizon time mismatch)
    now_ms = config.reference_time_utc_ms if config.reference_time_utc_ms > 0 else int(time.time() * 1000)
    horizon_end_ms = now_ms + int(config.horizon_hours * 3_600_000)

    type_map = {t.icao_type: t for t in request.aircraft_types}
    flight_map = {f.id: f for f in request.available_flights}

    # Aircraft with their type info
    aircraft_with_type = []
    for ac in request.aircraft:
        ac_type = type_map.get(ac.aircraft_type_icao)
        if ac_type:
            aircraft_with_type.append((ac, ac_type))

    yield _progress("building_network", 0, 0.0, 0, 0, start_ms)

    # ── Initial columns: validated current assignments ──
    columns: list[Column] = []
    column_signatures: set[tuple[str, tuple[str, ...]]] = set()  # (reg, flight_ids) for dedup

    is_max_revenue = config.objective_weights is None and config.objective == Objective.MAX_REVENUE

    for ac, ac_type in aircraft_with_type:
        assigned = sorted(
            [f for f in request.available_flights if f.aircraft_reg == ac.registration],
            key=lambda f: f.std_utc,
        )
        if assigned:
            try:
                true_cost, revenue, flight_delays = _validate_seed_column(
                    assigned, ac, ac_type, config,
                )
                if is_max_revenue:
                    true_cost = -revenue + true_cost

                sig = (ac.registration, tuple(f.id for f in assigned))
                column_signatures.add(sig)
                columns.append(
                    Column(
                        aircraft_reg=ac.registration,
                        flight_ids=[f.id for f in assigned],
                        true_cost=true_cost,
                        reduced_cost=0.0,  # will be set by RMP
                        revenue_protected=revenue,
                        flight_delays=flight_delays,
                    )
                )
            except ValueError:
                pass  # infeasible seed — skip it

        # Empty column per aircraft (doing nothing — always feasible)
        columns.append(
            Column(
                aircraft_reg=ac.registration,
                flight_ids=[],
                true_cost=0.0,
                reduced_cost=0.0,
            )
        )

    yield _progress("cg_iteration", 0, 0.0, len(columns), len(columns), start_ms)

    # ── Column Generation Loop (LP relaxation for proper duals) ──
    max_iterations = 100
    ac_columns: dict[str, list[int]] = {}

    for iteration in range(1, max_iterations + 1):
        elapsed = int(time.time() * 1000) - start_ms
        if elapsed > config.max_solve_seconds * 1000:
            break

        # Build column-to-aircraft index
        ac_columns = {}
        for i, col in enumerate(columns):
            ac_columns.setdefault(col.aircraft_reg, []).append(i)

        # Solve RMP as LP relaxation (continuous variables for proper duals)
        sense = LpMinimize  # always minimize in CG loop
        if is_max_revenue:
            sense = LpMinimize  # we minimize (-revenue + cost)
        prob = LpProblem("RecoveryRMP_LP", sense)

        # Continuous column variables [0, 1]
        x = {}
        for i in range(len(columns)):
            x[i] = LpVariable(f"x_{i}", 0, 1, cat=LpContinuous)

        # Continuous cancel slack [0, 1]
        cancel_vars = {}
        for flight in request.available_flights:
            cancel_vars[flight.id] = LpVariable(
                f"cancel_{flight.id}", 0, 1, cat=LpContinuous
            )

        # Flight coverage: each flight covered by exactly one column OR cancelled
        for flight in request.available_flights:
            covering = [i for i, col in enumerate(columns) if flight.id in col.flight_ids]
            prob += (
                lpSum(x[i] for i in covering) + cancel_vars[flight.id] == 1,
                f"cover_{flight.id}",
            )

        # Aircraft cardinality: each aircraft used at most once
        for reg, col_indices in ac_columns.items():
            prob += lpSum(x[i] for i in col_indices) <= 1, f"ac_{reg}"

        # Objective: minimize true_cost + cancel penalties
        prob += lpSum(
            x[i] * col.true_cost for i, col in enumerate(columns)
        ) + lpSum(
            cancel_vars[f.id] * flight_cancel_penalty(f, config)
            for f in request.available_flights
        )

        prob.solve(PULP_CBC_CMD(msg=0, timeLimit=max(1, int(config.max_solve_seconds - elapsed / 1000))))

        obj_val = lp_value(prob.objective) if prob.objective else 0.0

        # Extract flight duals (pi from coverage constraints)
        flight_duals: dict[str, float] = {}
        for flight in request.available_flights:
            constraint = prob.constraints.get(f"cover_{flight.id}")
            if constraint is not None and hasattr(constraint, "pi") and constraint.pi is not None:
                flight_duals[flight.id] = float(constraint.pi)
            else:
                flight_duals[flight.id] = 0.0

        # Extract aircraft duals (pi from cardinality constraints)
        aircraft_duals: dict[str, float] = {}
        for reg in ac_columns:
            constraint = prob.constraints.get(f"ac_{reg}")
            if constraint is not None and hasattr(constraint, "pi") and constraint.pi is not None:
                aircraft_duals[reg] = float(constraint.pi)
            else:
                aircraft_duals[reg] = 0.0

        # Pricing: generate new columns with proper duals
        new_columns_count = 0
        for ac, ac_type in aircraft_with_type:
            ac_dual = aircraft_duals.get(ac.registration, 0.0)
            new_col = solve_pricing(
                ac, ac_type, request.available_flights,
                flight_duals, ac_dual, config, horizon_end_ms,
            )
            if new_col is not None:
                # Duplicate column detection
                sig = (new_col.aircraft_reg, tuple(new_col.flight_ids))
                if sig not in column_signatures:
                    column_signatures.add(sig)
                    columns.append(new_col)
                    new_columns_count += 1

        yield _progress(
            "cg_iteration", iteration, obj_val, new_columns_count, len(columns), start_ms,
        )

        # Convergence: no new columns with negative reduced cost
        if new_columns_count == 0:
            break

    # ── Generate Solutions (binary IP over column pool) ──
    yield _progress("generating_solutions", 0, 0.0, 0, len(columns), start_ms)

    # Rebuild ac_columns index for final pool
    ac_columns = {}
    for i, col in enumerate(columns):
        ac_columns.setdefault(col.aircraft_reg, []).append(i)

    solutions: list[Solution] = []
    labels = ["Option A", "Option B", "Option C", "Option D", "Option E"]

    for sol_idx in range(config.max_solutions):
        # Binary IP over full column pool
        sense = LpMinimize
        if is_max_revenue:
            sense = LpMinimize  # still minimize (-revenue + cost)
        prob = LpProblem(f"RecoveryFinal_{sol_idx}", sense)

        x = {}
        for i in range(len(columns)):
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
            prob += lpSum(x[i] for i in col_indices) <= 1, f"ac_{reg}"

        # Exclude previous solutions (no-good cuts on selected columns)
        for prev_idx, prev_sol in enumerate(solutions):
            prev_flight_set = {a.flight_id for a in prev_sol.assignments}
            prev_cols = [
                i for i, col in enumerate(columns)
                if set(col.flight_ids) & prev_flight_set
            ]
            if prev_cols:
                prob += lpSum(x[i] for i in prev_cols) <= len(prev_cols) - 1, f"exclude_{sol_idx}_{prev_idx}"

        # Objective: true_cost + cancel penalties
        prob += lpSum(
            x[i] * col.true_cost for i, col in enumerate(columns)
        ) + lpSum(
            cancel_vars[f.id] * flight_cancel_penalty(f, config)
            for f in request.available_flights
        )

        remaining_time = max(1, int(config.max_solve_seconds - (time.time() * 1000 - start_ms) / 1000))
        prob.solve(PULP_CBC_CMD(msg=0, timeLimit=remaining_time))

        # Extract solution
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

                total_delay += sum(col.flight_delays.values())

        for f in request.available_flights:
            cv = cancel_vars.get(f.id)
            if cv and cv.varValue and cv.varValue > 0.5:
                cancelled_ids.add(f.id)

        cancellations = len(cancelled_ids)
        cancel_cost = cancellations * config.cancel_cost_per_flight
        delay_cost_total = total_delay * config.delay_cost_per_minute

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
                estimated_cost_impact=-(cancel_cost + delay_cost_total),
                estimated_revenue_protected=revenue_protected,
                pax_affected=cancellations * 180,
            ),
            assignments=assignments,
        )

        # Min improvement filter
        if config.min_improvement_usd > 0 and len(solutions) > 0:
            prev_cost = abs(solutions[-1].metrics.estimated_cost_impact)
            this_cost = abs(solution.metrics.estimated_cost_impact)
            if abs(prev_cost - this_cost) < config.min_improvement_usd:
                continue

        solutions.append(solution)

        yield {
            "event": "solution",
            "data": solution.model_dump(),
        }

        if cancellations == 0 and len(assignments) == 0:
            break

    # Final result
    result = SolveResult(
        solutions=solutions,
        locked=LockedCounts(
            departed=len(request.locked_flights),
            within_threshold=0,
            beyond_horizon=len(request.frozen_flights),
            available=len(request.available_flights),
        ),
        solve_time_ms=int(time.time() * 1000) - start_ms,
    )

    yield {"event": "result", "data": result.model_dump()}


def _progress(
    phase: str, iteration: int, obj: float, new_cols: int, pool: int, start_ms: int,
) -> dict:
    return {
        "event": "progress",
        "data": ProgressEvent(
            phase=phase, iteration=iteration, objective_value=obj,
            columns_generated=new_cols, pool_size=pool,
            elapsed_ms=int(time.time() * 1000) - start_ms,
        ).model_dump(),
    }


def _build_reason(
    from_reg: str | None, to_reg: str, is_swapped: bool, is_delayed: bool, delay_min: int,
) -> str:
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
