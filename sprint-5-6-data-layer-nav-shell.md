# Sprint 5 + 6 — React Query Data Layer + Themed Navigation Shell

**Combined sprint** because both are "wiring" work that benefits from being done together
**Estimated time:** 3–4 hours in a single session
**Risk level:** Medium — no schema or auth changes, but touches every tab layout and adds a new data layer
**Prerequisites:** Sprint 3 (needs `ScreenContainer`) **and** Sprint 4 (needs auth interceptor so hooks can call authenticated endpoints)

---

## Context

This is Session D of the infrastructure hardening plan. Before you start, confirm:

- ✅ **Sprint 1** — ESLint + Prettier + Husky
- ✅ **Sprint 2** — `@skyhub/env` Zod validation
- ✅ **Sprint 7** — GitHub Actions CI
- ✅ **Sprint 4** — JWT auth, `setAuthCallbacks` exists in `@skyhub/api`, `/auth/login` works
- ✅ **Sprint 3** — 8 new UI components including `<ScreenContainer>`, Button has `affirmative` variant

If any of those are not done, **stop and complete them first**.

**Repo:** `C:\Users\ADMIN\horizon-v2-mono`
**Package namespace:** `@skyhub/*`
**Server port:** `3002`

### What you're building and why

After Sprints 1–4, the app has:

- Validated environment
- Authenticated API calls on every request
- A shared component library

But every screen still does this:

```tsx
const [airports, setAirports] = useState([])
const [loading, setLoading] = useState(true)
useEffect(() => {
  api
    .getAirports()
    .then(setAirports)
    .finally(() => setLoading(false))
}, [])
```

Every screen reinvents caching, loading states, refetching, and invalidation. And every tab layout sets its own background color, tab bar styling, and header styling by hand. Some tabs miss some, so dark mode has white headers in places.

This sprint fixes both problems at once:

**Sprint 5** introduces React Query — every `api.xxx()` call becomes a hook (`useAirports()`, `useMe()`, etc.) with caching, refetching, and mutation invalidation. Query keys live in a central factory.

**Sprint 6** themes the navigation chrome — tab bars, stack headers, and screen backgrounds all flow from `useTheme().palette` automatically. `<ScreenContainer>` becomes the standard root wrapper for every new screen.

The two sprints share a pattern: **both add a provider at the root and then update a handful of screens to use the new primitives as proof of concept.** Combining them means you do the "wrap the root" work once.

### Reality check — what already exists

- `@tanstack/react-query` — **NOT installed** in any workspace
- No `QueryProvider`, no `queryKeys`, no hooks
- Mobile tab bar: uses custom `SpotlightDock` component instead of the standard Expo Router `<Tabs>` — this means Sprint 6's "theme the tab bar" becomes "theme the SpotlightDock + stack headers"
- Mobile stack headers: inconsistent — some tabs set `headerStyle`, others don't
- Web: has its own `SpotlightDock` and `Breadcrumb` already themed; web's scope is lighter
- `ScreenContainer`: assumed to exist from Sprint 3. If it doesn't, **create it first** (see Sprint 3 file for spec) — this sprint needs it.

---

## Pre-flight — READ THESE FIRST

1. `packages/api/src/client.ts` — confirm `setAuthCallbacks()` exists (Sprint 4) and the `api` object has the methods you'll wrap (`getAirports`, `getAircraftTypes`, `getScheduledFlights`, `getMe`, etc.)
2. `apps/mobile/app/_layout.tsx` — confirm the auth boot flow from Sprint 4. You'll wrap the existing root with `<QueryProvider>`.
3. `apps/mobile/app/(tabs)/_layout.tsx` — the tab layout. This is where `SpotlightDock` is wired. Check whether it's currently themed.
4. `apps/mobile/app/(tabs)/*/` — the 6 tab directories (`index`, `network`, `flight-ops`, `ground-ops`, `crew-ops`, `settings`). Each has a `_layout.tsx` with a `<Stack>` navigator.
5. `packages/ui/src/components/SpotlightDock.tsx` — understand how it currently handles active/inactive state.
6. `packages/ui/src/hooks/useTheme.ts` — confirm the hook interface (palette, accentColor, isDark).
7. `packages/ui/src/stores/useThemeStore.ts` — confirm `toggleColorMode()` exists.
8. `packages/ui/src/components/ScreenContainer.tsx` — confirm it exists from Sprint 3. If not, create it.

