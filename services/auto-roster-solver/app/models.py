from __future__ import annotations
from pydantic import BaseModel


class CrewItem(BaseModel):
    id: str
    gender: str = "unknown"  # "male" | "female" | "unknown"


class PairingItem(BaseModel):
    # Note: for multi-seat pairings, the orchestrator expands each real pairing
    # into N virtual pairings, one per required seat. `id` is then the virtual
    # id (`${parent_pairing_id}__${seat_code}__${seat_index}`) and the solver
    # treats each as an independent pairing. Siblings share the parent's time
    # window so the existing pairwise-rest constraint prevents a single crew
    # from occupying two seats of the same parent.
    id: str
    days: list[str]          # ISO dates covered by this pairing (for conflict detection)
    bh_min: int = 0          # total block hours in minutes
    duty_min: int = 0        # total duty minutes (brief + flight + debrief)
    landings: int = 0        # number of sectors / landings in pairing
    layover_stations: list[str] = []  # ICAO codes of layover airports
    start_utc_ms: int = 0    # precise window for time-based conflict + rest check
    end_utc_ms: int = 0
    parent_pairing_id: str = ""  # real pairing id; defaults to own id for single-seat
    seat_code: str = ""          # CrewPosition code (e.g. "CP", "FO", "FA")
    seat_index: int = 0          # 0..N-1 within the parent's seat count for this code
    morning_flag: int = 0        # 1 if the pairing reports before 12:00 UTC
    afternoon_flag: int = 0      # 1 if the pairing reports between 12:00 and 18:00 UTC


class FdtlCumulativeLimit(BaseModel):
    """Rolling-window cumulative cap derived from the operator's FDTL ruleset.

    field:    'block' | 'duty' | 'landings'
    window_ms: sliding window size in milliseconds (e.g. 7d = 604_800_000)
    limit:    max minutes (for block/duty) or count (for landings) per window
    code:     original rule code (for stats; e.g. 'MAX_DUTY_7D')
    """
    field: str
    window_ms: int
    limit: int
    code: str = ""


class SoftConsecDutyRule(BaseModel):
    """Soft rule penalising runs of consecutive duty days beyond `limit_days`.

    The solver adds, per crew, a penalty equal to `weight * excess_days` where
    excess_days = number of duty days inside any sliding (limit_days+1) window
    that exceed the limit. variant narrows which duties count:
      'any'       — all duties
      'morning'   — pairings with morning_flag == 1
      'afternoon' — pairings with afternoon_flag == 1
    """
    variant: str = "any"
    limit_days: int
    weight: int = 5


class WeeklyRestRule(BaseModel):
    """Extended-recovery / weekly-rest requirement.

    CAAV §15.037(d): 36h continuous rest within every 168h rolling window.
    Solver approximates at day level — requires N free days per window where
    N = ceil(rest_min / 1440). Two free consecutive days ≈ 36h continuous
    once paired with the inter-pairing rest gap.
    """
    rest_min: int             # minutes of continuous rest required
    window_hours: int = 168   # rolling window size


class QolSoftRule(BaseModel):
    """Per-crew, per-date Quality-of-Life cutoff. Penalises pairings on
    `date` that violate the cutoff:
      - kind='wind_down'  → pairing end_utc must be on/before `date`@cutoff_min
      - kind='late_return' → pairing start_utc must be on/after `date`@cutoff_min
    cutoff_min is minutes-from-midnight UTC (orchestrator-assumed; per-crew
    timezone conversion not yet wired). weight is 1-10.
    """
    crew_id: str
    kind: str             # 'wind_down' | 'late_return'
    date: str             # ISO YYYY-MM-DD
    cutoff_min: int       # 0..1440
    weight: int = 5


class SolverConfig(BaseModel):
    gender_balance_weight: int = 80   # 0-100, from OperatorSchedulingConfig.objectives
    destination_rules: list[dict] = []  # {scope, codes, max_layovers_per_period, ...}
    min_rest_min: int = 720           # FDTL min rest between pairings — buffers used by pair-mutex
    fdtl_limits: list[FdtlCumulativeLimit] = []  # rolling-window cumulative caps
    weekly_rest: WeeklyRestRule | None = None    # CAAV §15.037(d) / FAA 117.25
    soft_consec_duty: list[SoftConsecDutyRule] = []  # planner-tunable soft caps
    qol_soft_rules: list[QolSoftRule] = []  # wind-down / late-return per-crew cutoffs


class SolveRequest(BaseModel):
    run_id: str
    crew: list[CrewItem]
    pairings: list[PairingItem]
    # allowed[crew_id] = list of pairing_ids that are FDTL-legal for that crew
    allowed: dict[str, list[str]]
    config: SolverConfig = SolverConfig()
    time_limit_sec: int = 60
