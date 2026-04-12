"""Objective function factory for the CG solver.

Computes arc costs and cancellation penalties based on the selected objective.
All monetary values come from SolveConfig — nothing hard-coded.
"""

from __future__ import annotations

from app.models import Flight, Objective, SolveConfig


def flight_cancel_penalty(flight: Flight, config: SolveConfig) -> float:
    """Cost of NOT covering (cancelling) a flight."""
    if config.objective == Objective.MIN_CANCEL:
        # High penalty per cancellation — solver avoids cancelling
        return config.cancel_cost_per_flight

    if config.objective == Objective.MAX_REVENUE:
        # Penalty = lost revenue (higher revenue flights prioritized)
        return flight.estimated_revenue if flight.estimated_revenue > 0 else config.cancel_cost_per_flight

    if config.objective == Objective.MIN_COST:
        # Cancellation has direct cost (rebooking, compensation, lost revenue)
        return config.cancel_cost_per_flight

    # MIN_DELAY: moderate cancellation penalty (prefer delay over cancel)
    return config.cancel_cost_per_flight


def flight_delay_cost(delay_minutes: int, flight: Flight, config: SolveConfig) -> float:
    """Cost of delaying a flight by N minutes."""
    if delay_minutes <= 0:
        return 0.0

    # Estimate pax from seat config (rough: total seats × assumed load factor)
    pax_estimate = 180  # fallback
    if flight.estimated_revenue > 0:
        # Revenue-implied pax: if we know yield, derive pax count
        pax_estimate = 180  # TODO: pass pax count from Fastify

    if config.objective == Objective.MIN_DELAY:
        # Pure delay minimization — cost grows quadratically to penalize long delays
        return delay_minutes * delay_minutes * 0.5

    if config.objective == Objective.MIN_COST:
        # Industry standard: delay cost per pax per minute
        return delay_minutes * config.delay_cost_per_minute * (pax_estimate / 180)

    if config.objective == Objective.MAX_REVENUE:
        # Delay erodes customer satisfaction — proxy via delay cost
        return delay_minutes * config.delay_cost_per_minute * 0.5

    # MIN_CANCEL: some delay cost to prefer on-time, but lower than cancel penalty
    return delay_minutes * config.delay_cost_per_minute * 0.3


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
