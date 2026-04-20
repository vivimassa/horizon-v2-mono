# SkyHub — Roadmap to the Intelligent Canvas

A realistic 10-month plan to ship the product that _feels like Iron Man_ but runs on keyboard, mouse, and voice — because that's what actually works for 12-hour ops shifts.

**Date drafted:** 19 April 2026
**Horizon:** May 2026 → March 2027 (Month 1 = May 2026)
**Target end state:** VietJet pilot in limited production, one conference-ready demo, agentic AI assistant handling 80% of common read queries and proposing recovery plans with human confirmation.

---

## 0. Vision

SkyHub in March 2027 is an airline operations platform where a duty manager can sit down at any workstation, say "why is OTP off today," get a grounded answer with inline recovery proposals, drag a flight bar on a 60fps canvas to preview a reassignment with live FDTL and cascade impact, and confirm changes with one keystroke. The world map on the ops wall shows live fleet movement. The Ask Bar is always one Cmd+K away. Every action is auditable, every tool call is logged, and the whole thing runs on one operator — VietJet — paying for access and referring the next two.

The "feel" is achieved through **fluidity, intelligence, and responsiveness**, not through hand gestures or AR headsets. Gestures are a conference booth demo. Production is a very, very well-designed workstation.

---

## 1. What this plan assumes

Assumptions that, if broken, force re-planning:

- **One primary developer** (you), with Professor reviewing and submitting patches on a rolling basis. A second senior developer is added at Month 4 or the timeline extends by 2–3 months.
- **VietJet remains the design partner** and provides access to real operational data, a duty manager for usability testing, and at least one decision-maker on a monthly cadence.
- **No simultaneous infrastructure migration** — NativeWind→Uniwind, multi-tenant silo migration, and the mobile v2 rewrite are deferred out of this window or run as strictly background tasks.
- **Budget for Claude API usage** of roughly $500–$2,000/month during dev, scaling to $2,000–$8,000/month per active operator in production. No fine-tuning in this window.
- **VietJet tolerates a scoped pilot** — limited modules in production with the rest staying in v1 or staged.

If any of these break, cut scope before cutting quality. The product is the moat; a broken v2 shipped on time is worse than a delayed v2 that works.

---

## 2. Guiding principles

These are the rules the roadmap enforces. Revisit them weekly.

1. **Read before write.** Every AI capability ships as a read first, then as a preview-and-confirm write, then as an agentic write. Never skip a phase.
2. **Data correctness blocks features.** If enrichment is missing, AI hallucinates. Fix data before building the feature that depends on it.
3. **Fluidity is a first-class deliverable.** 60fps direct manipulation, 200ms transitions, zero layout jank. Lump it with feature work, do not defer it to "polish phase."
4. **One visible reference customer beats six features.** Every roadmap decision asks: does this make VietJet's duty manager's shift better _next month_?
5. **Kill features, not quality.** If a week slips, cut scope in half — don't ship a half-working version of the full scope.
6. **Instrument everything from day one.** Latency, token spend, tool-call accuracy, fluidity FPS — if you don't measure it, it regresses silently.
7. **Ship to production every two weeks, even if internal-only.** The demo window closes forever the moment you go dark for a month.
8. **AI is a layer, not a destination.** The hub carousel never gets a seventh "AI" card. AI lives in three surfaces that overlay every module — a universal Ask Bar (Cmd+K), a persistent orb, and proactive notifications. Users don't go to AI; AI meets them wherever they are. See Section 3.5.

---

## 3. The seven tracks

Parallel workstreams that weave through the timeline. Not phases — tracks. A given week has activity on 2–3 tracks simultaneously.

| Track                             | What it produces                                                                 | Owner                   | Total effort               |
| --------------------------------- | -------------------------------------------------------------------------------- | ----------------------- | -------------------------- |
| A. Foundation cleanup             | Production-deployable web app, killed tech debt                                  | You (primary)           | ~3 weeks across months 1–2 |
| B. Crew Ops data + read surface   | Queryable crew model, FDTL state, pairings linked to flights                     | You (primary)           | ~6 weeks                   |
| C. Ground Ops data + read surface | Turnaround state, gate, load, ground delay attribution                           | You (primary)           | ~4 weeks                   |
| D. Canvas fluidity                | 60fps Gantt with direct manipulation and live previews                           | You + Professor patches | ~4 weeks                   |
| E. AI assistant (3 sub-phases)    | Ask Bar + orb + proactive notifications → preview-and-confirm → agentic recovery | You (primary)           | ~10 weeks                  |
| F. Motion + voice                 | Framer Motion transitions, proactive notifications, voice command palette        | You (primary)           | ~3 weeks                   |
| G. Conference theater             | Leap Motion + wall-display demo for booth                                        | You (side project)      | ~4 weeks                   |
| H. Commercial readiness           | Docs, sales deck, pricing, security posture, VietJet pilot contract              | You + VietJet           | Ongoing                    |

