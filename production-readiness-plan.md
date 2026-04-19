# SkyHub — Production Readiness Plan

**Date drafted:** 19 April 2026
**Status:** Scoping complete. No further execution today.
**Primary author:** solo dev (you) + Professor patches
**Target reader:** future-you, coming back to this fresh

## Companion documents

- `skyhub-intelligent-canvas-roadmap.md` — the 10-month product roadmap (May 2026 → March 2027). The "what." This doc is the "how it actually ships."
- `infrastructure-hardening-plan.md` — older 7-sprint dev hygiene backlog. Sprints 1–6 are largely done (ESLint, `@skyhub/env`, shared UI, JWT auth, React Query, nav shell). Sprint 7 (GitHub Actions CI + EAS) is not done and folds into this plan's Phase A.
- `CLAUDE.md` — design system + behavioral contract. Do not violate.

## 0. Purpose

This plan bridges the canvas roadmap's Month 1 Track A ("Foundation cleanup") with the long-term infrastructure posture needed to serve a flag-carrier-scale operator (100 aircraft, 12,000 crew). It exists because the roadmap treats production deploy as a week of work and the reality is closer to two weeks, across three phases.

The rule for this document: **every bullet is either a to-do item or a decision record.** No aspiration, no vision-stating. If a bullet doesn't survive that test, delete it.

---

## 1. Status snapshot (2026-04-19)

| Track A item                                                                         | Status          | Notes                                      |
| ------------------------------------------------------------------------------------ | --------------- | ------------------------------------------ |
| Item 1 — Centralize API base URL                                                     | **Done**        | Committed 2026-04-19 (see §2)              |
| Item 2 — Production deployment                                                       | **Not started** | Phase A of this plan                       |
| Item 3 — `getOperatorId()` refactor                                                  | **Not started** | Phase B Stage 1 of this plan               |
| Hardening-plan Sprint 7 — GitHub Actions CI                                          | **Not started** | Folds into Phase A                         |
| Path-param RBAC hardening (flagged in `server/src/middleware/authenticate.ts:73–75`) | **Not started** | Phase B Stage 2                            |
| Background-job leader election (worker split)                                        | **Not started** | Phase B Stage 3                            |
| Uploads → object storage                                                             | **Not started** | Phase A (ship-blocker at horizontal scale) |

**Net position:** we've fixed the code-level deploy blocker. We have not yet built anything that lets the code actually run in production.

---

## 2. What's done — Pattern 1 (localhost:3002)

### Problem

64 occurrences of `setApiBaseUrl('http://localhost:3002')` across 28 web files + 2 stores. Each hardcode **overwrote** the correct env-driven bootstrap at module import time, meaning a deployed build would pin every `@skyhub/api` call to `localhost:3002` in the user's browser. Login would work (it uses a different code path) but ~90% of features would fail.

### Fix shape

- `packages/api/src/client.ts:6-22` — client default now reads `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL` at module init (belt-and-suspenders, in case a module imports `api` before the startup bootstrap runs).
- 28 web files: deleted `setApiBaseUrl('http://localhost:3002')` calls and removed `setApiBaseUrl` from imports.
- 1 half-fix normalized: `apps/web/src/components/admin/non-crew-people/non-crew-people-shell.tsx` (had `setApiBaseUrl(process.env... || localhost)` inline — deleted; bootstrap handles it).
- 3 Category C bugs fixed (hardcoded URLs used as string values, no env fallback):
  - `apps/web/src/components/admin/aircraft-registrations/aircraft-registration-detail.tsx:989` — image src → `getApiBaseUrl()`
  - `apps/web/src/app/settings/admin/operator-config/page.tsx:500` — logo src → `getApiBaseUrl()`
  - `apps/mobile/app/(tabs)/network/schedule-grid.tsx:679` — `apiBaseUrl` prop → `getApiBaseUrl()`

### Verification posture

- `@skyhub/api` package typechecks clean.
- Web app typecheck: 37 errors pre-edit, 37 errors post-edit. Zero new errors introduced. The 37 are pre-existing issues in palette unions, slot-toolbar, codeshare mappings-tab — unrelated.
- Remaining `setApiBaseUrl` calls in `apps/**`: exactly 2, both correct startup bootstraps (`apps/web/src/lib/env.ts`, `apps/mobile/utils/api-url.ts`).

### What's _not_ touched deliberately

Nine files still use the pattern `const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'`:

