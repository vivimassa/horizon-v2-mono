"""Pydantic schemas for the recovery solver request/response contract.

All parameters are passed in the request — the solver has NO defaults.
The Fastify proxy populates these from Operator.recoveryConfig + dialog overrides.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# ── Enums ──


class Objective(str, Enum):
    MIN_DELAY = "min_delay"
    MIN_CANCEL = "min_cancel"
    MIN_COST = "min_cost"
    MAX_REVENUE = "max_revenue"


# ── Request Models ──


class Flight(BaseModel):
    id: str  # composite: scheduledFlightId|operatingDate
    flight_number: str
    dep_station: str  # IATA
    arr_station: str  # IATA
    std_utc: int  # epoch ms
    sta_utc: int  # epoch ms
    block_minutes: int
    aircraft_type_icao: str | None = None
    aircraft_reg: str | None = None  # current assignment
    rotation_id: str | None = None
    rotation_sequence: int | None = None
    # Revenue estimate (pre-computed by Fastify from CityPair + LOPA)
    estimated_revenue: float = 0.0  # USD


class Aircraft(BaseModel):
    registration: str
    aircraft_type_icao: str
    home_base_icao: str | None = None
    fuel_burn_rate_kg_per_hour: float | None = None
    seat_config: str | None = None  # e.g. "0/0/230"
    # Current position (derived from last locked flight's arrival station)
    current_station: str | None = None
    available_from_utc: int | None = None  # epoch ms — when aircraft becomes free


class AircraftType(BaseModel):
    icao_type: str
    tat_default_minutes: int = 45
    tat_dom_dom: int | None = None
    tat_dom_int: int | None = None
    tat_int_dom: int | None = None
    tat_int_int: int | None = None
    fuel_burn_rate_kg_per_hour: float | None = None


class SolveConfig(BaseModel):
    """All parameters — no defaults baked in. Fastify provides everything."""

    objective: Objective
    horizon_hours: float
    lock_threshold_minutes: float
    max_solutions: int
    max_solve_seconds: float
    delay_cost_per_minute: float  # USD per pax per minute
    cancel_cost_per_flight: float  # USD per cancelled flight
    fuel_price_per_kg: float  # USD per kg


class SolveRequest(BaseModel):
    """Complete solver input — assembled by Fastify proxy from MongoDB data."""

    available_flights: list[Flight]  # Solver CAN reassign
    locked_flights: list[Flight]  # OOOI or within threshold — position visible, cannot move
    frozen_flights: list[Flight]  # Beyond horizon — position visible, cannot move
    aircraft: list[Aircraft]
    aircraft_types: list[AircraftType]
    config: SolveConfig


# ── Response Models ──


class AssignmentChange(BaseModel):
    flight_id: str
    from_reg: str | None = None
    to_reg: str
    new_std_utc: int | None = None  # if retimed
    reason: str  # human-readable explanation


class SolutionMetrics(BaseModel):
    total_delay_minutes: int = 0
    flights_changed: int = 0
    cancellations: int = 0
    estimated_cost_impact: float = 0.0  # negative = cost incurred
    estimated_revenue_protected: float = 0.0  # revenue kept vs full cancellation
    pax_affected: int = 0


class Solution(BaseModel):
    id: str
    label: str  # "Option A", "Option B", ...
    summary: str  # human-readable one-liner
    metrics: SolutionMetrics
    assignments: list[AssignmentChange]


class LockedCounts(BaseModel):
    departed: int = 0
    within_threshold: int = 0
    beyond_horizon: int = 0


class SolveResult(BaseModel):
    solutions: list[Solution]
    locked: LockedCounts
    solve_time_ms: int = 0


# ── SSE Event Models ──


class ProgressEvent(BaseModel):
    phase: str  # "building_network", "cg_iteration", "generating_solutions"
    iteration: int = 0
    objective_value: float = 0.0
    columns_generated: int = 0
    pool_size: int = 0
    elapsed_ms: int = 0