**Total effort if fully sequential:** ~34 weeks. With parallelism and realistic solo-dev pacing, the calendar time is ~40 weeks = ~10 months.

---

## 3.5 Where the AI lives — the three surfaces

Design anchor for Track E and Track F. No module competes with AI for a carousel card; AI lives in three surfaces that overlay every module.

### Surface 01 · Pull — The Universal Ask Bar

**Invocation:** `Cmd+K` from anywhere (web) / tap the orb (mobile). **Shape:** centered modal overlay. **Backdrop:** canvas dims to ~55% opacity with 4px blur, preserving spatial memory without competing for attention. **Input:** single text row + voice button + `Esc` to dismiss. **Response:** streams below the input as Claude's narrative, with inline flight cards, recovery proposals, Gantt slices rendered using existing SkyHub components. **Tool calls visible inline:** small shimmering status lines (`get_otp_snapshot · running…` → `✓ 72% vs 86% baseline`) build trust and aid debugging. **Exit:** `Esc` returns to work, `Enter` on a recovery option opens the preview-and-confirm flow (Surface 02 shares this preview with Surface 03).

**Design decision to make in Month 4:** center-modal vs. bottom-docked. Center-modal feels like a briefing ("stop and read"). Bottom-docked feels like a command palette ("type and continue"). Both work; each tunes the product for a different mental model. Default recommendation: center-modal — it matches ops briefing ergonomics and the canvas dim-and-focus pattern already established on the OCC Dashboard.

### Surface 02 · Ambient — The Persistent Orb

**Location:** fixed bottom-right, 48px diameter, pulsing animation (2.2s ease-in-out) in operator accent color. **Purpose:** discoverable entry point for users who haven't learned Cmd+K yet. **Behavior:** clicking opens the same Ask Bar modal as Cmd+K. One surface, two triggers. The orb also badges proactive notifications when the AI has something to say.

### Surface 03 · Push — Proactive Notifications

**Trigger:** server-side jobs watch for cascade formation, FDP risks, slot exceedance, weather impact, and maintenance conflicts. On detection, the server emits an event via SSE or WebSocket. **Shape:** toast from top-right, ~320px, 14px rounded corners, accent-tinted left edge. **Content:** one-line impact summary + "See N options" primary CTA + "Dismiss" secondary. **Click:** opens the Surface 02 preview directly (skipping the Ask Bar input) because the AI already knows the context. **Fatigue management:** max 3 concurrent toasts, auto-dismiss at 60s for non-critical, persistent for crew legality and cancellations. Per-user mute settings in Month 5.

### The unification point

Surfaces 01 and 03 both feed into the **same preview-and-confirm component** that handles manual Gantt drags. Whether a change originates from an AI suggestion, a proactive alert, or a user dragging a flight bar, the confirmation surface is identical — same impact strip, same before/after comparison, same audit log. This is the single most important architectural decision in Track E. Build the preview component in Month 6 as a shared module, not three times.

### What not to build

- **No chatbot sidebar.** It steals horizontal space from the canvas and forces sideways reading.
- **No seventh card in the hub carousel.** AI is not a destination.
- **No "AI Module" menu item in navigation.** No dropdown, no breadcrumb, no URL.
- **No avatar, persona, or name for the assistant.** Ops users want answers, not a relationship.
- **No wake word / always-listening voice.** Voice is triggered by Cmd+K + mic button, and only then.
- **No AR/VR surfaces in the 10-month window.** Conference booth only (Track G).

---

## 4. The timeline

Month-by-month breakdown. Each month has a **headline deliverable** — the thing you can demo at the end of that month. If the headline deliverable doesn't ship, the next month re-plans.

### Month 1 — Foundation + Crew schema (May 2026)

**Headline deliverable:** Clean production deployment of the existing app + first crew collection queryable via API.

**Track A (weeks 1–2):**

- Centralize API base URL into a single env-driven config. Replace all 72 `setApiBaseUrl('http://localhost:3002')` calls with a single `configureApi()` pattern that reads `NEXT_PUBLIC_API_URL`. Grep verify zero hardcodes remain.
- Write the production deployment: Dockerfile for Fastify, `vercel.json` for Next.js, `fly.toml` or `railway.toml` for the server. Seed a VietJet operator + one admin user in production MongoDB.
- Deploy to staging. Smoke test login, navigation, Gantt load with real VietJet data. Document the deploy procedure so Professor can also deploy.
- Refactor `getOperatorId()` to throw (not return `''`) when no operator is loaded. Fix the 5–10 call sites that break loudest first, then sweep the rest over the next two weeks as background.