- `apps/web/src/lib/api.ts`, `authed-fetch.ts`, `world-map/api.ts`, `gantt/api.ts`
- `apps/web/src/stores/use-status-board-store.ts`
- `apps/web/src/components/auth-provider.tsx`
- `apps/web/src/app/settings/account/profile/page.tsx` (2 occurrences)
- `apps/web/src/components/admin/non-crew-people/non-crew-people-list.tsx`
- `apps/web/src/components/network/gantt/flight-information/jumpseater-dialog.tsx`

These work correctly in production (env read, localhost is only a dev fallback). Consolidating into `getApiBaseUrl()` is polish, not a blocker. **Track as "cleanup task" for Phase C.**

### Deploy env vars required

Setting these is a prerequisite for the bootstrap to resolve to the real URL:

```bash
# Web (Vercel)
NEXT_PUBLIC_API_URL=https://api.skyhub.example

# Mobile (EAS build)
EXPO_PUBLIC_API_URL=https://api.skyhub.example
```

Both are validated at boot by `@skyhub/env/client`. If missing, Zod throws — fail fast instead of silent localhost.

---

## 3. What's not done — phased by blocker severity

Three phases. **Each phase gates the next.**

### Phase A — Minimum Viable Deploy (2–3 days focused, 4–5 days realistic)

Everything required for the app to actually run at a real URL. No airline users yet — this is for internal demo and smoke-testing.

### Phase B — Pre-pilot hardening (1–2 weeks)

Everything required before any real airline user (even VietJet duty manager in design-partner scope) touches prod. Correctness bugs, tenant isolation gaps, operational hazards.

### Phase C — Scale-ready architecture (ongoing)

Everything required before the second airline signs on, or before AI write tools ship (Month 6). Shapes the system for 100-aircraft / 12k-crew workloads.

---

## 4. Phase A — Minimum Viable Deploy

**Definition of done:** deployed URL serves the full app. Duty manager in VietJet's office can log in, see the schedule grid, open the gantt, navigate every major screen. Zero production-breaking errors in the console. Errors go to Sentry. CI gates PRs.

### A.1 — Fastify server, deployable (4–6 hours)

Current state: `server/src/index.ts` is a single-process monolith with 3 background jobs running in the API process. `server/package.json` builds with `tsc` → `dist/index.js`. No Dockerfile, no `/health` depth, no graceful shutdown.

Tasks:

- [ ] Write `server/Dockerfile` — Node 22 slim, non-root user, multi-stage build, `COPY . && pnpm install --frozen-lockfile && pnpm build`, final stage copies only `dist/` + `node_modules` + `package.json`, entry `node dist/index.js`
- [ ] Add `server/.dockerignore` — exclude `node_modules`, `.env*`, `uploads/`, `dist/`, `*.md`
- [ ] Deepen `/health` handler in `server/src/index.ts:86` — ping MongoDB (`mongoose.connection.readyState === 1`), optionally Redis later. Return 503 on degraded state.
- [ ] Wire graceful shutdown — `process.on('SIGTERM', () => app.close())`. Fastify closes listeners and drains in-flight requests.
- [ ] Guard in-process cron jobs with `ENABLE_CRONS` env flag (default false in prod API, true on worker service in Phase B). Touches `server/src/index.ts:128-208`.
- [ ] Tighten CORS — change `@skyhub/env/server` to require `CORS_ORIGIN` in production (current default `'*'` is dev-only).
- [ ] Remove `@supabase/supabase-js` from `server/package.json` — legacy from migration, unused.

### A.2 — Object storage (3–4 hours)

Current state: uploads stored on local disk (`server/uploads/`), served via `@fastify/static` at `/uploads/` prefix. This **cannot horizontally scale** — a file uploaded to instance A won't be visible from instance B. Multi-container deploy breaks avatar and aircraft-image display.

Tasks:

