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


def _add_bool_lex_lesseq(
    model: cp_model.CpModel,
    a: list[cp_model.IntVar],
    b: list[cp_model.IntVar],
) -> None:
    """Enforce vector a <=_lex vector b for boolean (0/1) variables.

    Manual encoding for ortools 9.15, which exposes no add_lex_lesseq on
    CpModel. Walks the vectors once, carrying an `equal_so_far` boolean.
    At each index, if equal_so_far is true, require a[i] <= b[i]; then
    update equal_so_far := equal_so_far AND (a[i] == b[i]).
    """
    n = len(a)
    if n == 0 or n != len(b):
        return
    prev_eq: cp_model.IntVar | None = None  # None == constant True
    for i in range(n):
        ai, bi = a[i], b[i]
        if prev_eq is None:
            model.add(ai <= bi)
        else:
            model.add(ai <= bi).only_enforce_if(prev_eq)
        if i == n - 1:
            break
        same_i = model.new_bool_var("")
        model.add(ai == bi).only_enforce_if(same_i)
        model.add(ai != bi).only_enforce_if(~same_i)
        if prev_eq is None:
            prev_eq = same_i
        else:
            new_eq = model.new_bool_var("")
            model.add_bool_and([prev_eq, same_i]).only_enforce_if(new_eq)
            model.add_bool_or([~prev_eq, ~same_i]).only_enforce_if(~new_eq)
            prev_eq = new_eq


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

    # Budget guard: lex chain cost ≈ class_size × n_active_pairings booleans.
    # Above the budget the chain hurts more than it helps — CP-SAT spends all
    # its time satisfying lex order instead of finding good assignments. The
    # old `> 200 members` guard fired too late: a 125-crew class with 2000
    # pairings still pays 250k extra booleans. Switch to a work-product cap.
    SYM_WORK_BUDGET = 5000
    sym_class_count = 0
    sym_crew_count = 0
    sym_constraints_added = 0
    sym_classes_skipped_budget = 0
    for key, members in sym_classes.items():
        if len(members) < 2:
            continue
        members_sorted = sorted(members, key=lambda c: crew_ids[c])
        first_ci = members_sorted[0]
        pi_active = [pi for pi in range(n_pairings) if (first_ci, pi) in x]
        if not pi_active:
            continue
        # Skip classes whose lex-chain cost would dwarf the rest of the model.
        if len(members) * len(pi_active) > SYM_WORK_BUDGET:
            sym_classes_skipped_budget += 1
            continue
        sym_class_count += 1
        sym_crew_count += len(members)
        # Members of a class share the exact same allowed_set, so the set
        # of pairing indices with a decision var is identical for every
        # member. Iterate only those — zero-padding the vector would just
        # bloat the lex chain without changing semantics.
        vectors = [[x[(ci, pi)] for pi in pi_active] for ci in members_sorted]
        # ortools 9.15 has no native lex_lesseq on CpModel — encode the
        # boolean lex chain manually: prev <=lex curr iff at the first
        # differing index, prev=0 and curr=1.
        for prev_vec, curr_vec in zip(vectors, vectors[1:]):
            _add_bool_lex_lesseq(model, prev_vec, curr_vec)
            sym_constraints_added += 1
    print(
        f"[solver] symmetry-breaking: {sym_class_count} classes, "
        f"{sym_crew_count} total crew in classes >1, "
        f"{sym_constraints_added} constraints added "
        f"(skipped {sym_classes_skipped_budget} over budget)",
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
    #
    # Scale at 5000 (was 200) — at weight=5 the penalty is 25k per excess
    # day, ~2.5% of the COVERAGE_WEIGHT (1M). The previous 200 scale put
    # one excess duty-day at 1000 obj points = noise next to coverage,
    # leaving 6+ consecutive duty stretches when the planner had set
    # max=4. Higher scale gives the cap real teeth without making it
    # hard (a stretch is still legal if FDTL allows it; just costly).
    SOFT_CONSEC_WEIGHT_SCALE = 5000
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
    # BH-fairness encoding — convex piecewise penalty on |bh_i - mean|.
    # L1 sum-of-deviations (the prior version) was symmetry-invariant under
    # crew-to-crew pairing reassignment: shifting 6h from a crew at the mean
    # to a crew far from the mean costs the same on both sides, so the
    # solver had no gradient to fix outliers — left tail stayed long.
    # Convex piecewise penalty makes outlier crew strictly more expensive
    # per unit of deviation: lifting a crew from 25h toward the mean now
    # SAVES more obj points than dropping a near-mean crew by the same
    # amount loses, creating the gradient that pulls the distribution
    # closer to a normal shape.
    #
    # Bands (in minutes):
    #   0-10h  — base rate
    #   10-20h — 3× base
    #   20-30h — 8× base
    #   >30h   — 20× base + spread-cap soft hinge
    FAIRNESS_BASE_WEIGHT = 50
    FAIRNESS_BAND_WEIGHTS = [
        (10 * 60, 50),  # bucket 0-10h: weight 50/min
        (10 * 60, 150),  # bucket 10-20h: ADDITIONAL 150/min above 10h
        (10 * 60, 400),  # bucket 20-30h: ADDITIONAL 400/min above 20h
        (None, 1000),  # bucket 30h+: ADDITIONAL 1000/min above 30h
    ]
    SPREAD_HARD_PENALTY_WEIGHT = 100_000
    SPREAD_TARGET_MIN = 25 * 60  # 25h, in minutes — soft hinge above this
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

        # Sum-of-absolute-deviations from the period mean.
        # `mean_int` = floor(total_bh / n_crew). Total_bh varies with the
        # solver's coverage decisions (slack=1 → that pairing's bh excluded);
        # the mean adapts accordingly. Each `dev_i = |bh_i - mean_int|`.
        total_bh = model.new_int_var(0, 100_000 * n_crew, "total_bh")
        model.add(total_bh == sum(bh_per_crew))
        mean_int = model.new_int_var(0, 100_000, "bh_mean_int")
        # mean_int * n_crew <= total_bh < (mean_int + 1) * n_crew
        # Encode floor division as two non-strict integer inequalities
        # (CP-SAT doesn't support strict <). The +1/-1 shifts re-express
        # `<` and `>` as `<=` and `>=`.
        model.add(mean_int * n_crew <= total_bh)
        model.add((mean_int + 1) * n_crew >= total_bh + 1)

        # Per-crew band slack vars. Each band captures the deviation that
        # spills past the previous band's ceiling. Their sum equals dev_i,
        # but each band is weighted independently in the objective — band
        # k's weight is the *additional* per-minute cost above band k-1.
        # Effect: marginal cost of being far from the mean grows with how
        # far you already are, so the solver always prefers to fix the
        # furthest crew first.
        weighted_dev_terms: list = []
        for ci in range(n_crew):
            dev = model.new_int_var(0, 100_000, f"bh_dev_{ci}")
            model.add(dev >= bh_per_crew[ci] - mean_int)
            model.add(dev >= mean_int - bh_per_crew[ci])

            # Build band slack vars: b1 = max(0, dev - 0), b2 = max(0, dev - 10h),
            # b3 = max(0, dev - 20h), b4 = max(0, dev - 30h). Each weighted by
            # its band's *additional* per-minute weight.
            cumulative = 0
            for band_idx, (band_size_min, band_weight) in enumerate(FAIRNESS_BAND_WEIGHTS):
                band_var = model.new_int_var(0, 100_000, f"bh_dev_band{band_idx}_{ci}")
                model.add(band_var >= dev - cumulative)
                weighted_dev_terms.append(band_var * band_weight)
                if band_size_min is None:
                    break
                cumulative += band_size_min

        # Soft cap on the max-min spread above SPREAD_TARGET_MIN. Bigger
        # than any single band weight so the solver REALLY hates blowing
        # past the cap. Doesn't force infeasibility — structural outliers
        # (recent-qual / returning-from-leave crew that genuinely can't
        # match peers) still pay the cost but the model stays solvable.
        bh_max = model.new_int_var(0, 100_000, "bh_max")
        bh_min_var = model.new_int_var(0, 100_000, "bh_min")
        model.add_max_equality(bh_max, bh_per_crew)
        model.add_min_equality(bh_min_var, bh_per_crew)
        spread_excess = model.new_int_var(0, 100_000, "bh_spread_excess")
        model.add(spread_excess >= (bh_max - bh_min_var) - SPREAD_TARGET_MIN)
    else:
        weighted_dev_terms = []
        spread_excess = model.new_constant(0)

    # Objective: coverage >> spread-excess soft cap >> banded deviations.
    obj_terms = [s * COVERAGE_WEIGHT for s in slack]
    obj_terms.append(spread_excess * SPREAD_HARD_PENALTY_WEIGHT)
    obj_terms.extend(weighted_dev_terms)
    # Reference base weight to avoid lint complaints about unused name.
    _ = FAIRNESS_BASE_WEIGHT

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

    # ── Greedy warm-start hint ────────────────────────────────────────────
    # Without a hint CP-SAT begins from the all-zero solution (every pairing
    # unassigned). For exact-mode runs this means the first feasible solution
    # the solver finds is ~0% filled, then it spends 100s+ of search just to
    # nudge coverage up a few percent — by the time the no-improvement timer
    # fires, the run accepts a nearly-empty roster.
    #
    # Build a fast greedy roster (sort pairings by start, assign each to the
    # legal crew with lowest accumulated block hours that doesn't violate
    # rest or sibling-seat mutex) and feed it in as a CP-SAT hint. The solver
    # will use it as the starting point and improve from there. Hints are
    # advisory: if greedy violates any constraint the solver silently ignores
    # them. They never make the solution worse than no-hint.
    pairings_sorted = sorted(
        range(n_pairings),
        key=lambda pi: pairing_by_id[pairing_ids[pi]].start_utc_ms or 0,
    )
    # Per-crew state for greedy:
    greedy_intervals: dict[int, list[tuple[int, int]]] = {ci: [] for ci in range(len(crew_ids))}
    greedy_bh: dict[int, int] = {ci: 0 for ci in range(len(crew_ids))}
    greedy_parents: dict[int, set[str]] = {ci: set() for ci in range(len(crew_ids))}
    greedy_assignments: dict[int, int] = {}  # pi -> ci

    for pi in pairings_sorted:
        pid = pairing_ids[pi]
        p = pairing_by_id[pid]
        parent = p.parent_pairing_id or pid
        # Candidate crew: those with a decision var for this pairing.
        candidates = []
        for ci in range(len(crew_ids)):
            if (ci, pi) not in x:
                continue
            if parent in greedy_parents[ci]:
                continue
            # Rest check vs already-assigned intervals.
            ok = True
            if p.start_utc_ms > 0 and p.end_utc_ms > 0:
                for (a_start, a_end) in greedy_intervals[ci]:
                    if _windows_conflict(a_start, a_end, p.start_utc_ms, p.end_utc_ms, rest_min_ms):
                        ok = False
                        break
            if not ok:
                continue
            candidates.append(ci)
        if not candidates:
            continue
        # Pick least-loaded crew. Tie-break by lower ci for determinism.
        best_ci = min(candidates, key=lambda ci: (greedy_bh[ci], ci))
        greedy_assignments[pi] = best_ci
        greedy_bh[best_ci] += int(p.bh_min or 0)
        if p.start_utc_ms > 0 and p.end_utc_ms > 0:
            greedy_intervals[best_ci].append((p.start_utc_ms, p.end_utc_ms))
        greedy_parents[best_ci].add(parent)

    greedy_filled = len(greedy_assignments)
    print(
        f"[solver] greedy warm-start: {greedy_filled}/{n_pairings} pairings "
        f"({100 * greedy_filled // max(1, n_pairings)}%)",
        flush=True,
    )
    # Apply hints. For assigned (ci, pi): x=1, slack_pi=0. For unassigned
    # pairings: slack_pi=1. Non-hinted x vars remain free.
    for pi, ci in greedy_assignments.items():
        var = x.get((ci, pi))
        if var is not None:
            model.add_hint(var, 1)
        model.add_hint(slack[pi], 0)
    for pi in range(n_pairings):
        if pi not in greedy_assignments:
            model.add_hint(slack[pi], 1)

    # ── Solve with SSE progress callbacks ──────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(request.time_limit_sec)
    # Worker cap. CP-SAT scaling is sublinear past ~8 (portfolio search hits
    # diminishing returns); 24 workers destabilised ortools 9.15 on Windows +
    # Python 3.14 (native crash mid-run, no Python traceback). 16 is the
    # current ceiling — empirically faster than 8 on cockpit-scale problems
    # while staying under the silent-crash threshold.
    solver.parameters.num_workers = min(16, os.cpu_count() or 8)
    # Accept solutions within 5% of optimal — CP-SAT spends most of its time
    # chasing the last 1-2% with no operational benefit (rosters are equivalent
    # for crew). Pairs with the 20s no-improvement early stop below; first one
    # to fire wins. Cabin runs may override per request.
    solver.parameters.relative_gap_limit = (
        float(request.relative_gap_limit_override)
        if request.relative_gap_limit_override is not None and request.relative_gap_limit_override > 0
        else 0.05
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
        # Match the worker cap above so LNS doesn't sneak past 8.
        solver.parameters.num_search_workers = solver.parameters.num_workers

    start_ts = time.monotonic()

    class ProgressCallback(cp_model.CpSolverSolutionCallback):
        def __init__(self, queue: asyncio.Queue, slack_vars):
            super().__init__()
            self._queue = queue
            self._slack_vars = slack_vars
            self._best = None
            self.last_pct = 20
            self.last_covered = 0
            self.solution_count = 0
            self.last_improvement_ts = time.monotonic()
            self.full_coverage_ts: float | None = None

        def on_solution_callback(self):
            obj = int(self.objective_value)
            # Read slack vars directly — `obj // COVERAGE_WEIGHT` overshoots
            # because the objective also contains BH-fairness, gender, idle,
            # QoL, and soft-consec terms whose combined weight regularly
            # exceeds COVERAGE_WEIGHT, producing a negative `covered`.
            unassigned = sum(int(self.value(s)) for s in self._slack_vars)
            covered = len(pairing_ids) - unassigned
            # Allow 100 once fully covered — old min(99, ...) cap was a
            # progress-bar workaround that hid the operational milestone.
            pct = max(0, min(100, 100 - int(100 * unassigned / max(1, len(pairing_ids)))))
            improved = self._best is None or obj < self._best
            if improved:
                self.last_improvement_ts = time.monotonic()
            if unassigned == 0 and self.full_coverage_ts is None:
                self.full_coverage_ts = time.monotonic()
            self.last_pct = pct
            self.last_covered = covered
            self.solution_count += 1
            if pct >= 100:
                phase_label = "Polishing"
            elif pct >= 80:
                phase_label = "Refining"
            else:
                phase_label = "Building"
            event = {
                "event": "progress",
                "data": {
                    "pct": pct,
                    "message": f"{phase_label} · roster #{self.solution_count} improved · {covered}/{len(pairing_ids)} assigned ({pct}%)",
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
    cb = ProgressCallback(queue, slack)

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
    # Scale cutoff with problem size — a 142×2130 cockpit run needs more time
    # to escape local optima than a 30×400 toy run. Floor 20s, ceiling 180s.
    problem_size = len(crew_ids) * len(pairing_ids)
    NO_IMPROVEMENT_STOP_SEC = float(max(20, min(180, problem_size // 2000)))
    # Once 100% coverage reached, secondary terms (BH spread / idle / QoL)
    # produce only microscopic objective gains. Cap post-coverage grind to
    # this many seconds total — beyond that the roster is good enough.
    POST_COVERAGE_GRIND_SEC = 15.0
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
        # Post-coverage grind cap: once 100% coverage hit, give POST_COVERAGE_GRIND_SEC
        # for fairness polishing then stop. Solver otherwise hunts BH-spread
        # micro-improvements (sub-millisecond block hours moves) for minutes.
        if (
            not early_stopped
            and cb.full_coverage_ts is not None
            and (now - cb.full_coverage_ts) >= POST_COVERAGE_GRIND_SEC
        ):
            solver.stop_search()
            early_stopped = True
            yield {
                "event": "progress",
                "data": {
                    "pct": cb.last_pct,
                    "message": f"Locking in best roster · full coverage · fairness polish complete ({int(POST_COVERAGE_GRIND_SEC)}s)",
                    "best_obj": cb._best,
                },
            }
        # Early stop check — only after we have at least one solution.
        elif (
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
                    "message": f"Locking in best roster · {cb.last_pct}% coverage · stalled {int(NO_IMPROVEMENT_STOP_SEC)}s without gains",
                    "best_obj": cb._best,
                },
            }
        if now >= next_heartbeat:
            elapsed = int(now - start_ts)
            if cb.solution_count > 0:
                stagnant = int(now - cb.last_improvement_ts)
                if cb.full_coverage_ts is not None:
                    polish_idle = int(now - cb.full_coverage_ts)
                    msg = (
                        f"Polishing fairness · full coverage "
                        f"({cb.last_covered}/{len(pairing_ids)}) · "
                        f"{polish_idle}s of {int(POST_COVERAGE_GRIND_SEC)}s budget"
                    )
                elif cb.last_pct < 80:
                    msg = (
                        f"Building roster · {cb.last_covered}/{len(pairing_ids)} assigned "
                        f"({cb.last_pct}%) · last gain {stagnant}s ago"
                    )
                elif cb.last_pct < 100:
                    open_pos = len(pairing_ids) - cb.last_covered
                    duty_word = "duty" if open_pos == 1 else "duties"
                    msg = (
                        f"Refining · {cb.last_covered}/{len(pairing_ids)} assigned "
                        f"({cb.last_pct}%) · {open_pos} {duty_word} open · "
                        f"last gain {stagnant}s ago"
                    )
                else:
                    msg = (
                        f"Optimising cost · full coverage "
                        f"({cb.last_covered}/{len(pairing_ids)}) · "
                        f"last gain {stagnant}s ago"
                    )
            else:
                msg = f"Searching for first legal roster · {len(pairing_ids)} positions · {elapsed}s of {request.time_limit_sec}s"
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