**Track B (weeks 2–4):**

- Design the `crew_members`, `crew_qualifications`, `crew_duties`, `pairings` MongoDB collections with camelCase, `operatorId` first-indexed, `syncMeta.updatedAt` on each. Write Zod schemas per collection.
- Import VietJet's crew master data into `crew_members` (or seed with realistic fake data if real data access is pending).
- Build Fastify routes: `GET /crew`, `GET /crew/:id`, `GET /crew/:id/duties?from&to`, `GET /crew/:id/fdp-state`. Full tenant filtering. No UI yet — tested via Postman/curl.

**Exit criteria:**

- `curl https://api.prod/crew?operatorId=vietjet` returns real data over HTTPS.
- The web app is reachable at a real URL and VietJet can log in from their office.
- Zero `localhost:3002` strings in the codebase (`grep -r` returns nothing).

**Risks to call out this month:**

- VietJet crew data access may take 2–3 weeks of paperwork. Start the request on Day 1.
- MongoDB Atlas production cluster sizing — decide between M10 shared and M30 dedicated. M10 is fine for pilot.

---

### Month 2 — FDTL state + Crew reads in UI (June 2026)

**Headline deliverable:** A duty manager can click any crew member and see their 28-day duty history, current FDP state, and upcoming duties. Visually complete.

**Track B (weeks 5–7):**

- Build the FDTL state calculator: rolling 7-day block hours, 28-day, last duty end time, next duty start, days off compliance. Port the regulatory rules from your v1 Horizon FDTL engine — do not rewrite. CAAV VAR 15 first, EASA second.
- Nightly cron computes FDP state per crew member for all operators, caches to `crew_fdp_snapshots`. The AI will query this, not recompute on every call.
- UI: Crew Detail screen with duty history timeline, current FDP state card, qualifications list. Reuse glass panel components from Schedule Grid — do not design from scratch.

**Track C (week 8):**

- Design `turnaround_status`, `ground_delays`, `flight_load_summary` collections. Zod schemas, indexes.
- Populate from movement messages (ACARS where available, manual entry fallback) — even polling at 30s is fine for Month 2. Full MVT parsing comes in Month 3.

**Track A (background):**

- Continue `getOperatorId()` refactor. Target: 50% of call sites cleaned up by end of Month 2.

**Exit criteria:**

- VietJet duty manager opens crew detail screen and sees accurate FDP state for at least 10 real crew members.
- FDTL calculator matches v1 output for 50 test cases ported from v1.
- Ground ops schema is written and reviewable (not yet populated).

---

### Month 3 — Ground Ops reads + Canvas fluidity kickoff (July 2026)

**Headline deliverable:** Every turnaround in Movement Control shows live ground status. Canvas Gantt drags a flight bar at 60fps with visible preview.

**Track C (weeks 9–10):**

- Populate `turnaround_status` from flight_instances on every status change. Gate assignments, actual off/on blocks, ground delay codes.
- UI: Turnaround drawer on flight click in Movement Control — reuse the existing Flight Information dialog pattern.
- Build `GET /turnarounds`, `GET /turnarounds/:id`, `GET /ground-delays?station&date` Fastify routes.

**Track D (weeks 10–12):**

- Extract the Gantt canvas rendering into a clean drawing loop. Measure current FPS during a drag — likely 10–30fps given the monolith. Target is 60.
- Implement drag-preview: on mouse-down over a flight bar, spawn a ghost bar that follows the cursor. On hover over another aircraft row, compute and show the FDTL delta + cascade impact inline, in under 100ms.
- Use `requestAnimationFrame` for the drag loop. Move heavy computation off the main thread or pre-compute on flight load.

**Track H (background):**

- Draft the VietJet design partner agreement. Specify: production access to 1 module for 20 users, bug reporting cadence, monthly review meeting, logo usage rights.

**Exit criteria:**

- Movement Control shows live ground status for today's operation with latency under 60 seconds.
- Gantt drag-preview runs at 60fps on a MacBook Pro and at 30fps minimum on a mid-range Windows workstation.
- VietJet design partner agreement signed or in final review.

---

### Month 4 — AI assistant Phase 1: Read-only Ask Bar + Orb (August 2026)

