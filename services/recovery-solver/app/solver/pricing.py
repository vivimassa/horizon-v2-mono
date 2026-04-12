"""Pricing subproblem for column generation.

Solves a resource-constrained shortest path (SPPRC) per aircraft
to find new columns (aircraft duties) with negative reduced cost.
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
    delay_minutes: int = 0


@dataclass
class Column:
    """A feasible aircraft routing (duty) — one column in the master problem."""

    aircraft_reg: str
    flight_ids: list[str]
    total_cost: float
    reduced_cost: float
    delay_minutes: int = 0
    revenue_protected: float = 0.0


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

    # Aircraft starting position
    start_station = aircraft.current_station or aircraft.home_base_icao or ""
    start_time = aircraft.available_from_utc or 0

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

            # TAT check
            tat_minutes = resolve_tat(ac_type, "domestic", "domestic")
            min_depart = label.time + tat_minutes * 60_000
            if flight.std_utc < min_depart:
                continue

            # Compute delay if connection forces later departure
            delay_ms = max(0, min_depart - flight.std_utc)
            delay_min = int(delay_ms / 60_000)

            # Arc cost = operational cost - dual value (reduced cost contribution)
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
                time=flight.sta_utc,
                cost=label.cost + arc_cost,
                flights=label.flights + [flight.id],
                delay_minutes=label.delay_minutes + delay_min,
            )
            new_labels.append(new_label)

            # Track best (most negative reduced cost with at least one flight)
            if new_label.flights and (
                best_label is None or new_label.cost < best_label.cost
            ):
                best_label = new_label

        labels.extend(new_labels)

        # Dominance pruning: keep only non-dominated labels per station
        by_station: dict[str, list[Label]] = {}
        for lbl in labels:
            by_station.setdefault(lbl.station, []).append(lbl)
        pruned: list[Label] = []
        for station_labels in by_station.values():
            station_labels.sort(key=lambda l: l.cost)
            kept: list[Label] = []
            for lbl in station_labels:
                # Keep if no dominating label exists
                dominated = False
                for k in kept:
                    if k.cost <= lbl.cost and k.time <= lbl.time:
                        dominated = True
                        break
                if not dominated:
                    kept.append(lbl)
            pruned.extend(kept)
        labels = pruned

    if best_label is None or best_label.cost >= -1e-6:
        return None  # No improving column

    # Compute revenue protected
    flight_map = {f.id: f for f in compatible}
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
    )
