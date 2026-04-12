"""Build the time-space network for the pricing subproblem.

Each aircraft gets a directed acyclic graph where:
- Nodes are (station, time) positions
- Arcs are feasible flight connections (respecting TAT and station continuity)
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Aircraft, AircraftType, Flight


@dataclass
class Arc:
    """A feasible flight arc in the time-space network."""

    flight: Flight
    dep_station: str
    arr_station: str
    dep_time: int  # epoch ms
    arr_time: int  # epoch ms
    cost: float  # objective-dependent cost of including this arc
    revenue: float  # revenue protected by operating this flight
    delay_minutes: int  # delay relative to original STD (0 if on-time)


@dataclass
class NetworkNode:
    """A position in the time-space network."""

    station: str
    time: int  # epoch ms
    outgoing: list[int] = field(default_factory=list)  # indices into arc list


@dataclass
class AircraftNetwork:
    """Complete time-space network for one aircraft."""

    aircraft: Aircraft
    nodes: list[NetworkNode]
    arcs: list[Arc]
    source_idx: int  # index of source node (aircraft current position)
    sink_idx: int  # index of sink node (end of horizon)


def resolve_tat(
    ac_type: AircraftType,
    inbound_route_type: str,
    outbound_route_type: str,
) -> int:
    """Get the appropriate TAT in minutes for a connection."""
    is_in_dom = inbound_route_type == "domestic"
    is_out_dom = outbound_route_type == "domestic"

    if is_in_dom and is_out_dom and ac_type.tat_dom_dom is not None:
        return ac_type.tat_dom_dom
    if is_in_dom and not is_out_dom and ac_type.tat_dom_int is not None:
        return ac_type.tat_dom_int
    if not is_in_dom and is_out_dom and ac_type.tat_int_dom is not None:
        return ac_type.tat_int_dom
    if not is_in_dom and not is_out_dom and ac_type.tat_int_int is not None:
        return ac_type.tat_int_int

    return ac_type.tat_default_minutes


def build_aircraft_network(
    aircraft: Aircraft,
    ac_type: AircraftType,
    available_flights: list[Flight],
    locked_flights: list[Flight],
    horizon_end_ms: int,
    cancel_cost: float,
) -> AircraftNetwork:
    """Build the time-space network for a single aircraft.

    Only flights matching this aircraft's type are included as arcs.
    The source node is the aircraft's current position (from locked flights or home base).
    The sink node is the end-of-horizon dummy.
    """
    # Filter flights compatible with this aircraft type
    compatible = [
        f
        for f in available_flights
        if f.aircraft_type_icao == ac_type.icao_type or f.aircraft_type_icao is None
    ]

    # Sort by departure time
    compatible.sort(key=lambda f: f.std_utc)

    # Determine aircraft starting position from locked flights
    current_station = aircraft.current_station or aircraft.home_base_icao or ""
    available_from = aircraft.available_from_utc or 0

    # Build nodes and arcs
    nodes: list[NetworkNode] = []
    arcs: list[Arc] = []

    # Source node: aircraft's current position
    source_idx = 0
    nodes.append(NetworkNode(station=current_station, time=available_from))

    # Create an arc for each compatible flight
    for flight in compatible:
        if flight.std_utc > horizon_end_ms:
            continue
        if flight.std_utc < available_from:
            continue

        arc_idx = len(arcs)
        arcs.append(
            Arc(
                flight=flight,
                dep_station=flight.dep_station,
                arr_station=flight.arr_station,
                dep_time=flight.std_utc,
                arr_time=flight.sta_utc,
                cost=0.0,  # set by objective function later
                revenue=flight.estimated_revenue,
                delay_minutes=0,
            )
        )

        # Add departure node
        dep_node_idx = len(nodes)
        nodes.append(NetworkNode(station=flight.dep_station, time=flight.std_utc))

        # Add arrival node
        arr_node_idx = len(nodes)
        nodes.append(
            NetworkNode(station=flight.arr_station, time=flight.sta_utc)
        )

    # Sink node: end of horizon
    sink_idx = len(nodes)
    nodes.append(NetworkNode(station="SINK", time=horizon_end_ms))

    # Build adjacency: connect nodes where station continuity + TAT hold
    # Source can reach any flight departing from source station after available_from
    tat_ms = resolve_tat(ac_type, "domestic", "domestic") * 60_000  # simplified for source

    for i, arc in enumerate(arcs):
        # Source → flight (if station matches and time allows)
        if arc.dep_station == current_station and arc.dep_time >= available_from:
            nodes[source_idx].outgoing.append(i)

        # Flight i → flight j (if arr_station_i == dep_station_j and TAT satisfied)
        for j, next_arc in enumerate(arcs):
            if j <= i:
                continue
            if arc.arr_station != next_arc.dep_station:
                continue
            min_connect = arc.arr_time + tat_ms
            if next_arc.dep_time >= min_connect:
                # The arrival node of arc i can reach arc j
                pass  # adjacency is handled in pricing via label propagation

    return AircraftNetwork(
        aircraft=aircraft,
        nodes=nodes,
        arcs=arcs,
        source_idx=source_idx,
        sink_idx=sink_idx,
    )