**Headline deliverable:** Cmd+K opens the Ask Bar. The persistent orb pulses bottom-right. You can ask "why is OTP off today" and get a grounded briefing with inline flight cards. This ships Surface 01 and Surface 02 from Section 3.5.

**Design decision to settle in week 13 (before building):** center-modal vs. bottom-docked Ask Bar. Default recommendation is center-modal (matches ops briefing ergonomics and the OCC dim-and-focus pattern). Document the decision; do not re-open it mid-build.

**Track E (weeks 13–16):**

- Design the tool library. Write 15 tools, each a thin wrapper over existing Fastify routes. Start with the 10 highest-value reads (see Appendix). Write tool descriptions like technical documentation a new hire would read, not like JSDoc.
- Stand up an MCP server inside the monorepo (`services/assistant/`) exposing these tools. Reuse the Hermes Agent infrastructure already running — same patterns, new tools.
- Build the `/api/assistant/ask` Fastify route: accepts the user's message + conversation history, calls Claude Sonnet 4.6 with tool use enabled, loops tool calls until the model stops, streams the final text response. JWT provides the tenant ID — the LLM never sees it.
- **Build Surface 01 (Ask Bar):** centered modal overlay, `Cmd+K` to open, `Esc` to close. Canvas dims behind to ~55% with 4px blur. Streams tokens as they arrive. Shows tool calls inline as shimmering status lines that resolve to green check marks. Renders tool outputs using existing components (flight cards, Gantt slices, status chips).
- **Build Surface 02 (Orb):** fixed bottom-right floating button, 48px diameter, pulse animation (2.2s ease-in-out) in operator accent color. Clicking opens the same Ask Bar modal. One surface, two triggers.
- Write the eval harness: 50 golden queries with expected tool-call sequences and acceptance criteria for answers. Run them on every model/prompt change.

**Track A (finishing):**

- Complete `getOperatorId()` refactor. Zero call sites returning empty strings.

**Exit criteria:**

- 90% of the 50 golden queries pass the eval harness.
- Ask Bar + Orb demoed to VietJet duty manager, who asks 10 of their own questions and 7+ get useful answers.
- Cost per query averages under $0.05.
- No seventh card has been added to the hub carousel — Surfaces 01 and 02 are the entry points, period.

**This is Decision Gate 1.** If the Ask Bar doesn't feel magical in this demo, something fundamental is wrong — pause and redesign rather than push forward.

---

### Month 5 — Motion layer + Voice input (September 2026)

**Headline deliverable:** The product _feels_ different. Transitions everywhere, voice input to the Ask Bar, proactive notifications.

**Track F (weeks 17–20):**

- Install Framer Motion across the app. Standard transitions: 200ms ease-out for entries, 150ms ease-in for exits. Apply to all modals, dialogs, panels, screen transitions.
- **Build Surface 03 (Proactive notifications) — the third AI surface.** Backend: jobs watching for cascade formation, FDP risks, slot exceedance, maintenance conflicts; detected events emitted via SSE (or WebSocket if already shipped). Frontend: top-right toast, ~320px wide, 14px rounded corners, accent-tinted left edge. One-line impact summary ("VJ123 delay cascades to 4 flights — one creates FDP risk at 22:15") + "See N options" CTA + "Dismiss" secondary. Clicking CTA opens the preview directly (skips the Ask Bar input — the AI already knows the context). Max 3 concurrent toasts; auto-dismiss at 60s for non-critical, persistent for crew legality and cancellations. Per-user mute settings.
- Voice input into the Ask Bar: integrate Web Speech API for browser dictation. Voice commits the query when the user stops speaking for 700ms. No wake word, no always-listening — voice is triggered by Cmd+K + mic button in the Ask Bar.
- Dim-and-focus mode: during an active disruption, dim unrelated chrome by 40%, pulse the affected fleet bars gently. CSS filter + opacity. Simple but feels dramatic.

**Track E (continuing):**

- Ship 5 more read tools in response to eval harness failures from Month 4.
- Add conversation memory to the Ask Bar — follow-up questions work ("and from HAN?" after a SGN query).

**Exit criteria:**

- All three AI surfaces are live: Ask Bar (Cmd+K), Orb (bottom-right), Notifications (top-right).
- VietJet duty manager demos the product and says "this feels different."
- Voice input works on Chrome and Edge with >90% transcription accuracy on aviation terms.
- Proactive notifications fire on real disruptions with <30 second latency from event to toast.

---

### Month 6 — AI assistant Phase 2: Preview-and-confirm writes (October 2026)

**Headline deliverable:** The duty manager can say "reassign VN-A123 to VJ123" and see a full preview — impacted flights, FDTL deltas, cascade, cost — with a single-click confirm or cancel.