- [ ] Provision Cloudflare R2 bucket `skyhub-uploads-prod` (S3-compatible, zero egress fees, cheaper than S3)
- [ ] Add `@aws-sdk/client-s3` to `server/package.json` (R2 is S3-compatible)
- [ ] Add env vars: `STORAGE_PROVIDER` (`local` | `r2`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- [ ] Create `server/src/storage/adapter.ts` — `StorageAdapter` interface with `put()`, `get()`, `delete()`, `getUrl()`. Two implementations: `LocalAdapter` (wraps `fs`) and `R2Adapter` (wraps S3 SDK).
- [ ] Update upload routes — `users.ts` (avatar), `aircraft-registrations` image, operator logo. Currently they `fs.writeFileSync(uploadsDir, ...)`.
- [ ] Update display sites — the 5 files that build `${getApiBaseUrl()}${imagePath}` URLs. For R2, swap to `adapter.getUrl(key)` which returns a signed URL or a public CDN URL.
- [ ] Keep `@fastify/static` as a dev-only fallback when `STORAGE_PROVIDER=local`.

### A.3 — MongoDB Atlas (2 hours)

Tasks:

- [ ] Provision Atlas cluster — **M20 dedicated, Singapore region (`ap-southeast-1`)**. M10 shared is dev-only, M30 is overkill for pilot.
- [ ] Enable continuous cloud backups + point-in-time recovery (not available on M10; comes free on M20+).
- [ ] Create database user `skyhub-api` with `readWrite` on `skyhub` database only. No admin roles.
- [ ] Whitelist the Fastify host's IP (Fly.io/Render provide stable egress IPs; or use 0.0.0.0/0 + strong credentials if static IPs aren't available — acceptable tradeoff for pilot).
- [ ] Seed production data: run `pnpm seed` equivalent against prod MongoDB — creates VietJet operator + 1 admin user.
- [ ] Rotate `JWT_SECRET` — generate a new 64-char secret (not the dev one). Store in hosting provider secrets, not `.env`.

### A.4 — Hosting — Vercel + Fly.io (3–4 hours)

**Decision: Vercel for `apps/web`, Fly.io for `server`.** See §7.1 for rationale.

Tasks:

- [ ] Create Vercel project for `apps/web`. Point to monorepo root with `apps/web` as the app directory. Vercel auto-detects Next.js.
- [ ] Configure Vercel env vars: `NEXT_PUBLIC_API_URL=https://api.skyhub.example`. Mark as exposed for all environments.
- [ ] Create Fly.io app `skyhub-api-prod`. Region `sin` (Singapore, matches Atlas).
- [ ] Write `server/fly.toml` — 1 machine (shared-cpu-2x, 4GB RAM) for pilot, autoscale min 1 max 3. Internal port 3002. Mount no volume (uploads go to R2 after A.2). Health check → `/health`, 15s interval.
- [ ] Configure Fly.io secrets: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN=https://app.skyhub.example`, R2 credentials, any other per-schema env.
- [ ] Deploy both. Verify end-to-end login flow against the real URL.

### A.5 — Domains, SSL, CDN (1–2 hours)

Tasks:

