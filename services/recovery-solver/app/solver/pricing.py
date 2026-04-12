"""Pricing subproblem for column generation.

Solves a resource-constrained shortest path (SPPRC) per aircraft
to find new columns (aircraft duties) with negative reduced cost.

Supports: explicit flight retiming, curfew enforcement, block hour limits,
max swap limits, and proper route-type TAT classification.

Column economics: true_cost (delay + fuel) is kept separate from
reduced_cost (true_cost - flight_duals - aircraft_dual). The master
optimizes true_cost; reduced_cost drives CG convergence.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Aircraft, AircraftType, Flight, SolveConfig, Objective
from app.solver.flight_graph import resolve_tat
from app.solver.objectives import flight_delay_cost, fuel_cost


@dataclass
class Label:
    """A partial path in the time-space network."""

    station: str
    time: int  # epoch ms — current position time
    cost: float  # accumulated reduced cost (for pricing convergence)
    true_cost: float  # accumulated true cost (delay + fuel, no duals)
    flights: list[str] = field(default_factory=list)
    delay_minutes: int = 0
    flight_delays: dict[str, int] = field(default_factory=dict)
    last_route_type: str = "domestic"  # for TAT — part of dominance state
    block_hours: float = 0.0
    swap_count: int = 0
    revenue: float = 0.0  # accumulated revenue for MAX_REVENUE pricing


@dataclass
class Column:
    """A feasible aircraft routing (duty) — one column in the master problem."""

    aircraft_reg: str
    flight_ids: list[str]
    true_cost: float  # objective cost (delay + fuel) — used by master
    reduced_cost: float  # true_cost - duals — used for CG convergence only
    delay_minutes: int = 0
    revenue_protected: float = 0.0
    flight_delays: dict[str, int] = field(default_factory=dict)


def _curfew_violated(arrival_time_ms: int, curfew_start: int, curfew_end: int) -> bool:
    """Check if arrival falls within curfew window, handling overnight wrap."""
    if curfew_start <= curfew_end:
        # Normal window (e.g., 22:00-06:00 in same-day UTC terms won't happen,
        # but e.g., 01:00-05:00 UTC)
        return curfew_start <= arrival_time_ms <= curfew_end
    else:
        # Overnight wrap: start > end (e.g., 23:00 UTC start, 06:00 UTC end)
        # Violated if arrival >= start OR arrival <= end
        return arrival_time_ms >= curfew_start or arrival_time_ms <= curfew_end


def solve_pricing(
    aircraft: Aircraft,
    ac_type: AircraftType,
    available_flights: list[Flight],
    flight_duals: dict[str, float],
    aircraft_dual: float,
    config: SolveConfig,
    horizon_end_ms: int,
) -> Column | None:
    """Find the column with most negative reduced cost for this aircraft.

    Uses a label-setting algorithm on the time-space network.
    Enforces: retiming limits, curfews, block hour limits, swap limits.

    Column economics:
    - true_cost = sum of (delay_cost + fuel_cost) for each flight
    - reduced_cost = true_cost - sum(flight_duals) - aircraft_dual
    - For MAX_REVENUE: reduced_cost = -revenue + true_cost - duals
    Returns None if no improving column exists (reduced_cost >= 0).
    """
    compatible = sorted(
        [
            f
            for f in available_flights
            if f.aircraft_type_icao == ac_type.icao_type
            or f.aircraft_type_icao is None
        ],
        key=lambda f: f.std_utc,
    )

    if not compatible:
        return None

    flight_map = {f.id: f for f in compatible}

    start_station = aircraft.current_station or aircraft.home_base_icao or ""
    start_time = aircraft.available_from_utc or 0

    max_delay_ms = config.max_delay_per_flight_minutes * 60_000
    retiming_enabled = config.max_delay_per_flight_minutes > 0
    is_max_revenue = (
        config.objective_weights is None and config.objective == Objective.MAX_REVENUE
    )

    best_label: Label | None = None
    labels: list[Label] = [
        Label(station=start_station, time=start_time, cost=0.0, true_cost=0.0)
    ]

    for flight in compatible:
        if flight.std_utc > horizon_end_ms:
            break

        new_labels: list[Label] = []

        for label in labels:
            if label.station != flight.dep_station:
                continue

            # TAT with actual route types
            inbound_type = label.last_route_type
            outbound_type = flight.route_type
            tat_minutes = resolve_tat(ac_type, inbound_type, outbound_type)
            min_depart = label.time + tat_minutes * 60_000

            # Delay computation
            if flight.std_utc >= min_depart:
                delay_ms = 0
            elif retiming_enabled:
                delay_ms = min_depart - flight.std_utc
                if delay_ms > max_delay_ms:
                    continue
            else:
                continue

            delay_min = int(delay_ms / 60_000)
            arrival_time = flight.sta_utc + delay_ms

            # ── Constraint checks ──

            # Curfew (handles overnight wrap)
            if (
                config.respect_curfews
                and flight.arr_curfew_start_utc is not None
                and flight.arr_curfew_end_utc is not None
            ):
                if _curfew_violated(
                    arrival_time,
                    flight.arr_curfew_start_utc,
                    flight.arr_curfew_end_utc,
                ):
                    continue

            # Block hour limit
            new_block_hours = label.block_hours + flight.block_minutes / 60.0
            if config.max_crew_duty_hours > 0 and new_block_hours > config.max_crew_duty_hours:
                continue

            # Max swaps
            is_foreign = (
                flight.aircraft_reg is not None
                and flight.aircraft_reg != aircraft.registration
            )
            new_swap_count = label.swap_count + (1 if is_foreign else 0)
            if config.max_swaps_per_aircraft > 0 and new_swap_count > config.max_swaps_per_aircraft:
                continue

            # ── Arc costs (separate true cost from reduced cost) ──
            delay_cost_val = flight_delay_cost(delay_min, flight, config)
            fuel_cost_val = fuel_cost(
                flight.block_minutes,
                aircraft.fuel_burn_rate_kg_per_hour or ac_type.fuel_burn_rate_kg_per_hour,
                config,
            )
            arc_true_cost = delay_cost_val + fuel_cost_val
            arc_revenue = flight.estimated_revenue

            # Reduced cost = true_cost - flight_dual
            # (aircraft_dual subtracted at column level, not per-arc)
            dual = flight_duals.get(flight.id, 0.0)
            arc_reduced_cost = arc_true_cost - dual

            # For MAX_REVENUE: we minimize (-revenue + cost - duals)
            if is_max_revenue:
                arc_reduced_cost = -arc_revenue + arc_true_cost - dual

            new_label = Label(
                station=flight.arr_station,
                time=arrival_time,
                cost=label.cost + arc_reduced_cost,
                true_cost=label.true_cost + arc_true_cost,
                flights=label.flights + [flight.id],
                delay_minutes=label.delay_minutes + delay_min,
                flight_delays=(
                    {**label.flight_delays, flight.id: delay_min}
                    if delay_min > 0
                    else label.flight_delays.copy()
                ),
                last_route_type=flight.route_type,
                block_hours=new_block_hours,
                swap_count=new_swap_count,
                revenue=label.revenue + arc_revenue,
            )
            new_labels.append(new_label)

            if new_label.flights and (
                best_label is None or new_label.cost < best_label.cost
            ):
                best_label = new_label

        labels.extend(new_labels)

        # Dominance pruning — includes last_route_type as state dimension
        by_station_route: dict[tuple[str, str], list[Label]] = {}
        for lbl in labels:
            key = (lbl.station, lbl.last_route_type)
            by_station_route.setdefault(key, []).append(lbl)
        pruned: list[Label] = []
        for group in by_station_route.values():
            group.sort(key=lambda l: l.cost)
            kept: list[Label] = []
            for lbl in group:
                dominated = False
                for k in kept:
                    if (
                        k.cost <= lbl.cost
                        and k.time <= lbl.time
                        and k.block_hours <= lbl.block_hours
                        and k.swap_count <= lbl.swap_count
                    ):
                        dominated = True
                        break
                if not dominated:
                    kept.append(lbl)
            pruned.extend(kept)
        labels = pruned

    if best_label is None:
        return None

    # Subtract aircraft dual at column level
    final_reduced_cost = best_label.cost - aircraft_dual

    if final_reduced_cost >= -1e-6:
        return None

    # For MAX_REVENUE master: true_cost is -revenue (master maximizes, so
    # we store negative revenue as cost so the master's lpSum works).
    # For all other objectives: true_cost is delay + fuel.
    if is_max_revenue:
        column_true_cost = -best_label.revenue + best_label.true_cost
    else:
        column_true_cost = best_label.true_cost

    return Column(
        aircraft_reg=aircraft.registration,
        flight_ids=best_label.flights,
        true_cost=column_true_cost,
        reduced_cost=final_reduced_cost,
        delay_minutes=best_label.delay_minutes,
        revenue_protected=best_label.revenue,
        flight_delays=best_label.flight_delays,
    )