**Track E (weeks 21–24):**

- Define the write-tool contract: every write tool returns a `WritePreview` object — a list of intended changes, downstream impacts, regulatory flags, cost estimate. The LLM returns this to the user; the user must explicitly confirm.
- Build the `confirm_write(previewId)` endpoint: validates the preview is fresh (<60s old), runs the same RBAC the UI uses, executes atomically, returns an audit record.
- Build 6 write tools with previews: reassign aircraft, delay flight, swap crew, cancel flight, approve recovery option, publish scenario. Each previews through the same component shell.
- **Build the unified preview component — the single most important architectural decision in Track E.** Whether the change originates from Surface 01 (Ask Bar suggestion), Surface 03 (proactive notification CTA), or a manual Gantt drag, the confirmation UI is identical: same before/after comparison, same impact strip (downstream, revenue, pax reaccom, slot risk), same audit log entry format, same `Enter` to confirm. One component, three entry points.
- Audit log UI: every AI-initiated write appears in a filterable log with prompt, tool, parameters, result, user, timestamp, and rollback button.

**Track D (background):**

- Wire the Gantt drag-to-preview into the same preview component the AI uses. Prove the unification by landing a manual drag and an Ask Bar suggestion through the identical modal on the same day.

**Exit criteria:**

- 6 write tools ship with preview + confirm flow.
- Audit log shows every AI-initiated change with full context.
- Rollback works for at least the 3 most common writes.
- VietJet duty manager uses the preview flow for at least one real operational change.

**This is Decision Gate 2.** If writes are reliable here, you're now 80% of the way to production AI. If they're not — the previews are wrong, the confirms are slow, or the audit is messy — pause Phase 3 until this is rock solid.

---

### Month 7 — Conference theater + Wall-display mode (November 2026)

**Headline deliverable:** Booth-ready demo for World Aviation Festival (or your chosen conference). A wall-display mode in production.

**Track G (weeks 25–27):**

- Set up the conference booth rig: 75" 4K touch display + Leap Motion 2 controller + a Windows workstation. Budget ~$6K hardware.
- Build the gesture demo surface. Not production code — a standalone React app that reads Leap Motion hand data and lets a demo-goer "grab" a flight bar in midair, "drop" it on an aircraft, and see the recovery animate. Voice narration: "swap VJ123 to tail Alpha-123, show cascade." Playback lasts 90 seconds on a loop.
- The demo is theater. Do not attempt to make it a real product. It exists for photos, videos, and LinkedIn.

**Track D/F (weeks 27–28):**

- Wall-display mode: a new `/wall` route that shows the OCC Dashboard in glance-optimized form. Larger fonts (18px minimum for KPIs), higher contrast, auto-cycling between exception queues. Designed for 85" displays at 3–5 meter viewing distance.
- Pitch VietJet to mount a 65" display in their OCC with this view. Even one installed screen is a massive commercial asset.

**Track H:**

- Conference logistics: book booth, design banner graphics, print one-pager, prepare 3-minute demo script, line up 6 pre-scheduled meetings with target airline contacts.

**Exit criteria:**

- Booth demo runs continuously for 8 hours without crashing.
- Wall-display mode is installed in at least VietJet's OCC.
- 6 airline conversations booked for the conference.

---

### Month 8 — AI assistant Phase 3 kickoff: Agentic recovery (December 2026)

**Headline deliverable:** "Tech issue on VN-A123, propose recovery" returns 3 ranked recovery options with full cascade, cost, and regulatory analysis — each confirmable in one click.

**Track E (weeks 29–32):**

- Integrate the CG recovery solver as a tool: `propose_recovery(disruption, constraints)` returns 3 ranked options with full impact analysis.
- Wire the enrichment fields you've been deferring — `pax_count` from LOPA, `estimated_revenue` from fare data, `connecting_pax` from booking data, `is_priority` from the duty manager UI. The solver without these produces fiction; with them it produces gold.
- Build the multi-step agent loop: the LLM can now chain `get_disruption` → `get_affected_flights` → `get_crew_legality_impact` → `propose_recovery` → explain with narrative. Up to 8 tool calls per query. Timeout at 30 seconds.
- The recovery preview UI reuses the write-preview component from Month 6 but displays 3 options side-by-side for comparison.

**Track C (finishing):**

- Ground ops writes: gate reassignment, ground delay attribution, load status update. Less critical than flight/crew writes but round out the product.

**Exit criteria:**

