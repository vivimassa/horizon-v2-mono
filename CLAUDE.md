# Horizon v2 — SkyHub

## What Is This
Airline operations management platform replacing legacy systems (AIMS). Built for airlines with 50–1000+ aircraft. VietJet Air is the primary reference operator (Vietnam, UTC+7, SGN main base).

## Tech Stack
- **Client:** Expo SDK 52+, React Native 0.76+, React Navigation 7, Zustand, WatermelonDB (offline-first SQLite), React Native Skia (Gantt rendering), NativeWind/Tailwind or Tamagui
- **Server:** Node.js, Fastify, Mongoose ODM, JWT auth, Zod validation
- **Data:** MongoDB Atlas (database-per-tenant), Redis (caching/pub-sub/queues)
- **ML:** FastAPI on Cloud Run (separate service)
- **Monorepo:** Turborepo — `apps/mobile`, `apps/server`, `packages/*`
- **Repo:** `vivimassa/horizon-v2-mono`

## Critical Rules — Read Every Session

### 1. Read HORIZON_PROJECT_STATE.md First
Contains full architecture, current build state, all decisions made. Read it before doing anything.

### 2. UTC-Only Time Storage
Store UTC milliseconds. Display operator-local. NEVER mix. All timestamp fields must have `Utc`, `Local`, or `Ms` suffix. See skill: `horizon-time-law`.

### 3. operatorId on Every Query
MongoDB and WatermelonDB queries MUST include operatorId. Missing = multi-tenant data leak. Database-per-tenant is defense-in-depth, not a replacement for query filtering.

### 4. ICAO Standard Codes
Aircraft types: `A320`, `A321`, `A333` (industry standard). Airports: ICAO codes (`VVTS`, not `SGN` in data layer). NEVER use custom abbreviations.

### 5. Component Size Limit: 1000 Lines Max
Flag at 800 lines. Split at 1000. Maximum 10 useState hooks — use Zustand beyond that. Extract business logic to `src/logic/`. React.memo on all list item components.

### 6. Design System Tokens Only
All colors from `useTheme()` → `palette.xxx`. All typography from `src/theme/typography.ts`. Minimum text size 11px. StyleSheet.create() for all styles. No inline style objects. Dark mode mandatory.

### 7. Offline-First Architecture
Every read from WatermelonDB first. Every write to WatermelonDB first, then queue for sync. UI must work with only local data. Sync classification per data type (Reference / Operational / Personal / Disruption).

### 8. Skia for Gantt Charts
All timeline/Gantt rendering via `@shopify/react-native-skia`. NEVER use View-based absolute positioning for timeline bars. Pan/zoom on UI thread via Reanimated.

## Workflow
1. `/feature-dev` — Full development workflow (research → plan → implement → verify)
2. `/code-review` — Comprehensive review with airline-domain checks
3. `/verify` — Quick quality gate (build + types + tests + conventions)

## Agents Available
- `planner` — Phased implementation plans (Opus)
- `code-reviewer` — Airline-domain quality review (Sonnet)
- `security-reviewer` — PII protection, tenant isolation, RBAC (Sonnet)
- `tdd-guide` — Test-driven development for all layers (Sonnet)
- `build-error-resolver` — Fix Expo/Metro/TS/Fastify build errors (Sonnet)
- `refactor-cleaner` — Dead code cleanup and component splits (Sonnet)

## Skills Available
- `horizon-frontend` — Design system enforcement
- `horizon-architecture` — Performance guardrails, component limits
- `horizon-time-law` — UTC storage rules, timezone conversion
- `horizon-db-conventions` — MongoDB + WatermelonDB patterns
- `search-first` — Research before coding
- `verification-loop` — Full quality gate sequence
- `continuous-learning` — Extract session patterns
- `strategic-compact` — Context management for long sessions

## Git Conventions
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`
- Pre-commit hook checks: secrets, console.log, file length, font sizes
- Commit-msg hook validates format

## Key People / Systems
- AIMS: Legacy reference system (feature parity target)
- AMOS: Maintenance system (XML integration)
- CAAV VAR 15: Vietnamese FDTL regulatory standard
- SSIM: Schedule data format standard

## File Structure
```
apps/
  mobile/              → Expo/React Native app
    src/
      components/
        ui/            → Design system primitives (Button, Card, Badge)
        common/        → Domain components (StatusChip, FlightCard)
        gantt/         → Skia-based Gantt rendering
      logic/           → Pure business logic (no React)
      models/          → WatermelonDB models
      stores/          → Zustand stores
      theme/           → Token files (colors, typography, spacing)
      navigation/      → React Navigation stacks
  server/              → Fastify API server
    src/
      models/          → Mongoose schemas
      routes/          → Fastify route handlers
      middleware/      → Auth, RBAC, tenant routing
      sync/            → WatermelonDB sync protocol handlers
packages/
  shared/              → Shared types, utilities, constants
```
