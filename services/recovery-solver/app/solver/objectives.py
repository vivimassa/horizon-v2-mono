"""Objective function factory for the CG solver.

Computes arc costs and cancellation penalties based on the selected objective.
Supports multi-objective blending, connection protection, propagation penalty,
and LOPA-based pax counts.

All monetary values come from SolveConfig — nothing hard-coded.
"""

from __future__ import annotations

from app.models import Flight, Objective, SolveConfig


def flight_cancel_penalty(flight: Flight, config: SolveConfig) -> float:
    """Cost of NOT covering (cancelling) a flight."""
    if config.objective_weights:
        # Multi-objective blend: weighted mix of all perspectives
        w = config.objective_weights
        base = config.cancel_cost_per_flight
        rev = flight.estimated_revenue if flight.estimated_revenue > 0 else base
        penalty = w.delay * base + w.cost * base + w.cancel * base + w.revenue * rev
    elif config.objective == Objective.MAX_REVENUE:
        # Penalty = lost revenue (higher revenue flights prioritized)
        penalty = flight.estimated_revenue if flight.estimated_revenue > 0 else config.cancel_cost_per_flight
    else:
        # MIN_DELAY, MIN_COST, MIN_CANCEL: use configured cancel cost
        penalty = config.cancel_cost_per_flight

    # Priority flights: 10x cancel penalty to strongly discourage cancellation
    if flight.is_priority:
        penalty *= 10.0

    return penalty


def flight_delay_cost(delay_minutes: int, flight: Flight, config: SolveConfig) -> float:
    """Cost of delaying a flight by N minutes.

    Accounts for: pax count (LOPA), connection risk, rotation propagation.
    """
    if delay_minutes <= 0:
        return 0.0

    # Use LOPA-based pax count instead of hardcoded 180
    pax = flight.pax_count if flight.pax_count > 0 else 180

    if config.objective_weights:
        # Multi-objective blend: weighted mix of all four cost perspectives
        w = config.objective_weights
        d_quadratic = delay_minutes * delay_minutes * 0.5  # MIN_DELAY perspective
        d_linear = delay_minutes * config.delay_cost_per_minute * (pax / 180)  # MIN_COST
        d_conservative = delay_minutes * config.delay_cost_per_minute * 0.3  # MIN_CANCEL
        d_revenue = delay_minutes * config.delay_cost_per_minute * 0.5  # MAX_REVENUE
        base_cost = (
            w.delay * d_quadratic
            + w.cost * d_linear
            + w.cancel * d_conservative
            + w.revenue * d_revenue
        )
    elif config.objective == Objective.MIN_DELAY:
        # Quadratic penalty to penalize long delays
        base_cost = delay_minutes * delay_minutes * 0.5
    elif config.objective == Objective.MIN_COST:
        # Industry standard: delay cost per pax per minute
        base_cost = delay_minutes * config.delay_cost_per_minute * (pax / 180)
    elif config.objective == Objective.MAX_REVENUE:
        # Delay erodes customer satisfaction — proxy via delay cost
        base_cost = delay_minutes * config.delay_cost_per_minute * 0.5
    else:
        # MIN_CANCEL: some delay cost to prefer on-time, but lower than cancel penalty
        base_cost = delay_minutes * config.delay_cost_per_minute * 0.3

    # Connection protection: extra cost when delay risks breaking pax connections
    if config.connection_protection_minutes > 0 and flight.connecting_pax > 0:
        connection_penalty = (
            flight.connecting_pax * delay_minutes * config.delay_cost_per_minute * 0.5
        )
        base_cost += connection_penalty

    # Propagation multiplier: early rotation legs get heavier delay penalty
    if (
        config.propagation_multiplier > 1.0
        and flight.rotation_sequence is not None
        and flight.rotation_total_legs > 1
    ):
        remaining_legs = flight.rotation_total_legs - (flight.rotation_sequence or 1)
        propagation_factor = 1.0 + remaining_legs * (config.propagation_multiplier - 1.0)
        base_cost *= propagation_factor

    return base_cost


def fuel_cost(
    block_minutes: int,
    fuel_burn_kg_per_hour: float | None,
    config: SolveConfig,
) -> float:
    """Fuel cost for operating a flight."""
    if fuel_burn_kg_per_hour is None or fuel_burn_kg_per_hour <= 0:
        return 0.0
    fuel_kg = (block_minutes / 60.0) * fuel_burn_kg_per_hour
    return fuel_kg * config.fuel_price_per_kg