- Recovery query returns 3 ranked options in under 15 seconds on a disruption with 12+ affected flights.
- Options are meaningfully different (not slight variations) — validated by VietJet duty manager.
- One real VietJet disruption is resolved using an AI-proposed plan (with human confirm) in a controlled pilot.

---

### Month 9 — VietJet pilot launch + stability (January 2027)

**Headline deliverable:** 20 VietJet users in production, running real shifts with SkyHub handling at least one module as primary tool.

**Track H (weeks 33–36):**

- Pilot scope negotiation with VietJet: pick 1–2 modules (recommend Movement Control + Ask Bar) where SkyHub is the primary tool, rest stays on v1 or incumbent.
- User training: 3 sessions for VietJet duty managers. Record them. Build a Help Center with video walkthroughs.
- Monitoring: uptime SLO of 99.5% for the pilot, latency p95 under 2s, AI answer accuracy spot-checked weekly.
- Daily standup with VietJet pilot users for the first 2 weeks. Fix every reported bug within 48h. This period decides whether the reference customer sticks.

**Track E (ongoing):**

- Add tools in response to real user queries that fail. Expect 20–30 new tools across the pilot as the edge cases surface.

**Track A/D (ongoing):**

- Triage and fix the performance and polish issues that surface under real load. God components get refactored (cap: 400 lines each). The 831-line `activity-code-detail.tsx`, 822-line `tail-optimizer.ts`, 860-line `gantt.ts` server route — break them down as they cause real issues, not preemptively.

**Exit criteria:**

- 20 VietJet users active daily.
- 99.5% uptime for 30 days.
- At least 1 testimonial from VietJet (written or video) for commercial use.

**This is Decision Gate 3.** VietJet's ongoing usage confirms product-market fit. If they're not actually using it after 30 days, something fundamental is wrong with the fit — stop feature work and diagnose.

---

### Month 10 — Commercial readiness + second customer (February 2027)

**Headline deliverable:** Second design partner signed. Sales motion running. Pricing published.

**Track H:**

- Sales collateral: landing page, case study (VietJet), pricing one-pager, security whitepaper, demo video (60s, 3min, 10min versions).
- Outreach: LinkedIn activity, 20 direct airline contacts from SE Asia LCCs, 2 conference appearances scheduled.
- Pricing model published: per-aircraft + per-user tiers, with AI token budgets.
- Security posture: SOC 2 Type 1 kickoff, MongoDB encryption at rest, Cloudflare in front of public endpoints, secrets in Doppler, audit logs on every write. SOC 2 Type 2 is a 2027 project but Type 1 is achievable in this window.

**Track E:**

- Per-operator AI budget UI: token spend visible to the airline admin, per-user limits configurable.

**Track D/F:**

- Final fluidity polish. Run a frame-by-frame QA pass on every major flow. If anything jitters, drops frames, or has awkward timing, fix it.

**Exit criteria:**

- Second airline in active pilot discussion (LOI or signed design partner agreement).
- Pricing live on a public page or private deck.
- SOC 2 Type 1 auditor engaged.

---

## 5. Decision gates

Three hard gates where the plan can pivot or re-plan:

**Gate 1 — End of Month 4.** Does the Ask Bar feel magical to a VietJet duty manager? If no, pause Phase 2 and redesign. If yes, proceed.

**Gate 2 — End of Month 6.** Do preview-and-confirm writes work reliably? Audit logs clean? Rollback working? If no, extend 1 month. If yes, proceed to agentic recovery.

**Gate 3 — End of Month 9.** Are VietJet users actually using SkyHub daily after the pilot launch? If no, stop feature work and diagnose fit. If yes, go commercial.

No other scope cuts mid-month without explicit re-planning. Pressure from other places (investors, conferences, shiny new models) does not move the gates.

### Design decisions to lock before their phase begins

These are smaller than gates — they don't pivot the plan, but they must be settled before build starts on the dependent phase. Document each in a short ADR in the repo.

| Decision                                           | Deadline                   | Default                                                                           | Notes                                                           |
| -------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Ask Bar form factor — center-modal vs. bottom-dock | Week 13 (start of Month 4) | Center-modal                                                                      | Mocked and reviewed. Changing after build is a 1-week refactor. |
| Orb position — bottom-right vs. top-right          | Week 13                    | Bottom-right                                                                      | Avoids conflict with Surface 03 toasts which live top-right.    |
| Notification toast fatigue rules                   | Week 17                    | Max 3 concurrent, auto-dismiss 60s non-critical, persistent for FDP/cancellations | Review weekly during Month 5 with VietJet duty manager.         |
| Unified preview component contract                 | Week 21                    | Single `WritePreview` shape shared by AI and manual drags                         | Non-negotiable. If scope pressure tempts a split, say no.       |
| Voice trigger behavior                             | Week 18                    | Cmd+K + mic button, commit on 700ms silence                                       | No wake word, no always-listening.                              |