---

## Task breakdown

Use `TaskCreate` for each phase. **6 phases total.** Sprint 5 first (Phases A–D), Sprint 6 second (Phases E–F).

### Phase A — Install React Query (≈ 5 min)

```bash
cd apps/mobile && npm install @tanstack/react-query
cd ../web && npm install @tanstack/react-query
```

Do NOT install in `packages/ui` or `packages/api` — React Query is a peer concern of the apps. `packages/ui` and `packages/api` should not depend on it directly (but they can import types via `@tanstack/react-query` type-only imports if needed).

### Phase B — Query key factory (≈ 20 min)

Create `packages/api/src/query-keys.ts` with a central factory:

```ts
export const queryKeys = {
  // Reference data — rarely changes, 5-min staleTime
  airports: {
    all: ['airports'] as const,
    detail: (id: string) => ['airports', id] as const,
  },
  aircraftTypes: { all: ['aircraftTypes'] as const, detail: (id: string) => ['aircraftTypes', id] as const },
  aircraftRegistrations: {
    all: ['aircraftRegistrations'] as const,
    detail: (id: string) => ['aircraftRegistrations', id] as const,
  },
  countries: { all: ['countries'] as const },
  delayCodes: { all: ['delayCodes'] as const },
  activityCodes: { all: ['activityCodes'] as const },
  crewPositions: { all: ['crewPositions'] as const },
  crewGroups: { all: ['crewGroups'] as const },
  dutyPatterns: { all: ['dutyPatterns'] as const },
  cabinClasses: { all: ['cabinClasses'] as const },
  lopaConfigs: { all: ['lopaConfigs'] as const, byType: (icao: string) => ['lopaConfigs', icao] as const },
  carrierCodes: { all: ['carrierCodes'] as const },
  operators: { all: ['operators'] as const, detail: (id: string) => ['operators', id] as const },

  // Operational data — changes often, 30-sec staleTime
  flights: {
    all: ['flights'] as const,
    byDate: (from: string, to: string) => ['flights', from, to] as const,
    detail: (id: string) => ['flights', id] as const,
  },
  scheduledFlights: {
    all: ['scheduledFlights'] as const,
    byParams: (params: Record<string, string>) => ['scheduledFlights', params] as const,
  },
  scenarios: { all: ['scenarios'] as const },

  // User data
  me: ['me'] as const,

  // FDTL
  fdtl: {
    frameworks: ['fdtl', 'frameworks'] as const,
    scheme: (operatorId: string) => ['fdtl', 'scheme', operatorId] as const,
    rules: (operatorId: string) => ['fdtl', 'rules', operatorId] as const,
    tables: (operatorId: string) => ['fdtl', 'tables', operatorId] as const,
  },

  // Slots
  slots: {
    airports: ['slots', 'airports'] as const,
    series: (airport: string, season: string) => ['slots', 'series', airport, season] as const,
    stats: (airport: string, season: string) => ['slots', 'stats', airport, season] as const,
  },
} as const
```

Align the entries with the actual methods on the `api` object in `packages/api/src/client.ts`. Delete any keys that don't correspond to existing API methods; add any that do. Use exploration (`grep`) to find the full method list before finalizing.

### Phase C — React Query hooks (≈ 45 min)

Create `packages/api/src/hooks.ts`. Since `packages/api` shouldn't hard-depend on `@tanstack/react-query`, use `peerDependencies` in `packages/api/package.json`:

```json
"peerDependencies": {
  "@tanstack/react-query": "^5.0.0"
}
```

And import from it normally in `hooks.ts` — TS will resolve it from the consumer's node_modules.

The hooks file should have:

**Stale time constants:**

```ts
const REFERENCE_STALE = 5 * 60 * 1000 // 5 min
const OPERATIONAL_STALE = 30 * 1000 // 30 sec
const USER_STALE = 60 * 1000 // 1 min
```

