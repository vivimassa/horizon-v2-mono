"""Pricing subproblem for column generation.

Solves a resource-constrained shortest path (SPPRC) per aircraft
to find new columns (aircraft duties) with negative reduced cost.

Supports: explicit flight retiming, curfew enforcement, block hour limits,
max swap limits, and proper route-type TAT classification.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Aircraft, AircraftType, Flight, SolveConfig
from app.solver.flight_graph import resolve_tat
from app.solver.objectives import flight_delay_cost, fuel_cost


@dataclass
class Label:
    """A partial path in the time-space network."""

    station: str
    time: int  # epoch ms — current position time
    cost: float  # accumulated reduced cost
    flights: list[str] = field(default_factory=list)  # flight IDs in this routing
    delay_minutes: int = 0  # total delay across all flights
    flight_delays: dict[str, int] = field(default_factory=dict)  # flight_id -> delay_min
    last_route_type: str = "domestic"  # route type of most recent flight (for TAT)
    block_hours: float = 0.0  # cumulative block hours in path
    swap_count: int = 0  # flights NOT originally on this aircraft


@dataclass
class Column:
    """A feasible aircraft routing (duty) — one column in the master problem."""

    aircraft_reg: str
    flight_ids: list[str]
    total_cost: float
    reduced_cost: float
    delay_minutes: int = 0
    revenue_protected: float = 0.0
    flight_delays: dict[str, int] = field(default_factory=dict)  # flight_id -> delay_min


def solve_pricing(
    aircraft: Aircraft,
    ac_type: AircraftType,
    available_flights: list[Flight],
    dual_values: dict[str, float],
    config: SolveConfig,
    horizon_end_ms: int,
) -> Column | None:
    """Find the column with most negative reduced cost for this aircraft.

    Uses a label-setting algorithm on the time-space network.
    Enforces: retiming limits, curfews, block hour limits, swap limits.
    Returns None if no improving column exists (aircraft is optimal).
    """
    # Filter compatible flights sorted by departure
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

    # Build flight lookup for revenue computation
    flight_map = {f.id: f for f in compatible}

    # Aircraft starting position
    start_station = aircraft.current_station or aircraft.home_base_icao or ""
    start_time = aircraft.available_from_utc or 0

    max_delay_ms = config.max_delay_per_flight_minutes * 60_000
    retiming_enabled = config.max_delay_per_flight_minutes > 0

    # Initialize with empty label at source
    best_label: Label | None = None
    labels: list[Label] = [
        Label(station=start_station, time=start_time, cost=0.0)
    ]

    # Label propagation — extend each label by each reachable flight
    for flight in compatible:
        if flight.std_utc > horizon_end_ms:
            break

        new_labels: list[Label] = []

        for label in labels:
            # Station continuity check
            if label.station != flight.dep_station:
                continue

            # TAT check — use actual route types
            inbound_type = label.last_route_type
            outbound_type = flight.route_type
            tat_minutes = resolve_tat(ac_type, inbound_type, outbound_type)
            min_depart = label.time + tat_minutes * 60_000

            # Determine delay needed
            if flight.std_utc >= min_depart:
                delay_ms = 0
            elif retiming_enabled:
                delay_ms = min_depart - flight.std_utc
                if delay_ms > max_delay_ms:
                    continue  # exceeds per-flight delay cap
            else:
                continue  # retiming disabled — skip unreachable flights

            delay_min = int(delay_ms / 60_000)

            # Arrival time shifts by same amount as departure (block time preserved)
            arrival_time = flight.sta_utc + delay_ms

            # ── Constraint checks ──

            # 1. Curfew: arrival must not fall in curfew window
            if (
                config.respect_curfews
                and flight.arr_curfew_start_utc is not None
                and flight.arr_curfew_end_utc is not None
            ):
                if flight.arr_curfew_start_utc <= arrival_time <= flight.arr_curfew_end_utc:
                    continue  # would violate curfew

            # 2. Block hour limit
            new_block_hours = label.block_hours + flight.block_minutes / 60.0
            if config.max_crew_duty_hours > 0 and new_block_hours > config.max_crew_duty_hours:
                continue  # would exceed duty limit

            # 3. Max swaps: count flights not originally on this aircraft
            is_foreign = (
                flight.aircraft_reg is not None
                and flight.aircraft_reg != aircraft.registration
            )
            new_swap_count = label.swap_count + (1 if is_foreign else 0)
            if config.max_swaps_per_aircraft > 0 and new_swap_count > config.max_swaps_per_aircraft:
                continue  # too many swaps for this aircraft

            # ── Arc cost ──
            dual = dual_values.get(flight.id, 0.0)
            arc_cost = (
                flight_delay_cost(delay_min, flight, config)
                + fuel_cost(
                    flight.block_minutes,
                    aircraft.fuel_burn_rate_kg_per_hour or ac_type.fuel_burn_rate_kg_per_hour,
                    config,
                )
                - dual
            )

            new_label = Label(
                station=flight.arr_station,
                time=arrival_time,
                cost=label.cost + arc_cost,
                flights=label.flights + [flight.id],
                delay_minutes=label.delay_minutes + delay_min,
                flight_delays={**label.flight_delays, flight.id: delay_min} if delay_min > 0 else label.flight_delays.copy(),
                last_route_type=flight.route_type,
                block_hours=new_block_hours,
                swap_count=new_swap_count,
            )
            new_labels.append(new_label)

            # Track best (most negative reduced cost with at least one flight)
            if new_label.flights and (
                best_label is None or new_label.cost < best_label.cost
            ):
                best_label = new_label

        labels.extend(new_labels)

        # Dominance pruning: keep only non-dominated labels per station
        # A dominates B if: A.cost <= B.cost AND A.time <= B.time
        #   AND A.block_hours <= B.block_hours AND A.swap_count <= B.swap_count
        by_station: dict[str, list[Label]] = {}
        for lbl in labels:
            by_station.setdefault(lbl.station, []).append(lbl)
        pruned: list[Label] = []
        for station_labels in by_station.values():
            station_labels.sort(key=lambda l: l.cost)
            kept: list[Label] = []
            for lbl in station_labels:
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

    if best_label is None or best_label.cost >= -1e-6:
        return None  # No improving column

    # Compute revenue protected
    revenue = sum(
        flight_map[fid].estimated_revenue
        for fid in best_label.flights
        if fid in flight_map
    )

    return Column(
        aircraft_reg=aircraft.registration,
        flight_ids=best_label.flights,
        total_cost=best_label.cost,
        reduced_cost=best_label.cost,
        delay_minutes=best_label.delay_minutes,
        revenue_protected=revenue,
        flight_delays=best_label.flight_delays,
    )
