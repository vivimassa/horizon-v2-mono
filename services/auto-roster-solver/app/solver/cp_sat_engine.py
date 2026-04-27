"""CP-SAT crew assignment solver.

Objectives (weighted-sum, priority approximated by large weight ratios):
  1. Minimise unassigned pairings (coverage — highest priority)
  2. Minimise idle qualified crew (soft load distribution)
  3. Minimise block-hour max-min spread across crew (fairness)
  4. Reward mixed-gender staffing on layover pairings (configurable)

Hard constraints:
  - Each pairing covered by at most one crew (slack variable absorbs the rest)
  - Sibling-seat mutex: a crew cannot take two seats on the same parent pairing
  - Pairwise overlap + minimum rest between assigned pairings per crew
  - Rolling-window cumulative caps (MAX_BLOCK_*D, MAX_DUTY_*D, MAX_LANDINGS_*D)
    from the operator's FDTL ruleset
"""
from __future__ import annotations

import asyncio
import calendar
import os
import time
from typing import AsyncIterator

from ortools.sat.python import cp_model

from app.models import SolveRequest


def _days_overlap(days_a: list[str], days_b: list[str]) -> bool:
    return bool(set(days_a) & set(days_b))


def _windows_conflict(a_start: int, a_end: int, b_start: int, b_end: int, rest_min_ms: int) -> bool:
    """True if two pairing windows overlap OR the gap between them is
    below the required minimum rest. Used for CP-SAT mutex constraints
    so the solver never co-assigns two pairings that violate FDTL rest.
    """
    if a_start <= 0 or a_end <= 0 or b_start <= 0 or b_end <= 0:
        return False
    # Extend each window by rest buffer on trailing edge.
    # Conflict if extended ranges overlap.
    return a_start < b_end + rest_min_ms and b_start < a_end + rest_min_ms


