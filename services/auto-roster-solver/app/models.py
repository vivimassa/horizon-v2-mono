from __future__ import annotations
from pydantic import BaseModel


class CrewItem(BaseModel):
    id: str
    gender: str = "unknown"  # "male" | "female" | "unknown"


class PairingItem(BaseModel):
    id: str
    days: list[str]          # ISO dates covered by this pairing (for conflict detection)
    bh_min: int = 0          # total block hours in minutes
    layover_stations: list[str] = []  # ICAO codes of layover airports


class SolverConfig(BaseModel):
    gender_balance_weight: int = 80   # 0-100, from OperatorSchedulingConfig.objectives
    destination_rules: list[dict] = []  # {code, max_layovers_per_period, scope}


class SolveRequest(BaseModel):
    run_id: str
    crew: list[CrewItem]
    pairings: list[PairingItem]
    # allowed[crew_id] = list of pairing_ids that are FDTL-legal for that crew
    allowed: dict[str, list[str]]
    config: SolverConfig = SolverConfig()
    time_limit_sec: int = 60