**Query hooks (minimum 8):**
`useAirports`, `useAirport(id)`, `useAircraftTypes`, `useAircraftRegistrations`, `useCountries`, `useDelayCodes`, `useOperators`, `useMe`, `useScheduledFlights(params)`, `useScenarios(params)`. Use `REFERENCE_STALE` for the ref data and `OPERATIONAL_STALE` for scheduled-flights/scenarios, `USER_STALE` for `useMe`.

**Mutation hooks (minimum 3):**
`useCreateAirport`, `useUpdateAirport`, `useDeleteAirport`. Each calls `queryClient.invalidateQueries({ queryKey: queryKeys.airports.all })` (and the detail key, for updates) in `onSuccess`.

Export everything from `packages/api/src/index.ts`:

```ts
export { queryKeys } from './query-keys'
export * from './hooks'
```

### Phase D — QueryProvider (≈ 20 min)

Create `packages/ui/src/providers/QueryProvider.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      gcTime: 10 * 60 * 1000, // 10 min garbage collection
    },
    mutations: {
      retry: 0,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Export from `packages/ui/src/index.ts`.

Wrap both apps:

- `apps/mobile/app/_layout.tsx` — wrap the existing root (inside `ThemeProvider`, outside auth guard is fine).
- `apps/web/src/app/layout.tsx` — wrap the existing `RootLayout` children.

Pick **one existing screen** that currently uses `api.xxx()` + `useState` + `useEffect` and refactor it to use `useAirports()` (or whichever hook matches). This is the proof of concept — one screen, not all of them. Future screens adopt the pattern from the start. Document this screen in the commit message so the next session knows which one's been migrated.

### Phase E — Theme the navigation shell (Sprint 6, ≈ 45 min)

#### E1. Theme the tab layout

Open `apps/mobile/app/(tabs)/_layout.tsx`. It currently uses the custom `SpotlightDock`. Two tasks:

1. **`SpotlightDock` itself** — read `packages/ui/src/components/SpotlightDock.tsx`. Verify it already consumes `useTheme().accentColor` and `palette`. If it doesn't, add theme integration — active tab uses `accentColor`, inactive uses `palette.textSecondary`, background from `palette.background`.
2. **The Expo Router `<Tabs>` container** — set `screenOptions` with themed tab bar / headers / content styles even if `SpotlightDock` is the visible dock. Otherwise the Expo Router default white tab bar peeks through on some devices during navigation transitions.

```tsx
const { palette, accentColor } = useTheme()

<Tabs
  screenOptions={{
    tabBarActiveTintColor: accentColor,
    tabBarInactiveTintColor: palette.textSecondary,
    tabBarStyle: {
      backgroundColor: palette.background,
      borderTopColor: palette.border,
      borderTopWidth: 0.5,
    },
    headerStyle: { backgroundColor: palette.background, shadowColor: 'transparent', elevation: 0 },
    headerTintColor: palette.text,
    headerTitleStyle: { fontSize: 17, fontWeight: '600' },
    contentStyle: { backgroundColor: palette.background },
  }}
/>
```

#### E2. Theme every stack navigator inside tabs

Each tab has its own `_layout.tsx` with a `<Stack>`. Apply the same pattern:

```tsx
import { Stack } from 'expo-router'
import { useTheme } from '@skyhub/ui'

