# Horizon v2 — SkyHub

## What Is This
Airline operations management platform replacing legacy systems (AIMS). Built for airlines with 50–1000+ aircraft. VietJet Air is the primary reference operator (Vietnam, UTC+7, SGN main base).

## Tech Stack
- **Client:** Expo SDK 52+, React Native 0.76+, React Navigation 7, Zustand, WatermelonDB (offline-first SQLite), React Native Skia (Gantt rendering), NativeWind v4 / Tailwind CSS
- **UI Library:** Gluestack UI v3 (accessible primitives — Button, Modal, Select, Toast, FormControl) + custom SkyHub components (Card, SectionHeader, ListItem, etc.)
- **Server:** Node.js, Fastify, Mongoose ODM, JWT auth, Zod validation
- **Data:** MongoDB Atlas (database-per-tenant), Redis (caching/pub-sub/queues)
- **ML:** FastAPI on Cloud Run (separate service)
- **Monorepo:** Turborepo — `apps/mobile`, `apps/web`, `server`, `packages/*`
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

### 5. Component Size Limit: 400 Lines Max
Flag at 300 lines. Split at 400. Maximum 8 useState hooks — use Zustand beyond that. Extract business logic to `packages/shared/src/logic/`. React.memo on all list item components. FlatList renderItem must be a memoized component.

### 6. Styling: NativeWind className ONLY
Use NativeWind `className` props for all styling. NO `StyleSheet.create()` in component files (exception: `shadowStyles` in theme/ for native platform shadows). NO inline `style={}` objects except for dynamic runtime values (accentColor, status colors). All colors from `useTheme()` → `palette.xxx`. All typography from `packages/ui/src/theme/typography.ts`. Minimum text size 11px. Dark mode mandatory on every component.

### 7. Offline-First Architecture
Every read from WatermelonDB first. Every write to WatermelonDB first, then queue for sync. UI must work with only local data. Sync classification per data type (Reference / Operational / Personal / Disruption).

### 8. Skia for Gantt Charts
All timeline/Gantt rendering via `@shopify/react-native-skia`. NEVER use View-based absolute positioning for timeline bars. Pan/zoom on UI thread via Reanimated.

### 9. Icon System — Zero Emoji
All icons via `lucide-react-native` through the `<Icon>` wrapper component. NEVER use emoji in any component. NEVER use `@expo/vector-icons` or `react-native-vector-icons`. NEVER import from `lucide-react-native` directly in screen files — use `<Icon>` wrapper or `domainIcons` map from `packages/ui/src/theme/icons.ts`.

### 10. Shadow System — No Flat Cards
Every Card must have shadow applied (`shadowClasses.card` + native `shadowStyles.card`). Shadows defined in `packages/ui/src/theme/shadows.ts`. Cards without shadow look like wireframes, not a finished product.

### 11. Accent Color — Use Aggressively
Dynamic per-tenant via `useTheme().accentColor`. Default `#1e40af` (blue). Must appear 3+ times on every screen: section header bars, primary buttons, active list items, stat numbers, links. Applied via `style={{ backgroundColor: accentColor }}` since it's runtime-dynamic.

### 12. Gluestack UI v3 — Accessible Primitives
Complex interactive components (Button, Input, Modal, Select, Toast, FormControl, Checkbox, Radio, Switch, Actionsheet, AlertDialog, Drawer, Accordion) come from Gluestack v3. Located at `packages/ui/src/gluestack/`. Screen files import ONLY from `@horizon/ui` barrel — NEVER from `@gluestack-ui/*` directly. SkyHub wraps Gluestack for Button and SearchInput with our visual design. See skill: `horizon-frontend`.

## Navigation — 6 Tabs
```
Home | Network | Flight Ops | Ground Ops | Crew Ops | Settings
```
- **Phone/Tablet:** Bottom tab bar, all 6 visible. Active tab: accent tint pill + accent icon/label.
- **Desktop (web):** Collapsible bottom dock. Chevron to collapse into floating pill.
- **Settings is role-based:**
  - All users: Account (Profile, Appearance, Notifications, Password, Preferences)
  - Admin users: + Administration (Master Data, Users & Roles, Interface, Operator Config, Reports)

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
- `horizon-frontend` — Design system enforcement (tokens, shadows, accent, icons, Gluestack)
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
  mobile/                → Expo/React Native app
    app/                 → Expo Router (file-based routing)
      (tabs)/            → Tab screens (index, network, flight-ops, ground-ops, crew-ops, settings)
  web/                   → Next.js app (desktop/tablet web)
    src/app/             → App Router (file-based routing)

packages/
  ui/                    → SHARED design system (both apps import from @horizon/ui)
    src/
      components/        → SkyHub primitives (Card, SectionHeader, ListItem, Button, etc.)
      gluestack/         → Gluestack v3 accessible primitives (Modal, Select, Toast, etc.)
      theme/             → Token files (colors.ts, typography.ts, spacing.ts, shadows.ts, icons.ts)
      stores/            → Zustand stores (useThemeStore.ts)
      hooks/             → Shared hooks (useTheme.ts, useResponsive.ts)
  shared/                → Shared types, logic, utilities, constants
    src/
      types/             → TypeScript interfaces
      logic/             → Pure business logic (FDTL, pairing, IATA — no React)
      constants/         → Delay codes, airport data, ICAO types

server/                  → Fastify API server
  src/
    models/              → Mongoose schemas
    routes/              → Fastify route handlers
    middleware/          → Auth, RBAC, tenant routing
    sync/                → WatermelonDB sync protocol handlers
```

## Visual Polish Checklist (Every Screen)
- [ ] Every card has shadow
- [ ] Accent color visible 3+ times
- [ ] 3+ typography levels (title → heading → body minimum)
- [ ] SectionHeaders have accent left bar
- [ ] Empty states for empty lists (never blank space)
- [ ] Search inputs have shadow + card background
- [ ] List items have press feedback
- [ ] Page uses gradient background (not flat white/black)
- [ ] All icons via `<Icon>` wrapper, zero emoji
- [ ] Dark mode tested and correct