---

## 6. Daily and weekly cadence

**Daily:**

- 90 minutes of deep work on the hardest problem before 10 AM.
- Afternoon blocks for integration, review, Claude Code prompts, meetings.
- End of day: 15 min log in HORIZON_PROJECT_STATE.md — what shipped, what blocked, what's next.

**Weekly:**

- Monday: re-read this roadmap, mark progress, adjust the week's plan.
- Wednesday: VietJet sync (even if async — an email counts).
- Friday: demo the week's work to yourself. Record a 2-minute video. These videos become your marketing material at zero extra cost.

**Monthly:**

- Revisit assumptions (Section 1). Any broken? Re-plan.
- Review the 50 golden queries. Any broken? Fix.
- Check token spend + latency + FPS metrics. Any regressing? Fix before adding features.
- VietJet monthly review meeting with decision-maker.

---

## 7. Stop-doing list

Explicit decisions to NOT do in this window:

1. **No NativeWind → Uniwind migration.** Ship on NativeWind. Migration is a 2027 project.
2. **No full multi-tenant silo migration.** `operatorId` filtering is sufficient for 2 customers. Silo is a Q3 2027 project.
3. **No mobile v2 Expo rewrite.** Web-first for the pilot. Mobile is a separate product workstream starting after Month 10.
4. **No custom ML model training.** The CG solver stays as-is. LightGBM stays as-is. No fine-tuning Claude. No new ML features.
5. **No Horizon Message Hub.** Deferred. Manual XML upload/download is the pilot posture. Message Hub is 2027.
6. **No full AMOS integration.** MVP = manual XML import. Real AMOS adapter is 2027.
7. **No VR/AR development.** Leap Motion booth demo only. Vision Pro app is 2028 if ever.
8. **No new modules beyond what's already scoped.** No booking platform, no passenger app, no loyalty module. Vihat (colleague's booking platform) is a separate monorepo fork.
9. **No recurring consultancy engagements.** Every hour sold is an hour not building. Only do consultancy that leads directly to a SkyHub pilot.
10. **No over-engineering component extraction.** Sprint 3 component library work is useful but can run as background over 3 months — do not block features for it.
11. **No seventh card in the hub carousel for AI.** AI is not a destination. It lives in Surfaces 01, 02, and 03 per Section 3.5. If anyone asks "where's the AI module," the answer is "Cmd+K from here."
12. **No chatbot sidebar.** It competes with the canvas for horizontal space and trains users in the wrong mental model. The center-modal Ask Bar is the only text-first AI surface.
13. **No AI avatar, persona, mascot, or name.** Ops users want answers, not a relationship. The orb is an entry point, not a character.
14. **No always-listening voice / wake word.** Voice activates only when the user explicitly triggers it from inside the Ask Bar. Security, privacy, and trust all land on this rule.

---

## 8. Risks and mitigations

| Risk                                                               | Likelihood | Impact   | Mitigation                                                                                                                                                   |
| ------------------------------------------------------------------ | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Solo-dev velocity slips                                            | High       | High     | Add second senior dev at Month 4 if Month 3 is >2 weeks behind. Extend timeline rather than cut quality.                                                     |
| VietJet pulls back or deprioritizes                                | Medium     | Critical | Keep second design partner warm from Month 6 onward. Don't concentrate all risk on VietJet.                                                                  |
| AI hallucinations damage trust                                     | Medium     | Critical | Eval harness mandatory. Read-before-write principle non-negotiable. Audit log + rollback on every write.                                                     |
| Token costs exceed projections                                     | Medium     | Medium   | Per-operator budgets, 60s tool-call caching, monitor daily. If a query pattern spikes cost, fix the tool, not the model.                                     |
| CG solver enrichment reveals deeper data gaps                      | Medium     | Medium   | Start enrichment in Month 1 via manual data scrub if needed. Do not wait for perfect data.                                                                   |
| Canvas performance on mid-tier Windows workstations below 30fps    | Medium     | High     | Test on VietJet's actual hardware in Month 3. If below 30fps, simplify render — fewer effects, more virtualization — before adding features.                 |
| Conference slot doesn't materialize                                | Low        | Low      | Book 2 conferences at once. If one falls through, the other stands.                                                                                          |
| Anthropic API outage during demo or pilot                          | Low        | Medium   | Graceful degradation — "AI temporarily unavailable, use manual tools." Never let AI be a hard dependency for core ops.                                       |
| Regulatory concern from VietJet compliance (data residency, audit) | Medium     | Medium   | Security whitepaper in Month 10. Start conversations Month 2. SOC 2 Type 1 by Month 12.                                                                      |
| Burnout                                                            | High       | Critical | Actual non-negotiable days off. The 10-month plan assumes sustainable pace, not hero mode. Hero mode shipping Month 6 means nothing if you crash in Month 8. |