export default function NetworkLayout() {
  const { palette } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  )
}
```

Apply to all 6 tabs: `index`, `network`, `flight-ops`, `ground-ops`, `crew-ops`, `settings`.

#### E3. Adopt `<ScreenContainer>` in 3–4 high-traffic screens

Don't refactor every screen. Pick the **index screen of each tab** (the first thing users see when they switch tabs) and wrap its content with `<ScreenContainer>` instead of the ad-hoc `<View style={{ flex: 1, backgroundColor: ... }}>` pattern. That's 5–6 screens max.

#### E4. Confirm dark mode toggle works

The settings tab should already have a dark-mode toggle somewhere that calls `useThemeStore().toggleColorMode()`. Confirm that toggling it immediately updates:

- The tab bar background
- Every stack header
- Every screen background
- The `SpotlightDock` active/inactive colors

If any of these still flash white, you missed a `_layout.tsx`. Fix.

### Phase F — Deep linking + web shell (≈ 20 min)

#### F1. Mobile deep linking

`apps/mobile/app.json` (or `app.config.ts`) — add a scheme for deep linking:

```json
{
  "expo": {
    "scheme": "skyhub",
    ...
  }
}
```

Expo Router handles the linking config automatically from file structure. No further config needed.

#### F2. Web app layout consistency

`apps/web/src/app/layout.tsx` already wraps the `<body>` with `bg-hz-bg text-hz-text` Tailwind classes. Confirm those map to theme palette via the existing `ThemeProvider`. If the `SpotlightDock` on web uses hardcoded colors, theme it to match mobile's.

No major refactor on web — it's out of scope for tonight. Just confirm parity.

---

## Acceptance criteria

### Sprint 5 (React Query)

1. `@tanstack/react-query` installed in `apps/mobile` and `apps/web`, listed as `peerDependencies` in `packages/api`
2. `packages/api/src/query-keys.ts` exports a `queryKeys` factory covering all major data types
3. `packages/api/src/hooks.ts` has at least 8 query hooks and 3 mutation hooks
4. All hooks exported from `@skyhub/api`
5. `QueryProvider` wraps both mobile and web root layouts
6. Exactly 1 existing screen refactored to use a query hook instead of `useState` + `useEffect` (proof of concept)
7. Mutations invalidate the right query keys

### Sprint 6 (Nav shell)

8. Mobile tab bar uses `accentColor` for active, `palette.textSecondary` for inactive, `palette.background` for bg
9. Every `_layout.tsx` inside `apps/mobile/app/(tabs)/*/` has themed `screenOptions`
10. `<ScreenContainer>` is used in at least 3 tab index screens
11. Dark mode toggle in settings immediately updates the entire navigation chrome — no white flashes
12. `apps/mobile/app.json` has `scheme: "skyhub"` for deep linking
13. Navigating between tabs in dark mode shows zero white backgrounds at any point

## Self-test

```bash
# 1. React Query installed
node -e "console.log(require('apps/mobile/package.json').dependencies['@tanstack/react-query'])"
node -e "console.log(require('apps/web/package.json').dependencies['@tanstack/react-query'])"

# 2. Hooks exported
node -e "const api = require('@skyhub/api'); console.log(['useAirports','useMe','useCreateAirport','queryKeys'].map(k => \`\${k}: \${k in api}\`).join('\\n'))"

# 3. Dark mode visual test (manual)
# - Open app, toggle dark mode in settings
# - Navigate through all 6 tabs
# - Confirm tab bar / headers / screens all change colors together
# - Zero white rectangles anywhere
```

## Commits

Two commits — one per sprint, landed sequentially:

```
infra(sprint-5): react-query + query keys + hooks + provider

infra(sprint-6): themed navigation shell + ScreenContainer adoption + deep linking
```

## What this sprint does NOT do

- **Does not refactor every screen to use hooks** — one screen as proof of concept only
- **Does not refactor every screen to use `<ScreenContainer>`** — just the tab index screens
- **Does not replace `SpotlightDock` with standard Expo Router tabs** — keep the custom dock, just theme it and the hidden standard tabs underneath
- **Does not add optimistic updates or offline mutations** — those are React Query advanced features for a later session
- **Does not touch the WatermelonDB sync layer** — that's an entirely separate system

## Why combine 5 and 6

Both sprints wrap the root layout once. Both update a small handful of screens as proof of concept. Both benefit from being tested together because the QueryProvider boot order matters relative to the theme provider and auth guard. Doing them in separate sessions means doing the "wrap the root and verify nothing broke" step twice.

The order inside the combined sprint is fixed: Sprint 5 first (data layer), Sprint 6 second (visual chrome). If Sprint 5 hits a surprise and runs long, you can commit 5 and pick up 6 in a follow-up without losing progress — the phase boundaries are designed to allow this.
