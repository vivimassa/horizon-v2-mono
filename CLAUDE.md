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

## Behavioral Contract — How You Work

These rules govern your behavior as an agent. Violating them is worse than a bug — it wastes human time.

### Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- **State assumptions explicitly** before implementing. If the request has multiple valid interpretations, list them and ask — never pick silently.
- **If something is unclear, stop.** Name what's confusing. Ask. A 30-second clarification saves a 30-minute redo.
- **If a simpler approach exists, say so.** Push back when the requested approach is overcomplicated. You are allowed to disagree — but explain why.
- **Surface tradeoffs.** "This approach is faster to build but harder to extend" is more useful than silently choosing one.

### Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked. No "flexibility" or "configurability" that wasn't requested.
- No abstractions for single-use code. No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it before presenting.
- **The test:** Would a senior engineer say this is overcomplicated? If yes, simplify.
- This reinforces Rule 11 (400-line limit) — but applies to every function, not just components.

### Surgical Changes

Touch only what you must. Clean up only your own mess.

- **Don't "improve" adjacent code**, comments, or formatting that wasn't part of the request.
- **Don't refactor things that aren't broken.** Match existing style, even if you'd do it differently.
- **If you notice unrelated issues** (dead code, missing types, style inconsistencies), mention them in your response — don't silently fix them.
- **When YOUR changes create orphans** (unused imports, dead variables), remove them. Don't remove pre-existing dead code unless asked.
- **The test:** Every changed line should trace directly to the user's request.

### Goal-Driven Execution

Define success criteria. Loop until verified.

- Transform vague tasks into verifiable goals before starting:
  - "Add validation" → "Define Zod schema, write test for invalid input, make it pass"
  - "Fix the bug" → "Write test that reproduces it, then make it pass"
  - "Build the screen" → "Render with mock data, verify dark mode, verify accent color, check 13px minimum"
- **For multi-step tasks, state a brief plan:**
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
  ```
- Strong success criteria let you loop independently. Weak criteria ("make it work") cause rework.
- This is the CLAUDE.md-level principle behind the `verification-loop` skill — apply it to every task, not just PR gates.

### These rules are working if:

- Diffs contain only requested changes — no drive-by improvements
- Clarifying questions come before implementation, not after mistakes
- Code is simpler than expected, not more complex
- Plans have explicit verify steps, not just "implement X"

---

## Critical Rules — Read Every Session

### 1. Design System: Core Design System + Stitch Glass

SkyHub's visual identity is built on three merged layers:

- **Core Design System (XD)** — gray scale, semantic colors, 6-level elevation, button/badge sizing, typography weights
- **Stitch Glass Aesthetic** — glass panels (`variant="glass"`), radial glows, accent glow shadows, section accent bars
- **SkyHub Overrides** — 13px text minimum, 12px card radius, system fonts, Lucide icons

**Every component MUST conform to the design tokens in `packages/ui/src/theme/`.** The skill file `.claude/skills/horizon-frontend/SKILL.md` is the canonical reference. Read it before writing ANY UI code.

### 2. Color System — XD Gray Scale + Stitch Depth

**Light mode grays:** `#FAFAFC` (page) → `#FFFFFF` (card) → `#F2F2F5` (hover) → `#E4E4EB` (border)
**Dark mode depth:** `#0E0E14` (page) → `#191921` (card) → `#1F1F28` (hover) → `rgba(255,255,255,0.06)` (border)
**Status colors:** Vibrant XD values — `#06C270` (success), `#FF3B3B` (error), `#FF8800` (warning), `#0063F7` (info)
All colors via `useTheme()` → `palette.xxx`. NEVER hardcode hex values in component files.

### 3. Shadow System — 6-Level Elevation (CRITICAL)

Every Card MUST have a shadow. Shadow color is `#606170` (neutral blue-gray, NOT pure black).