async def solve(request: SolveRequest) -> AsyncIterator[dict]:
    model = cp_model.CpModel()

    crew_ids = [c.id for c in request.crew]
    pairing_ids = [p.id for p in request.pairings]
    pairing_by_id = {p.id: p for p in request.pairings}
    crew_by_id = {c.id: c for c in request.crew}

    allowed_set: dict[str, set[str]] = {
        cid: set(pids) for cid, pids in request.allowed.items()
    }

    # ── Decision variables ─────────────────────────────────────────────────
    # x[c_idx][p_idx] = 1 iff crew c is assigned to pairing p
    # Pre-filter: only create a var for (crew, pairing) pairs that the
    # orchestrator already marked FDTL-legal in `request.allowed`. Constraints
    # below all guard with `if (ci, pi) in x` so they short-circuit on
    # excluded pairs. The orchestrator owns full legality (qualification,
    # base, position, FDTL hard caps); the solver model adds the rest as
    # CP-SAT constraints — never relies solely on the pre-filter.
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    for ci, cid in enumerate(crew_ids):
        legal = allowed_set.get(cid, set())
        for pi, pid in enumerate(pairing_ids):
            if pid in legal:
                x[(ci, pi)] = model.new_bool_var(f"x_{ci}_{pi}")

    n_pairings = len(pairing_ids)
    possible = len(crew_ids) * n_pairings
    legal_count = len(x)
    pct = (100 * legal_count / possible) if possible > 0 else 0
    print(
        f"[solver] pre-filter: {legal_count} legal of {possible} possible "
        f"({pct:.1f}% kept) — {len(crew_ids)} crew × {n_pairings} pairings",
        flush=True,
    )

    # ── Symmetry breaking on interchangeable crew ─────────────────────────
    # Cabin runs frequently have dozens of FAs at the same base with identical
    # qualification — CP-SAT would otherwise explore all permutations of these
    # equivalent crew. Collapse the symmetry by enforcing lex ordering on the
    # assignment vectors of crew within an equivalence class.
    #
    # Equivalence relation (conservative): two crew are equivalent iff they
    # have (a) the same gender (gender objective discriminates), and (b) the
    # EXACT same allowed pairing set. The allowed set is built upstream from
    # base + position + qualification + FDTL pre-filter, so identical allowed
    # sets imply identical legality from the solver's point of view. Anything
    # the solver doesn't see (seniority, prior assignments) stays the
    # orchestrator's concern.
    sym_classes: dict[tuple, list[int]] = {}
    for ci, cid in enumerate(crew_ids):
        key = (
            crew_by_id[cid].gender,
            frozenset(allowed_set.get(cid, set())),
        )
        sym_classes.setdefault(key, []).append(ci)

    sym_class_count = 0
    sym_crew_count = 0
    sym_constraints_added = 0
    pi_sorted = list(range(n_pairings))
    for key, members in sym_classes.items():
        if len(members) < 2:
            continue
        # Lex chain itself becomes a perf cost on very large classes.
        if len(members) > 200:
            continue
        sym_class_count += 1
        sym_crew_count += len(members)
        members_sorted = sorted(members, key=lambda c: crew_ids[c])
        # Build per-crew assignment vector aligned to pairing index order.
        # Slots without a decision var (illegal pair) are pinned to 0 via
        # constants so all vectors have the same length for add_lex_lesseq.
        zero = model.new_constant(0)
        vectors = []
        for ci in members_sorted:
            vec = [x[(ci, pi)] if (ci, pi) in x else zero for pi in pi_sorted]
            vectors.append(vec)
        for prev_vec, curr_vec in zip(vectors, vectors[1:]):
            model.add_lex_lesseq(prev_vec, curr_vec)
            sym_constraints_added += 1
    print(
        f"[solver] symmetry-breaking: {sym_class_count} classes, "
        f"{sym_crew_count} total crew in classes >1, "
        f"{sym_constraints_added} constraints added",
        flush=True,
    )

    # ── Hard constraint 1: each pairing covered by at most 1 crew ─────────
    # (slack_p = 1 means pairing p is unassigned)
    slack: list[cp_model.IntVar] = []
    for pi, pid in enumerate(pairing_ids):
        assigned = [x[(ci, pi)] for ci, cid in enumerate(crew_ids) if (ci, pi) in x]
        s = model.new_bool_var(f"slack_{pi}")
        slack.append(s)
        if assigned:
            # assigned vars + slack = 1  →  exactly one source covers this pairing
            model.add(sum(assigned) + s == 1)
        else:
            # no eligible crew at all — always unassigned
            model.add(s == 1)

    # ── Hard constraint 1b: sibling-seat mutex ────────────────────────────
    # For multi-seat pairings the orchestrator sends N virtual pairings
    # sharing the same parent_pairing_id. A single crew must occupy AT MOST
    # one seat of the same parent. Express as explicit sum constraint —
    # cheaper than the O(N²) intra-parent pairwise rest constraints below.
    parent_groups: dict[str, list[int]] = {}
    for pi, pid in enumerate(pairing_ids):
        parent = pairing_by_id[pid].parent_pairing_id or pid
        parent_groups.setdefault(parent, []).append(pi)
    for parent, pis in parent_groups.items():
        if len(pis) < 2:
            continue
        for ci, cid in enumerate(crew_ids):
            sibling_vars = [x[(ci, pi)] for pi in pis if (ci, pi) in x]
            if len(sibling_vars) >= 2:
                model.add(sum(sibling_vars) <= 1)

    # ── Hard constraint 2: no crew assigned to two overlapping OR
    # insufficient-rest pairings. Uses precise UTC windows when provided;
    # falls back to day-string overlap for legacy payloads. Rest buffer
    # comes from FDTL MIN_REST_HOME_BASE (passed via config.min_rest_min).
    rest_min_ms = int(request.config.min_rest_min) * 60 * 1000
    for ci, cid in enumerate(crew_ids):
        assigned_pairings = [(pi, pid) for pi, pid in enumerate(pairing_ids) if (ci, pi) in x]
        # Sort by start time to enable O(N × window) neighbour scan instead
        # of O(N²) — the rest window bounds how far we ever need to look.
        indexed = []
        for pi, pid in assigned_pairings:
            p = pairing_by_id[pid]
            indexed.append((p.start_utc_ms, pi, pid))
        indexed.sort(key=lambda t: t[0])
        for i in range(len(indexed)):
            a_start, pi, pid = indexed[i]
            a_end = pairing_by_id[pid].end_utc_ms
            if a_start <= 0 or a_end <= 0:
                # Fallback to day overlap for legacy payloads missing window.
                for j in range(i + 1, len(indexed)):
                    _, pj, pjd = indexed[j]
                    if _days_overlap(pairing_by_id[pid].days, pairing_by_id[pjd].days):
                        model.add(x[(ci, pi)] + x[(ci, pj)] <= 1)
                continue
            horizon = a_end + rest_min_ms
            for j in range(i + 1, len(indexed)):
                b_start, pj, pjd = indexed[j]
                if b_start >= horizon:
                    break  # all later pairings are clear of rest window
                b_end = pairing_by_id[pjd].end_utc_ms
                if _windows_conflict(a_start, a_end, b_start, b_end, rest_min_ms):
                    model.add(x[(ci, pi)] + x[(ci, pj)] <= 1)

    # ── Hard constraint 3: rolling cumulative FDTL caps ────────────────────
    # For each crew and each FDTL rolling-window limit, enumerate day-anchored
    # 7/14/28-day windows within the solve horizon and bound the sum of
    # (field-value × x) over pairings whose time range intersects the window.
    #
    # Complexity: crew × limits × days × mean-pairings-in-window. For a
    # 30-day solve with 50 FAs + 4 rule types, that's ~6k constraints. Well
    # within CP-SAT budget; if this ever grows tight we can drop daily
    # granularity in favour of per-pairing anchors only.
    fdtl_limits = request.config.fdtl_limits or []
    if fdtl_limits and crew_ids and pairing_ids:
        # Snap horizon to day boundaries in UTC. Start at min pairing start,
        # end at max pairing end; step 1 day.
        valid_starts = [p.start_utc_ms for p in request.pairings if p.start_utc_ms > 0]
        valid_ends = [p.end_utc_ms for p in request.pairings if p.end_utc_ms > 0]
        if valid_starts and valid_ends:
            horizon_start_ms = min(valid_starts)
            horizon_end_ms = max(valid_ends)
            DAY_MS = 86_400_000
            first_day = (horizon_start_ms // DAY_MS) * DAY_MS
            last_day = ((horizon_end_ms // DAY_MS) + 1) * DAY_MS

            # Pre-compute each pairing's field values.
            def field_val(p, field: str) -> int:
                if field == "block":
                    return int(p.bh_min or 0)
                if field == "duty":
                    return int(p.duty_min or p.bh_min or 0)
                if field == "landings":
                    return int(p.landings or 0)
                return 0

            anchor = first_day
            while anchor <= last_day:
                for lim in fdtl_limits:
                    window_start = anchor - lim.window_ms
                    # Which pairings fall inside (window_start, anchor]?
                    in_window_pi: list[tuple[int, int]] = []
                    for pi, pid in enumerate(pairing_ids):
                        p = pairing_by_id[pid]
                        if p.end_utc_ms <= window_start or p.start_utc_ms > anchor:
                            continue
                        v = field_val(p, lim.field)
                        if v > 0:
                            in_window_pi.append((pi, v))
                    if not in_window_pi:
                        continue
                    for ci, cid in enumerate(crew_ids):
                        terms = [v * x[(ci, pi)] for (pi, v) in in_window_pi if (ci, pi) in x]
                        if terms:
                            model.add(sum(terms) <= lim.limit)
                anchor += DAY_MS

    # ── Hard constraint 4: weekly extended-recovery rest ──────────────────
    # CAAV §15.037(d): 36h continuous rest within every 168h rolling window.
    # We approximate at day granularity: per crew, per sliding 7-day window,
    # require at least N_FREE days where the crew has no pairing assigned.
    # N_FREE = ceil(rest_min / 1440). Two consecutive free days paired with
    # the inter-pairing min-rest constraint typically yields > 36h continuous.
    weekly_rest = request.config.weekly_rest
    if weekly_rest and weekly_rest.rest_min > 0 and crew_ids and pairing_ids:
        DAY_MS = 86_400_000
        window_days = max(1, round(weekly_rest.window_hours / 24))
        n_free = max(1, -(-weekly_rest.rest_min // 1440))  # ceil division
        # Day-level indicator: pairing_day[ci, d_idx] = OR of x[ci, pi] for
        # pairings whose window overlaps day d. If any pairing occupies day d
        # for crew ci, pairing_day[ci, d] = 1.
        valid_starts = [p.start_utc_ms for p in request.pairings if p.start_utc_ms > 0]
        valid_ends = [p.end_utc_ms for p in request.pairings if p.end_utc_ms > 0]
        if valid_starts and valid_ends:
            first_day_ms = (min(valid_starts) // DAY_MS) * DAY_MS
            last_day_ms = ((max(valid_ends) // DAY_MS) + 1) * DAY_MS
            horizon_days = max(1, int((last_day_ms - first_day_ms) // DAY_MS))
            for ci, cid in enumerate(crew_ids):
                day_vars: list[cp_model.IntVar] = []
                for d_idx in range(horizon_days):
                    day_start = first_day_ms + d_idx * DAY_MS
                    day_end = day_start + DAY_MS
                    pairing_on_day = [
                        x[(ci, pi)]
                        for pi, pid in enumerate(pairing_ids)
                        if (ci, pi) in x
                        and pairing_by_id[pid].start_utc_ms < day_end
                        and pairing_by_id[pid].end_utc_ms > day_start
                    ]
                    day_var = model.new_bool_var(f"on_duty_{ci}_{d_idx}")
                    if pairing_on_day:
                        # day_var = 1 iff any pairing on that day for this crew.
                        model.add_max_equality(day_var, pairing_on_day)
                    else:
                        model.add(day_var == 0)
                    day_vars.append(day_var)
                # Sliding window: sum of busy days ≤ window_days - n_free.
                max_busy = window_days - n_free
                if max_busy < 0:
                    max_busy = 0
                for start in range(0, max(1, horizon_days - window_days + 1)):
                    window = day_vars[start : start + window_days]
                    if len(window) == window_days:
                        model.add(sum(window) <= max_busy)

    # ── Soft consecutive-duty rules (planner-tunable) ────────────────────
    # For each configured rule, per crew, per sliding (limit+1)-day window:
    # excess = max(0, sum_duty_days_in_window - limit). Penalty = excess ×
    # weight × SOFT_CONSEC_WEIGHT_SCALE added to the objective.
    SOFT_CONSEC_WEIGHT_SCALE = 200  # 1 excess day @ weight 5 → 1000 obj points
    soft_excess_terms: list[tuple[cp_model.IntVar, int]] = []
    soft_rules = request.config.soft_consec_duty or []
    if soft_rules and crew_ids and pairing_ids:
        DAY_MS = 86_400_000
        valid_starts = [p.start_utc_ms for p in request.pairings if p.start_utc_ms > 0]
        valid_ends = [p.end_utc_ms for p in request.pairings if p.end_utc_ms > 0]
        if valid_starts and valid_ends:
            first_day_ms = (min(valid_starts) // DAY_MS) * DAY_MS
            last_day_ms = ((max(valid_ends) // DAY_MS) + 1) * DAY_MS
            horizon_days = max(1, int((last_day_ms - first_day_ms) // DAY_MS))
            for rule in soft_rules:
                limit = max(1, int(rule.limit_days))
                weight = max(0, int(rule.weight)) * SOFT_CONSEC_WEIGHT_SCALE
                if weight <= 0:
                    continue
                variant = rule.variant or "any"
                def qualifies(p):
                    if variant == "morning":
                        return int(getattr(p, "morning_flag", 0) or 0) == 1
                    if variant == "afternoon":
                        return int(getattr(p, "afternoon_flag", 0) or 0) == 1
                    return True
                for ci, cid in enumerate(crew_ids):
                    # Build per-day duty indicator for this crew (qualifying pairings only).
                    day_vars: list[cp_model.IntVar] = []
                    for d_idx in range(horizon_days):
                        day_start = first_day_ms + d_idx * DAY_MS
                        day_end = day_start + DAY_MS
                        terms = [
                            x[(ci, pi)]
                            for pi, pid in enumerate(pairing_ids)
                            if (ci, pi) in x
                            and qualifies(pairing_by_id[pid])
                            and pairing_by_id[pid].start_utc_ms < day_end
                            and pairing_by_id[pid].end_utc_ms > day_start
                        ]
                        dv = model.new_bool_var(f"soft_{variant}_duty_{ci}_{d_idx}")
                        if terms:
                            model.add_max_equality(dv, terms)
                        else:
                            model.add(dv == 0)
                        day_vars.append(dv)
                    # Sliding (limit+1)-day window — excess = max(0, sum - limit).
                    for start in range(0, max(1, horizon_days - limit)):
                        window = day_vars[start : start + limit + 1]
                        if len(window) < limit + 1:
                            break
                        excess = model.new_int_var(0, limit + 1, f"excess_{variant}_{ci}_{start}")
                        model.add(excess >= sum(window) - limit)
                        soft_excess_terms.append((excess, weight))

    # ── Objective: weighted sum — priority approximated by weight ratios ──
    # Cockpit defaults to 1M (every missing seat is critical). Cabin runs may
    # pass a lower value via coverage_weight_default so fairness/QoL terms can
    # trade against marginal coverage on huge problems where 100% coverage is
    # neither required by FDTL nor operationally critical.
    COVERAGE_WEIGHT = (
        int(request.coverage_weight_default)
        if request.coverage_weight_default is not None and request.coverage_weight_default > 0
        else 1_000_000
    )
    BH_FAIRNESS_WEIGHT = 100
    GENDER_WEIGHT_SCALE = request.config.gender_balance_weight  # 0-100

    # Block hours per crew (scaled to integers — multiply by 1 since bh_min already int)
    n_crew = len(crew_ids)
    if n_crew > 0:
        bh_per_crew = []
        for ci, cid in enumerate(crew_ids):
            assigned = [
                pairing_by_id[pid].bh_min * x[(ci, pi)]
                for pi, pid in enumerate(pairing_ids)
                if (ci, pi) in x
            ]
            bh = model.new_int_var(0, 100_000, f"bh_{ci}")
            if assigned:
                model.add(bh == sum(assigned))
            else:
                model.add(bh == 0)
            bh_per_crew.append(bh)

        # BH variance proxy: sum of (bh_i - mean)^2 is non-linear.
        # Use sum of |bh_i - bh_j| linearized via max - min instead.
        bh_max = model.new_int_var(0, 100_000, "bh_max")
        bh_min_var = model.new_int_var(0, 100_000, "bh_min")
        model.add_max_equality(bh_max, bh_per_crew)
        model.add_min_equality(bh_min_var, bh_per_crew)
        bh_spread = model.new_int_var(0, 100_000, "bh_spread")
        model.add(bh_spread == bh_max - bh_min_var)
    else:
        bh_spread = model.new_constant(0)

    # Objective: minimise (unassigned * COVERAGE_WEIGHT) + (bh_spread * BH_FAIRNESS_WEIGHT)
    obj_terms = [s * COVERAGE_WEIGHT for s in slack]
    obj_terms.append(bh_spread * BH_FAIRNESS_WEIGHT)

    # Planner-defined soft consecutive-duty penalties.
    for excess_var, w in soft_excess_terms:
        obj_terms.append(excess_var * w)

    # ── Quality of Life: wind-down / late-return soft penalties ──────────
    # For each (crew, date, kind, cutoff) rule, penalise any assignment of a
    # pairing on that date that breaches the cutoff. cutoff_min is interpreted
    # as minutes-from-midnight UTC (per orchestrator convention).
    QOL_WEIGHT_SCALE = 200  # weight 5 → 1000 obj points per breaching pairing
    qol_rules = request.config.qol_soft_rules or []
    if qol_rules and crew_ids and pairing_ids:
        DAY_MS = 86_400_000
        crew_idx = {cid: ci for ci, cid in enumerate(crew_ids)}
        for rule in qol_rules:
            ci = crew_idx.get(rule.crew_id)
            if ci is None:
                continue
            try:
                day_start_ms = (
                    calendar.timegm(time.strptime(rule.date, "%Y-%m-%d")) * 1000
                )
            except Exception:
                continue
            day_end_ms = day_start_ms + DAY_MS
            cutoff_ms = day_start_ms + max(0, min(1440, int(rule.cutoff_min))) * 60_000
            weight = max(0, int(rule.weight)) * QOL_WEIGHT_SCALE
            if weight <= 0:
                continue
            for pi, pid in enumerate(pairing_ids):
                if (ci, pi) not in x:
                    continue
                p = pairing_by_id[pid]
                if p.start_utc_ms <= 0 or p.end_utc_ms <= 0:
                    continue
                # Pairing must overlap the target date to count.
                if p.end_utc_ms <= day_start_ms or p.start_utc_ms >= day_end_ms:
                    continue
                if rule.kind == "wind_down":
                    breaches = p.end_utc_ms > cutoff_ms
                elif rule.kind == "late_return":
                    breaches = p.start_utc_ms < cutoff_ms
                else:
                    breaches = False
                if breaches:
                    obj_terms.append(x[(ci, pi)] * weight)

    # Idle-crew soft penalty: a qualified crew with at least one legal pairing
    # but zero assignments is penalised — strong enough to beat BH fairness
    # (which would otherwise be content leaving crew empty as long as max-min
    # stays small) but weaker than coverage (never sacrifice a pairing just
    # to load a crew). Crew with no legal pairings (unqualified for any seat
    # in this run) are skipped so we never introduce infeasibility.
    IDLE_PENALTY = COVERAGE_WEIGHT // 10  # 100_000
    for ci, cid in enumerate(crew_ids):
        legal_vars = [x[(ci, pi)] for pi, pid in enumerate(pairing_ids) if (ci, pi) in x]
        if not legal_vars:
            continue
        idle = model.new_bool_var(f"idle_{ci}")
        # sum(legal) + idle >= 1  →  either at least one assignment, or idle=1
        model.add(sum(legal_vars) + idle >= 1)
        obj_terms.append(idle * IDLE_PENALTY)

    # Gender balance bonus: pairings with mixed-gender crew on layovers
    # Proxy: penalise same-gender assignments on layover pairings
    if GENDER_WEIGHT_SCALE > 0:
        for pi, pid in enumerate(pairing_ids):
            pairing = pairing_by_id[pid]
            if not pairing.layover_stations:
                continue
            male_assigned = [
                x[(ci, pi)]
                for ci, cid in enumerate(crew_ids)
                if (ci, pi) in x and crew_by_id[cid].gender == "male"
            ]
            female_assigned = [
                x[(ci, pi)]
                for ci, cid in enumerate(crew_ids)
                if (ci, pi) in x and crew_by_id[cid].gender == "female"
            ]
            # Reward mixed assignment: subtract reward when both genders present
            # (CP-SAT is minimising so we add a penalty for imbalance)
            if male_assigned and female_assigned:
                any_male = model.new_bool_var(f"any_m_{pi}")
                any_female = model.new_bool_var(f"any_f_{pi}")
                model.add_max_equality(any_male, male_assigned)
                model.add_max_equality(any_female, female_assigned)
                mixed = model.new_bool_var(f"mixed_{pi}")
                model.add_min_equality(mixed, [any_male, any_female])
                # Penalty for NOT mixed (imbalance = 1 - mixed)
                imbalance = model.new_bool_var(f"imbal_{pi}")
                model.add(imbalance == 1 - mixed)
                obj_terms.append(imbalance * GENDER_WEIGHT_SCALE)

    model.minimize(sum(obj_terms))

    # ── Solve with SSE progress callbacks ──────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(request.time_limit_sec)
    # Use all available CPU cores (was hard-capped at 4). CP-SAT scales nearly
    # linearly with worker count up to physical-core count for portfolio search.
    solver.parameters.num_workers = os.cpu_count() or 8
    # Accept solutions within 2% of optimal — CP-SAT spends most of its time
    # chasing the last 1-2% with no operational benefit (rosters are equivalent
    # for crew). Pairs with the 30s no-improvement early stop below; first one
    # to fire wins. Cabin runs may override (e.g. 0.05) for huge problems.
    solver.parameters.relative_gap_limit = (
        float(request.relative_gap_limit_override)
        if request.relative_gap_limit_override is not None and request.relative_gap_limit_override > 0
        else 0.02
    )
    # Toggle verbose CP-SAT search log via env for diagnostics. Off by default
    # to keep server logs clean.
    solver.parameters.log_search_progress = (
        os.environ.get("AUTO_ROSTER_SOLVER_DEBUG") == "1"
    )

    # Optional LNS-only mode for huge problems where exact CP-SAT search
    # struggles to find a first feasible quickly.
    # CAVEATS:
    # - LNS objective scores are heuristic — NOT comparable across runs.
    #   Audit-log readers must understand a lower score from an LNS run does
    #   not necessarily mean a "better" roster than a higher score from an
    #   exact run.
    # - LNS may fail to find ANY feasible solution on over-constrained
    #   problems where exact CP-SAT would succeed. Use behind a flag.
    lns_mode = bool(request.lns_only)
    if lns_mode:
        solver.parameters.use_lns_only = True
        solver.parameters.num_search_workers = max(8, solver.parameters.num_workers)

    start_ts = time.monotonic()

    class ProgressCallback(cp_model.CpSolverSolutionCallback):
        def __init__(self, queue: asyncio.Queue):
            super().__init__()
            self._queue = queue
            self._best = None
            self.last_pct = 20
            self.last_covered = 0
            self.solution_count = 0
            self.last_improvement_ts = time.monotonic()

        def on_solution_callback(self):
            obj = int(self.objective_value)
            unassigned = obj // COVERAGE_WEIGHT
            covered = len(pairing_ids) - unassigned
            pct = max(0, min(99, 100 - int(100 * unassigned / max(1, len(pairing_ids)))))
            improved = self._best is None or obj < self._best
            if improved:
                self.last_improvement_ts = time.monotonic()
            self.last_pct = pct
            self.last_covered = covered
            self.solution_count += 1
            event = {
                "event": "progress",
                "data": {
                    "pct": pct,
                    "message": f"Roster #{self.solution_count}: {covered}/{len(pairing_ids)} positions filled ({pct}%)",
                    "best_obj": obj,
                },
            }
            self._best = obj
            try:
                self._queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    cb = ProgressCallback(queue)

    # Emit initial event with model size so client knows work was accepted
    yield {
        "event": "progress",
        "data": {
            "pct": 20,
            "message": f"Optimizer starting — {n_crew} crew, {len(pairing_ids)} open positions",
            "best_obj": None,
        },
    }

    # Run solver in thread to avoid blocking event loop
    def run_solver():
        return solver.solve(model, cb)

    solver_future = loop.run_in_executor(None, run_solver)

    # Interleave: drain queue + heartbeat while solver runs.
    # CP-SAT may spend long time before first feasible solution; without
    # heartbeats the SSE stream looks dead to the client.
    # Early stop: if no improvement for NO_IMPROVEMENT_STOP_SEC, abort search.
    NO_IMPROVEMENT_STOP_SEC = 30.0
    heartbeat_interval = 2.0
    next_heartbeat = time.monotonic() + heartbeat_interval
    early_stopped = False
    while not solver_future.done():
        try:
            event = await asyncio.wait_for(queue.get(), timeout=0.5)
            yield event
        except asyncio.TimeoutError:
            pass
        now = time.monotonic()
        # Early stop check — only after we have at least one solution.
        if (
            not early_stopped
            and cb.solution_count > 0
            and (now - cb.last_improvement_ts) >= NO_IMPROVEMENT_STOP_SEC
        ):
            solver.stop_search()
            early_stopped = True
            yield {
                "event": "progress",
                "data": {
                    "pct": cb.last_pct,
                    "message": f"No further improvement — accepting best roster ({cb.last_pct}% filled)",
                    "best_obj": cb._best,
                },
            }
        if now >= next_heartbeat:
            elapsed = int(now - start_ts)
            if cb.solution_count > 0:
                stagnant = int(now - cb.last_improvement_ts)
                msg = (
                    f"Optimizing — best {cb.last_pct}% filled "
                    f"({cb.last_covered}/{len(pairing_ids)}), {stagnant}s since last improvement"
                )
            else:
                msg = f"Searching for first legal roster — {elapsed}s / {request.time_limit_sec}s"
            yield {
                "event": "progress",
                "data": {
                    "pct": cb.last_pct,
                    "message": msg,
                    "best_obj": cb._best,
                },
            }
            next_heartbeat = now + heartbeat_interval

    status = await solver_future

    # Drain any remaining progress events
    while not queue.empty():
        yield queue.get_nowait()

    elapsed_ms = int((time.monotonic() - start_ts) * 1000)
    status_name = solver.status_name(status)

    # Always emit a one-line solver stats summary so we can read it from
    # server logs and track perf regressions. Independent of debug log flag.
    print(
        f"[solver] mode={'lns' if lns_mode else 'exact'} status={status_name} "
        f"elapsed_ms={elapsed_ms} branches={solver.NumBranches()} "
        f"conflicts={solver.NumConflicts()} booleans={solver.NumBooleans()}",
        flush=True,
    )

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for (ci, pi), var in x.items():
            if solver.value(var):
                assignments.append({"crewId": crew_ids[ci], "pairingId": pairing_ids[pi]})

        assigned_count = len(assignments)
        unassigned_count = len(pairing_ids) - assigned_count

        yield {
            "event": "solution",
            "data": {
                "assignments": assignments,
                "stats": {
                    "pairingsTotal": len(pairing_ids),
                    "crewTotal": len(crew_ids),
                    "assignedPairings": assigned_count,
                    "unassignedPairings": unassigned_count,
                    "durationMs": elapsed_ms,
                    "objectiveScore": int(solver.objective_value),
                    "solverStatus": status_name,
                },
            },
        }
    else:
        yield {
            "event": "error",
            "data": {
                "message": f"No feasible roster — solver ended {status_name} after {elapsed_ms / 1000:.1f}s",
            },
        }
