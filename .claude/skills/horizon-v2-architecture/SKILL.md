# Horizon v2 — Architecture Guardrails

## Mandatory Rules — Enforced on EVERY file

### Component Size Limits
- **Maximum 400 lines per component file — NO exceptions**
- Maximum 8 `useState` hooks per component — use Zustand for complex state
- `React.memo` on ALL list item components
- Extract business logic into pure functions in `packages/logic/`
- **No business logic in component files** — components are render-only

### Package Boundaries
- Shared components in `packages/ui/` must have **zero platform-specific code**
  - No `Platform.select`, no web-only CSS, no mobile-only APIs
  - No `react-native` imports — use Tamagui primitives only
- Platform-specific code lives **ONLY** in `apps/web/` or `apps/mobile/`
- All API calls go through `packages/api/` — never raw `fetch` in components
- Types shared across packages go in `packages/types/`
- Constants shared across packages go in `packages/constants/`

### Styling
- Use Tamagui's `styled()` for all component variants — no inline style objects
- Every component must accept a theme prop implicitly through Tamagui's provider
- No `StyleSheet.create()` in shared packages — that's React Native-specific

### Interaction
- Minimum touch target: **44px** on all interactive elements
- All lists must use `FlatList` (mobile) or virtualized lists (web) for 50+ items
- Press feedback required on every tappable element

### TypeScript
- **No `any` types** — strict TypeScript throughout
- All exports must be explicitly typed
- Use `type` imports for type-only imports

### Package Dependency Graph
```
apps/web ─────┐
apps/mobile ──┤
              ├── @horizon/ui (Tamagui components)
              ├── @horizon/api (API client)
              ├── @horizon/logic (business logic)
              ├── @horizon/types (shared types)
              └── @horizon/constants (reference data)
              
server (standalone — no shared package deps)
```

### File Structure Convention
```
packages/ui/src/        → Tamagui design system primitives
packages/logic/src/     → Pure business logic (FDTL, IATA, pairing, weather)
packages/api/src/       → API client + request types
packages/types/src/     → Shared TypeScript interfaces
packages/constants/src/ → Static reference data
apps/mobile/app/        → Expo Router screens (file-based routing)
apps/web/app/           → Next.js App Router pages
server/src/             → Fastify + Mongoose
```