| Level | Name                  | Usage                                      | iOS shadowOpacity |
| ----- | --------------------- | ------------------------------------------ | ----------------- |
| 01    | `card`                | Resting cards, list items                  | 0.06              |
| 02    | `cardHover` / `input` | Hovered cards, inputs, search bars         | 0.08              |
| 03    | `raised`              | Dropdowns, popovers, floating action cards | 0.10              |
| 04    | `floating`            | Floating panels, sticky headers            | 0.12              |
| 05    | `modal`               | Modals, dialogs, bottom sheets             | 0.14              |
| 06    | `overlay`             | Top-level overlays, toasts                 | 0.18              |

Import from `packages/ui/src/theme/shadows.ts`. A card without shadow looks like a wireframe.

### 4. Typography — Weight Rules

- **Bold (700):** Headings, section titles, stat numbers
- **SemiBold (600):** Page title, emphasis, badges
- **Medium (500):** Labels, buttons, card titles, nav items
- **Regular (400):** Body text, captions, descriptions

Minimum text size: **13px**. The XD system uses 10px for badges — we override to 13px for accessibility. All tokens in `packages/ui/src/theme/typography.ts`.

### 5. Component Dimensions (Core Design System)

**Buttons:** 24px (sm) → 32px (md) → 40px (lg) → 48px (xl/mobile CTA). Radius 8px. Text: 11–14px Medium.
**Badges:** 20px (sm) → 24px (md) → 29px (lg). Radius 6px. Exception: detail header status badges (Active/Inactive) use 13px SemiBold pill.
**Inputs:** 40px height, 8px radius, 14px Regular text, 12px Medium label.
**Cards:** 12px radius (mobile override of XD's 8px), padding 12–16px.
**Touch targets:** 44px minimum (Apple HIG).
Dimension tokens in `packages/ui/src/theme/spacing.ts` → `buttonSize`, `badgeSize`.

### 6. Glass Panels (Stitch Aesthetic)

Use `<Card variant="glass">` for hero/elevated sections in dark mode. This applies:

- Background: `rgba(25,25,33,0.85)` with `backdrop-filter: blur(24px)` on web
- Border: `rgba(255,255,255,0.06)`
- Use sparingly: profile hero cards, KPI strips, featured sections. NOT for every card.

Glass helper functions in `packages/ui/src/theme/colors.ts` → `glass` export.

### 7. Section Headers — Accent Bar Pattern

Use `<SectionHeader title="Account" />` for all section dividers. Renders a 3px accent-colored vertical bar before the title text. Optional `badge` prop for labels like "Admin Only". Color defaults to `accentColor`, override with `color` prop (e.g. purple for admin sections).

### 8. UTC-Only Time Storage

Store UTC milliseconds. Display operator-local. NEVER mix. All timestamp fields must have `Utc`, `Local`, or `Ms` suffix. See skill: `horizon-time-law`.

### 9. operatorId on Every Query

MongoDB and WatermelonDB queries MUST include operatorId. Missing = multi-tenant data leak.

### 10. ICAO Standard Codes

Aircraft types: `A320`, `A321`, `A333` (industry standard). Airports: ICAO codes (`VVTS`, not `SGN` in data layer).

### 11. Component Size Limit: 400 Lines Max

Flag at 300 lines. Split at 400. Maximum 8 useState hooks — use Zustand beyond that. Extract business logic to `packages/shared/src/logic/`. React.memo on all list item components.

### 12. Styling: NativeWind className ONLY

Use NativeWind `className` for all styling. NO `StyleSheet.create()` in component files. NO inline `style={}` except for dynamic runtime values (accentColor, status colors, shadows). All colors from `useTheme()`. Minimum text size 13px. Dark mode mandatory.

### 13. Offline-First Architecture

Every read from WatermelonDB first. Every write to WatermelonDB first, then queue for sync.

### 14. Skia for Gantt Charts

All timeline/Gantt rendering via `@shopify/react-native-skia`. NEVER View-based absolute positioning for timeline bars.

### 15. Icon System — Zero Emoji

All icons via `lucide-react-native` through `<Icon>` wrapper. NEVER use emoji. NEVER import from `lucide-react-native` directly in screen files.

### 16. Accent Color — Use Aggressively

Dynamic per-tenant via `useTheme().accentColor`. Default `#1e40af`. Must appear 3+ times on every screen: section bars, primary buttons, active indicators, stat numbers, links.

### 17. Gluestack UI v3 — Accessible Primitives

Complex interactive components from Gluestack v3 at `packages/ui/src/gluestack/`. Screen files import ONLY from `@horizon/ui` barrel.

## Navigation — 6 Tabs

```
Home | Network | Flight Ops | Ground Ops | Crew Ops | Settings
```

- **Phone/Tablet:** Bottom tab bar (SpotlightDock). Active tab: accent glow + accent icon/label.
- **Desktop (web):** Collapsible bottom dock.
- **Settings is role-based:**
  - All users: Account (Profile, Appearance, Notifications, Security, Preferences)
  - Admin users: + Administration (Master Data, Users & Roles, Interface, Operator Config)

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

## Skills

- `horizon-frontend` — Design system enforcement (tokens, shadows, accent, glass, icons)
- `horizon-architecture` — Performance guardrails, component limits
- `horizon-time-law` — UTC storage rules
- `horizon-db-conventions` — MongoDB + WatermelonDB patterns

## Git Conventions

Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`

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

## Component Catalog (Core Design System)

### Buttons — 5 Variants + States

- **primary** — accent bg, white text (standard CTA)
- **secondary** — transparent bg, accent border + text
- **ghost** — transparent, accent text only
- **destructive** — red `#E63535` bg, white text (delete/remove)
- **affirmative** — green `#06C270` bg, white text (approve/confirm/apply)
- **States:** Normal → Hover (lighter fill) → Pressed (darker fill) → Focus (2px accent ring offset) → Disabled (50% opacity)
- **Progressive:** Loading state with spinner inside button. Use `ButtonSpinner` from Gluestack.

### Badges — 9 Semantic Variants

INFO (blue `#0063F7`), SUCCESS (green `#06C270`), WARNING (orange `#FF8800`), DANGER (red `#FF3B3B`), REMINDER (pink `#be185d`), MISC (accent), UNAVAILABLE (gray outline), OFFLINE (dark gray `#555770`), PRIMARY (accent blue)
Detail header status badges: **13px SemiBold** rounded-full pill (exception to standard badge sizes).

### Avatars — 4 Types

- **Icon** (24px) — fallback Lucide user icon
- **Initials** (32px) — 2-letter initials on accent-tinted circle
- **Picture** (32px) — circular image, 2.5px white border
- **Status dot** — 8px green (active) / gray (idle) dot, offset bottom-right of avatar

### Chips — 5 Variants

22px height, 8px radius. Types: Text only, Icon+text, Dismissible (with X), Colored (accent bg), Avatar (with mini picture, 11px pill radius).

### Alerts — 4 Semantic + Variants

Left accent bar (3px) + icon + text + optional dismiss X + optional CTA button.

- **Info** — blue bar, `AlertCircle` icon, `#0063F7`
- **Success** — green bar, `CheckCircle` icon, `#06C270`
- **Error** — red bar, `XCircle` icon, `#E63535`
- **Warning** — orange bar, `AlertTriangle` icon, `#FF8800`
  Variants: text-only, with header+body, with CTA button, dismissible.

### Forms — Input Rules

- Height: 40px, radius 8px (`rounded-lg`), 14px Regular text, 12px Medium label above
- **States:** Normal (gray border) → Focus (accent border + ring) → Error (red `#E63535` border) → Success (green `#06C270` border) → Disabled (50% opacity, gray bg)
- **Assistive text:** 12px Regular below input, uses status color when validating
- **Icon positions:** left icon, right icon, or both (double icon). Icon size 16px, color `textSecondary`.
- **Validation UX:** spinner + "Checking..." → success checkmark → error X with message

### Modals — Standardized Patterns

Use Gluestack AlertDialog/Modal. Button pairs: "No, Cancel" (secondary) + "Yes, Do It" (primary). Destructive: "No, Cancel" + "Yes, Delete" (red). Always include dismiss X on non-critical modals.

### Tables — Standard Patterns

- Header: 12px Medium uppercase, `textTertiary`, bottom border
- Rows: alternating bg (`backgroundHover` on odd rows), hover state
- Cell padding: `px-3 py-2.5` minimum for data tables
- Row actions: overflow menu (MoreHorizontal icon) with Edit/Delete/Export
- Pagination footer: "Showing X-Y of Z" left, numbered pagination right
- Sortable columns: chevron indicator on header click
- Selection: checkbox column, accent bg highlight on selected rows

### Pagination

Button pagination (Prev/Next with chevron icons) or numbered (1, 2, **3**, 4, 5... 12 with active page in accent circle).

### Navigation — Tabs

3 styles: **Underline** (accent bar under active), **Pill** (accent bg on active), **Box** (bordered bottom). Active tab always uses accent color.

### Progress Indicators

- **Bar:** 4px height, full radius, track in `border` color, fill in accent
- **Circular:** 24/32/40px diameter, 3px stroke, accent color
- **Percentage text:** 12px Medium beside or inside

### Status Icons (standardized Lucide mapping)

- **info** → `AlertCircle` (blue `#0063F7`)
- **warning** → `AlertTriangle` (orange `#FF8800`)
- **error** → `XCircle` (red `#E63535`)
- **success** → `CheckCircle` (green `#06C270`)

### Primary Color Shades

`colors.primary` in `colors.ts`: pressed `#3568D4` → default `#3E7BFA` → hover `#5B8DEF` → light `#6698FF` → lighter `#9DBFF9` → lightest `#CCDDFF` → surfaceTint `#E5F0FF`

### Extended Semantic Colors

Yellow `#FFCC00` / `#FDDD48`, Purple `#6600CC` / `#AC5DD9`, Teal `#00CFDE` / `#73DFE7` — available via `colors.semantic`.

### Notification Badges

Red dot (8px) or count pill (red bg, white text, min 16px width) positioned top-right of icon with negative offset.

### Tooltips / Popovers

30px height, 4px radius. Dark bg (`#1C1C28`) in light mode, light bg in dark mode. 12px Regular text. Arrow/caret pointing to trigger.

### Sliders

Track: accent fill on left, `border` color on right. Thumb: 16px circle, white fill, accent border, shadow level 02. Range slider: two thumbs with accent fill between.

### Calendar / Date Picker

Selected date: accent circle. Range: connected accent-tinted row. Month nav: chevron left/right. Month grid: pill buttons. Today: subtle outline.

### Dropdowns — Advanced

Standard (Gluestack Select), Tabbed (with tab switcher inside), Search/auto-suggest (input + filtered list with avatars), Branched/cascading (nested sub-menus).

### Scrollbars

4px width, 2px radius, thumb in `textTertiary` color, track transparent.

## Visual Polish Checklist (EVERY Screen)

- [ ] Every card has shadow from `shadowStyles` (level 01 minimum)
- [ ] Accent color visible 3+ times (section bars, buttons, indicators)
- [ ] 3+ typography levels (title → heading → body minimum)
- [ ] Section dividers use `<SectionHeader>` with accent bar
- [ ] Hero/profile sections use `<Card variant="glass">` in dark mode
- [ ] Empty states for empty lists (never blank space)
- [ ] Search inputs have shadow + card background
- [ ] List items have press feedback (opacity or bg change)
- [ ] Page uses gradient background via `PageShell` (not flat white/black)
- [ ] All icons via `<Icon>` wrapper, zero emoji
- [ ] Status chips use vibrant XD colors from `colors.status`
- [ ] Dark mode tested — no invisible borders, no hardcoded colors
- [ ] No text below 13px — check badges, tab labels, timestamps
- [ ] Button heights follow scale: 24/32/40/48px
- [ ] Buttons use `bg-module-accent`, NEVER hardcoded `#1e40af`
- [ ] Active/Inactive badges use XD semantic RGBA colors, NEVER Tailwind `bg-green-*`/`bg-red-*`
- [ ] Form inputs: 40px height, 8px radius, focus ring in accent
- [ ] Alerts use left accent bar + semantic icon + color
- [ ] Tables have header in 12px Medium uppercase, adequate cell padding
- [ ] Delete buttons use `#E63535`, confirm buttons use `#06C270`