- [ ] Register `skyhub.example` (or whatever the chosen domain is — confirm before buying).
- [ ] DNS records:
  - `app.skyhub.example` → Vercel CNAME
  - `api.skyhub.example` → Fly.io (via Fly's certificate + CNAME)
  - `assets.skyhub.example` → Cloudflare R2 public bucket (optional, for direct image serving)
- [ ] Cloudflare in front of everything. Proxy ON for DDoS + WAF.
- [ ] SSL: Vercel auto-provisions, Fly.io auto-provisions via Let's Encrypt on custom domain attach.

### A.6 — Observability (1–2 hours)

Tasks:

- [ ] Sentry project for `apps/web` — install `@sentry/nextjs`, wire with DSN from env. Source maps uploaded on deploy.
- [ ] Sentry project for `server` — install `@sentry/node`, wire as Fastify plugin. Tag errors with `operatorId` (from JWT) and `route`.
- [ ] Grafana Cloud free tier — ship Fly.io logs via the Grafana Cloud log drain. Fastify's `pino` JSON logs are already structured; parse by Loki out of the box.
- [ ] No APM/tracing yet. Defer until Phase C when concurrent users justify it.

### A.7 — CI/CD (2–3 hours)

Folds in hardening-plan Sprint 7. Current state: no `.github/workflows/` directory.

Tasks:

- [ ] `.github/workflows/ci.yml` — on PR: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (if tests exist). No deploy on PR.
- [ ] `.github/workflows/deploy.yml` — on push to `main`: deploy web (Vercel auto-deploys from Git), deploy server (`flyctl deploy` from workflow). Require manual approval for prod via GitHub Environments.
- [ ] Branch protection on `main`: require CI pass + 1 review (even if you review yourself, forces the discipline).
- [ ] Skip EAS Build config for mobile in Phase A. Mobile pilot is Month 9 per canvas roadmap; we have 5 months of runway.

### A.8 — Smoke test on deployed URL (2 hours)

Not optional. Must be exercised before declaring Phase A done.

Tasks:

- [ ] Log in from a fresh browser to `https://app.skyhub.example`. Use the seeded admin user.
- [ ] Navigate every tab: Home, Network, Flight Ops, Ground Ops, Crew Ops, Settings.
- [ ] Open schedule grid — loads flight patterns from real Mongo.
- [ ] Open a gantt view — renders with real flight instances.
- [ ] Open an admin shell (e.g., Aircraft Registrations) — CRUD works.
- [ ] Upload an avatar — file lands in R2, displays correctly after reload.
- [ ] Log out, log back in — session persists across tabs, refresh is silent.
- [ ] Watch Sentry + server logs during the test. Zero errors expected.

### Phase A exit criteria

- [ ] Deployed URL is live and authentication works
- [ ] All 6 tabs render without console errors
- [ ] An admin CRUD round-trip works (create, read, update, delete)
- [ ] An image upload works and survives a container restart
- [ ] CI blocks bad PRs
- [ ] Sentry receives at least one deliberate test error and displays it

---

## 5. Phase B — Pre-pilot hardening

**Definition of done:** a VietJet duty manager can use the deployed app for a full shift without encountering a tenant isolation bug, a double-send of an MVT message, or an ops-breaking race condition.

**Gating rule:** do not invite the design partner to use prod until Phase B is complete.

### B.1 — `getOperatorId()` Stage 1 (1–2 days)

The 180 occurrences in 67 files are not going away, but the **silent-empty-string fallback** is. Today's server-side safety net (`server/src/middleware/authenticate.ts:76-95`) overwrites query/body `operatorId` with the JWT value, so the current `?? ''` is mostly cosmetic. But two gaps remain:

- Path-param routes don't go through the overwrite (B.2).
- Operator-loading race causes first-render flicker in admin shells.

Tasks:

- [ ] Change `apps/web/src/stores/use-operator-store.ts:59` — make `getOperatorId()` throw if operator not loaded. No `?? ''`.
- [ ] Add `loaded` precondition to every Zustand store's `load()` action: `if (!useOperatorStore.getState().loaded) return`. ~10 shells touched.
- [ ] Gate shell-level render on `useOperatorStore((s) => s.loaded)` — one line per shell that mounts master-data fetches. ~10 shells.
- [ ] Do NOT touch the 180 call sites. They keep their `getOperatorId()` calls — the function just no longer lies when it's called before bootstrap.

Risk: low. Rollback is trivial if any shell breaks.

### B.2 — Path-param RBAC sweep (1 week)

`server/src/middleware/authenticate.ts:73-75` explicitly flags this as a follow-up: path params like `/fdtl/schemes/:operatorId` are NOT overwritten from JWT. A caller with a valid JWT can hit any operator's path-param routes.

Tasks:

- [ ] Grep all routes for `:operatorId` path params. Likely candidates: `fdtl.ts`, any admin-config route keyed by operator, `operator-messaging-config.ts`, `operator-disruption-config.ts`.
- [ ] For each, add an explicit guard: `if (req.params.operatorId !== req.operatorId) return reply.code(403).send(...)`. Exception: super-admin users (future) doing cross-tenant operations — but that's a separate RBAC layer, not yet built.
- [ ] Write a test harness that fires every `:operatorId` route with a mismatched param and confirms 403.

**This is load-bearing for the AI write-tool phase** (Month 6). LLM-generated tool calls will include `operatorId`; the overwrite net covers query/body routes; path-param routes need explicit defense.

### B.3 — Worker split (1 day)

Current state: `server/src/index.ts:128-208` runs 4 background jobs inside the API process — weather poll (15 min), MVT auto-transmit, ASM/SSM delivery, OOOI simulation (15 min). The moment you scale to 2+ API replicas, every replica fires all four — MVT auto-transmit will **double-send** messages to airlines. That's a hard correctness bug.

Tasks:

- [ ] Create `apps/worker/` with its own `package.json`, entry `apps/worker/src/index.ts`.
- [ ] Move `startWeatherPoll`, `startAutoTransmitScheduler`, `startAsmSsmDeliveryScheduler`, and the OOOI simulation block from `server/src/index.ts` to `apps/worker/src/index.ts`. Share code via `server/src/jobs/` (same paths, just invoked from a different entry).
- [ ] Worker connects to same MongoDB, runs cron, no HTTP server.
- [ ] Deploy worker as its own Fly.io app `skyhub-worker-prod` with `count = 1` and `min_machines_running = 1`. Never auto-scale.
- [ ] Set `ENABLE_CRONS=false` on the API app; `ENABLE_CRONS=true` on the worker app. `server/src/index.ts` already has the guard wired in A.1.

Zero extra operational complexity; huge correctness win.

### B.4 — Audit log collection (1 day — design now, implement with write tools)

Not strictly required for Phase B, but the schema and indexes must exist before AI write tools ship in Month 6. Doing it now is cheap; doing it retroactively is a migration.

Tasks:

- [ ] Design `audit_log` collection in MongoDB. Schema (Mongoose):
  ```
  {
    operatorId: string (indexed),
    entityType: string (indexed — 'flight' | 'crew' | 'aircraft' | etc.),
    entityId: string (indexed),
    action: string ('create' | 'update' | 'delete' | 'reassign' | etc.),
    userId: string (indexed),
    source: 'ui' | 'api' | 'ai_tool' | 'import',
    prompt?: string (AI queries only),
    tool?: string (AI queries only),
    params: object,
    before?: object,
    after?: object,
    result: 'success' | 'failure',
    timestamp: Date (indexed desc),
    reverseOp?: object (for rollback)
  }
  ```
- [ ] Compound indexes: `{ operatorId, entityId, timestamp: -1 }`, `{ operatorId, userId, timestamp: -1 }`, `{ operatorId, source, timestamp: -1 }`.
- [ ] TTL index set to 7 years (aviation regulatory standard).
- [ ] Mongoose model + Zod schema. No routes yet — routes come with Month 6 write tools.

### B.5 — Production runbook (half day)

Tasks:

- [ ] Create `docs/production-runbook.md`. One page. Sections:
  - How to check if the API is up (curl `/health`)
  - How to check if the DB is up (Atlas dashboard link)
  - How to check cron job health (Fly.io worker logs)
  - "What to do if API is down during a live shift" — dispatchers fall back to v1/AIMS/phone. Write the actual fallback before it matters.
  - How to roll back a bad deploy (Fly.io `flyctl releases rollback`)
  - Who to contact: you, Professor, MongoDB support, Cloudflare support
- [ ] Test the rollback procedure once against staging before declaring this done.

### Phase B exit criteria

- [ ] `getOperatorId()` never returns `''` in production
- [ ] No path-param route allows cross-tenant access
- [ ] Worker runs crons exactly once; API replicas don't duplicate
- [ ] Audit log collection exists (even if empty)
- [ ] Runbook exists and rollback has been tested once

---

## 6. Phase C — Scale-ready architecture

**Definition of done:** system can handle the 100-aircraft / 12,000-crew workload projected for the primary reference operator, or survive onboarding a second paying customer without re-architecture.

**When to start:** as soon as Phase B is stable, and in parallel with the canvas roadmap's Months 5–9 feature work.

### C.1 — Scale MongoDB (1–2 days ops, tier upgrade ongoing)

Tasks:

- [ ] Upgrade to **M50 dedicated** when any of: (a) working-set exceeds M30's 8GB RAM, (b) crew collection passes 1M documents, (c) p95 query latency exceeds 200ms under real load.
- [ ] Enable sharding ONLY if the total collection size approaches 500GB. At 12k-crew scale, this is a 3+-year horizon.
- [ ] Configure read-preference `secondary` for reporting endpoints (daily-schedule reports, frequency-analysis). Keep writes and OLTP on primary.
- [ ] Add connection pooling config to `server/src/db/connection.ts` — `maxPoolSize: 50` for API replicas, `maxPoolSize: 10` for worker.

### C.2 — Redis (1 day)

Required for B.3's leader election if you want stricter guarantees than "worker is count=1" (a machine restart could briefly overlap). Also the natural home for WebSocket/SSE pub-sub when Surface 03 proactive notifications ship in Month 5.

Tasks:

- [ ] Provision Upstash Redis (serverless, pay-per-use, Redis-compatible) or Fly.io Redis (integrated). Start with 256MB.
- [ ] Use for: session cache (90s TTL on user profile), WebSocket fanout (notifications published on the API; workers subscribe and broadcast), distributed lock for worker leader election, AI tool-call cache (60s TTL on read tool results per the roadmap).
- [ ] Add `REDIS_URL` to `@skyhub/env/server`.

### C.3 — Multi-tenant posture (defer unless triggered)

CLAUDE.md tech stack says "database-per-tenant." Current implementation is multi-tenant single-DB with `operatorId` filtering. For 1–5 operators this is fine. Triggers that force migration:

- An operator's contract requires contractual data isolation
- SOC 2 Type 2 auditor flags shared DB as a finding (unlikely for Type 2 if audit logs are clean)
- An EU operator requires GDPR data residency guarantees stronger than `operatorId` filtering
- An operator requests their own backup schedule or retention policy

Keep the architecture portable: never cross-tenant join, keep the JWT as single source of truth for `operatorId`, keep Mongoose models stateless (no tenant-locked indexes). If a trigger fires, the migration is ~200 LOC: a tenant router that reads `operatorId` from JWT and selects a Mongoose connection from a pool keyed by tenant.

### C.4 — Data residency (decide per-region, one-time cost each)

First two operators will likely both be in SE Asia → Atlas Singapore serves both. When you sell to:

- EU → new Atlas project in `eu-west-1` or `eu-central-1`
- ME → new Atlas project in `me-central-1`
- US → new Atlas project in `us-east-1`

Each region is a separate deploy: new Atlas cluster, new Fly.io app in that region, new DNS subdomain (e.g., `eu.api.skyhub.example`). Don't build cross-region replication. Regional deploys are easier to explain to auditors.

### C.5 — Observability depth

Phase A's Sentry + Grafana free tier is enough for 1 operator. Triggers to upgrade:

- More than 5 concurrent active operators
- More than 50 concurrent daily active users per operator
- AI query p95 latency visibly regressing in roadmap's Section 9 metrics

Upgrade path:

- Grafana Cloud Pro ($50/mo) — structured logs, metrics dashboards, alerting
- Or Datadog APM (expensive but best-in-class) — defer until revenue justifies

### Phase C exit criteria (ongoing — no hard gate)

System survives:

- 1000+ concurrent WebSocket connections
- 50 concurrent gantt loads on real VietJet data
- The busiest shift change of the year for a 100-aircraft operator

---

## 7. Long-term architecture for 100 aircraft / 12,000 crew

Reference architecture. Built toward during Phases A→C.

### 7.1 Hosting choices (decided)

| Layer                  | Choice                                                                        | Rationale                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web (Next.js)          | **Vercel**                                                                    | Next.js is Vercel's product. Preview URLs per PR, zero config, fast cold starts.                                                                                                                                                      |
| API + worker (Fastify) | **Fly.io**                                                                    | Cheap at pilot scale, scales to 12k-crew horizon, supports WebSockets + persistent processes. Multi-region if needed. `fly.toml` is 20 lines vs 200 for AWS. Migration to AWS ECS is well-trodden when we outgrow Fly (~$2k/mo mark). |
| Database               | **MongoDB Atlas**                                                             | Already in tech stack. Managed, SOC 2, backup/PITR, global regions. Do not self-host.                                                                                                                                                 |
| Object storage         | **Cloudflare R2**                                                             | S3-compatible, zero egress fees, ~½ the cost of S3. CDN built-in.                                                                                                                                                                     |
| Secrets                | Hosting provider native (Vercel env, Fly.io secrets) + GitHub Actions secrets | Skip Doppler until we have 3+ services × 3+ environments. Premature consolidation.                                                                                                                                                    |
| Errors                 | **Sentry**                                                                    | Free tier is enough for pilot. Team plan ($26/mo) when we need more users.                                                                                                                                                            |
| Logs + metrics         | **Grafana Cloud free tier** → Pro at 5+ operators                             | Free tier ships our volume. No Datadog before revenue justifies.                                                                                                                                                                      |
| CDN + DDoS             | **Cloudflare**                                                                | Free for our scale. In front of everything.                                                                                                                                                                                           |

### 7.2 Scale shape at 100 aircraft / 12,000 crew

Based on the scale math in the earlier scoping exchange:

```
                         Cloudflare (CDN + WAF + DDoS)
                                 │
                 ┌───────────────┼───────────────┐
                 │                               │
          app.skyhub.example            api.skyhub.example
                 │                               │
          Vercel (Next.js)          Fly.io Singapore region
                                   ┌──── Fastify × 3–5 ────┐
                                   │  4 vCPU / 8GB each    │
                                   │  Stateless            │
                                   │  Autoscale 3–5        │
                                   └──────────┬────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────┐
          │                                   │                                   │
   MongoDB Atlas M50                    Redis (Upstash 1GB)             Cloudflare R2
   3-node replica set                   Session cache                   Uploads, logos,
   Singapore primary                    WebSocket pub/sub               aircraft images,
   Cross-region backup                  Cron leader election            SSIM archive,
   Point-in-time recovery               Tool-call cache (60s)           audit log archive

                            Worker × 1 (Fly.io, never autoscale)
                            Weather poll · MVT auto-transmit · ASM/SSM deliver
                            OOOI simulation · FDP nightly compute · crew rollover

                            ML service (Google Cloud Run, already planned)
                            FastAPI + LightGBM
```

### 7.3 Capacity projections

| Metric                        | Pilot (30 ac, 3k crew) | Target (100 ac, 12k crew) |
| ----------------------------- | ---------------------- | ------------------------- |
| Flight instances/year         | ~55K                   | ~180K                     |
| Crew duty records (3y window) | ~3.2M                  | ~13M                      |
| Movement messages/year        | ~220K                  | ~730K                     |
| Concurrent users, peak        | ~300                   | ~1,500                    |
| WebSocket connections, peak   | ~350                   | ~1,500                    |
| Storage (all types)           | ~50GB                  | ~500GB over 3y            |
| MongoDB tier                  | M20 ($175/mo)          | M50 ($1,300/mo)           |
| Fastify replicas              | 1–2                    | 3–5                       |

### 7.4 Cost projections

**Pilot (1 operator, 30 aircraft, 3k crew):**

- Vercel Pro: $20/mo
- Fly.io (2 API + 1 worker + Redis): ~$50/mo
- MongoDB Atlas M20: $175/mo
- Cloudflare R2: ~$5/mo
- Sentry + Grafana: free
- **Infra total: ~$250/mo** + Claude API $500–2k = **$1k–2.5k/mo during pilot**

**Production-scale (1 operator, 100 aircraft, 12k crew):**

- Vercel Pro: $20–100/mo (depending on traffic)
- Fly.io (3–5 API + 1 worker + Redis): ~$400–800/mo
- MongoDB Atlas M50 dedicated: ~$1,300/mo
- Cloudflare R2: ~$50/mo
- Sentry Team: $26/mo
- Grafana Cloud Pro: $50/mo
- **Infra total: ~$1,800–2,500/mo** + Claude API $2k–8k = **$4k–10k/mo per operator**

Infra is a **minority of total spend.** Claude API dominates. Don't over-optimize infrastructure — optimize AI tool descriptions, caching, and tool-call latency.

### 7.5 Disaster recovery — required for airline SLA

| Metric                             | Target                                   | How                                                                                           |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| RTO (recovery time)                | <15 min                                  | Atlas automatic failover (M10+), Fly.io `flyctl releases rollback`                            |
| RPO (data loss tolerance)          | <1 min                                   | Atlas continuous oplog backup (M20+), point-in-time recovery                                  |
| Graceful degradation when AI down  | Manual UI works                          | Built into the roadmap's behavioral contract (Read-before-write, never AI as hard dependency) |
| Graceful degradation when API down | Dispatchers fall back to v1/AIMS + phone | Runbook §B.5                                                                                  |

Airlines run 24/7. If the API is down for 3 hours, flights don't board, crews time out, regulators notice. Non-negotiable.

---

## 8. Decisions we've made (2026-04-19)

Decision log. Changing any of these requires re-planning.

| #   | Decision                                                                | Why                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Keep `@skyhub/api` client as the single base-URL authority              | Consolidating `lib/api.ts`, `authed-fetch.ts`, `auth-provider.tsx` into it is polish, not a blocker. Defer to Phase C.                                                   |
| D2  | Web → Vercel, server + worker → Fly.io, DB → Atlas, storage → R2        | See §7.1. Locked for pilot. Revisit at 5+ operators or $2k/mo server cost.                                                                                               |
| D3  | Singapore region for the first 2 operators                              | VietJet is Vietnam; second operator likely SE Asia. Atlas Singapore serves both with acceptable latency and residency story.                                             |
| D4  | M20 Atlas for pilot, M50 for production-scale                           | M10 is shared, not prod-safe. M50 handles 12k-crew workloads.                                                                                                            |
| D5  | No Doppler, no Datadog, no Kubernetes in year one                       | Premature infrastructure consolidation for a solo dev. Revisit at 5+ operators.                                                                                          |
| D6  | Worker split is Phase B, not Phase A                                    | Phase A has 1 API replica, so crons running in-process is correct. Splitting is required before the second API replica.                                                  |
| D7  | `getOperatorId()` Stage 1 only in Phase B                               | The server-side JWT overwrite net already protects tenant isolation for query/body routes. Stages 2 and 3 are polish.                                                    |
| D8  | Path-param RBAC sweep is Phase B, load-bearing for Month 6 AI writes    | Not covered by current JWT overwrite net. Must land before AI tools can call `/operators/:id/...` routes.                                                                |
| D9  | Audit log schema designed in Phase B, implemented when write tools ship | Cheap to design now; expensive to retrofit.                                                                                                                              |
| D10 | Database-per-tenant deferred                                            | Current `operatorId` filtering is sufficient for ≤5 operators. Migration trigger: contractual data isolation requirement, SOC 2 Type 2 finding, or GDPR-strict operator. |
| D11 | Mobile deploy deferred to Month 9                                       | Per canvas roadmap. Pilot is web-first. No EAS Build config needed in Phase A.                                                                                           |

---

## 9. Stop-doing list

Explicit decisions to NOT do in this window. Re-visiting any of these requires explicit justification.

1. **No multi-tenant silo migration.** `operatorId` filtering is sufficient for 2 customers. Q3 2027 project at earliest.
2. **No Kubernetes.** Fly.io machines or ECS Fargate at the scale where Fly breaks. K8s requires a dedicated SRE we don't have.
3. **No custom cron scheduler.** Redis leader election (Phase C.2) or hosting-provider-native scheduled jobs. Don't build another airflow.
4. **No self-hosted MongoDB.** Operational burden isn't worth the 30% savings. Atlas handles backups, PITR, failover — we get 5 weekends a year back.
5. **No microservices split beyond API + worker + ML.** Three services is not a "microservice architecture"; it's separation of concerns. Real microservices (10+ services) is a solution to problems we don't have.
6. **No serverless (Lambda, Workers) for Fastify.** Breaks long-running SSE/WebSocket, breaks in-process cron, breaks JWT refresh flow. Fly.io persistent processes are the right shape.
7. **No SOC 2 Type 2 in year one.** Type 1 by Month 10 per canvas roadmap is enough. Type 2 requires 6–12 months of evidence collection — 2028 project.
8. **No Doppler, no Datadog, no New Relic on day one.** Free-tier Sentry + Grafana Cloud are enough until we have revenue to justify upgrade.
9. **No GraphQL layer.** Current REST via Fastify is fine. Don't invent work.
10. **No JWT token rotation automation in Phase A.** Static `JWT_SECRET` for pilot. Rotation mechanism is a Phase C item.
11. **No auto-scaling based on custom metrics.** Fly.io's built-in CPU-based autoscale is enough for 1–5 operators.
12. **No edge-compute experiments.** Cloudflare Workers for API? No. Vercel Edge Functions for Next.js middleware is fine; stick to the default Next.js routing otherwise.

---

## 10. Open questions

To resolve before execution starts on each phase.

### Before Phase A

- [ ] **Domain name chosen and registered?** The doc uses `skyhub.example` as a placeholder.
- [ ] **VietJet data access paperwork timeline?** Seeding prod with fake data is fine; seeding with real VietJet crew / flight data may be gated by their NDA / data-sharing agreement. Start the request now if not already in flight.
- [ ] **Professor's role in deploys?** Do they have Fly.io + Vercel + Atlas access, or is this single-dev ops?

### Before Phase B

- [ ] **Second developer's timeline?** Canvas roadmap assumes a senior dev joins at Month 4 if Month 3 slips >2 weeks. Has that hiring process started? Worker split + RBAC sweep are more tractable with help.
- [ ] **VietJet duty-manager contact identified?** Phase B's runbook requires a clear escalation path. Who do they call when API is down at 3am?

### Before Phase C

- [ ] **Second customer signed or warm?** C.4 (regional deploys) is a no-op until a non-SEA operator signs. Don't build multi-region until there's a buyer.
- [ ] **AI token budget per operator?** Roadmap says $2–8k/mo. Final pricing on the operator contract changes the Claude-vs-infra budget ratio.

---

## 11. The one-paragraph summary

Phase A is a 2–3 day focused deploy push — Dockerfile, R2 uploads, Atlas M20, Vercel + Fly.io, DNS + SSL, Sentry, CI. Phase B is a 1–2 week pre-pilot hardening — `getOperatorId` throw, path-param RBAC sweep, worker split for correct cron, audit log schema, runbook. Phase C is ongoing scale-readiness — M50 upgrade, Redis, multi-region readiness, observability depth — done in parallel with canvas roadmap Months 5–9 feature work. The three phases cost ~$250/mo at pilot and ~$2k/mo at 12k-crew scale, and the infrastructure is a minority of total operating cost — Claude API dominates. Hosting trio (Vercel + Fly.io + Atlas + R2) is locked for pilot and revisitable at 5+ operators. No Kubernetes, no microservices, no silo migration, no Datadog until revenue justifies. The product is the moat; the infrastructure is the rails.

---

_Living document. Update after each phase completes. When reality diverges from plan — and it will — update the plan, don't ignore the reality._