---

## 9. Metrics to track

Weekly dashboard. If you don't measure it, it regresses silently.

**Engineering health:**

- Lines of code (informational, not a goal).
- Files over 400 lines (goal: monotonic decrease after Month 3).
- `localhost:3002` hardcodes remaining (goal: 0 by end of Month 1).
- Eval harness pass rate (goal: 90%+ from Month 5 onward).

**Performance:**

- Gantt drag FPS (goal: 60 on dev hardware, 30 on VietJet hardware).
- API p95 latency (goal: <500ms).
- Ask Bar query latency p95 (goal: <3s first token, <8s complete).

**AI quality:**

- Eval pass rate per tool (goal: 95%+ on read tools, 99%+ on write tools).
- Token spend per query (goal: stable under $0.05 avg, $0.15 p95).
- Tool-call accuracy (did the LLM pick the right tool?) (goal: 95%+).

**Product:**

- VietJet daily active users (goal: 20 by Month 9).
- AI queries per user per day (goal: 10+ by Month 9).
- AI-proposed writes confirmed (goal: >50% confirm rate by Month 8).

**Commercial:**

- Design partner conversations in flight (goal: 5+ by Month 10).
- Conference meetings booked (goal: 6+ at conference in Month 7).

---

## 10. Appendix: First 20 AI tools

The tool library is the product. These 20 tools, each ~30–80 lines of Fastify wrapper + a clear description, get you through Phase 1 and Phase 2.

**Flight & schedule reads:**

1. `get_flight(flightNumber, date)` — single flight detail
2. `list_flights(filters)` — flights by date/airport/fleet/status
3. `get_otp_snapshot(date)` — OTP rolling and daily
4. `get_delay_causes(date, stationFilter?)` — delay code breakdown
5. `get_cascade_analysis(flightId)` — downstream impact of a delay

**Aircraft & maintenance reads:** 6. `get_aircraft(registration)` — tail detail + current assignment 7. `list_aircraft_availability(date)` — available vs AOG vs maintenance 8. `get_maintenance_due(withinDays)` — upcoming checks 9. `get_tail_routing(registration, date)` — today's and tomorrow's legs

**Crew reads:** 10. `get_crew(crewId)` — profile + qualifications 11. `get_crew_duties(crewId, fromDate, toDate)` — duty history 12. `get_crew_fdp_state(crewId)` — current FDP rolling windows 13. `list_crew_legality_risks(date)` — crew approaching FDTL limits 14. `get_pairing(pairingId)` — full pairing breakdown

**Ground ops reads:** 15. `get_turnaround(flightId)` — current turn state 16. `list_ground_delays(date, station?)` — today's ground delay attribution 17. `get_load_summary(flightId)` — pax + cargo + fuel progress

**Disruption & recovery:** 18. `list_active_disruptions()` — current disruption events 19. `get_disruption_context(disruptionId)` — full context with affected flights, crew, passengers 20. `propose_recovery(disruptionId, constraints?)` — calls CG solver, returns 3 ranked options

Tool descriptions for each should be 3–6 sentences explaining _when to use it_, not just what it returns. The LLM picks tools based on descriptions; bad descriptions are the #1 cause of wrong tool calls.

Write tools ship in Phase 2 — 6 of them: `reassign_aircraft`, `delay_flight`, `swap_crew`, `cancel_flight`, `approve_recovery_option`, `publish_scenario`. Each returns a `WritePreview` object; actual execution happens via `confirm_write(previewId)` after user confirmation.

---

## 11. The one-sentence summary

Ten months from now, a VietJet duty manager sits down at a workstation, hits `Cmd+K`, says "why is OTP off today," sees a grounded briefing with three recovery options in under ten seconds, drags a flight bar to preview a swap at 60fps through the same confirmation surface the AI uses, and commits the change with one keystroke — while the proactive notification that already predicted this cascade sits quietly dismissed in the top-right corner, and the entire interaction is logged, reversible, and running in production under 20 active users from one airline paying for access.

The AI never got a card. It got a layer.

Everything in this roadmap exists to make that sentence true.

---

_Living document. Update after every monthly review. When reality diverges from plan — and it will — update the plan, don't ignore the reality._
