---
name: horizon-frontend
description: Enforce the Horizon v2 design system when building or modifying any React Native component. Use whenever creating, editing, styling, or refactoring any UI component, screen, modal, card, list, or visual element. Trigger on mentions of "styling", "UI", "layout", "component", "dark mode", "theme", "colors", or any Horizon module name.
---

# Horizon v2 — Frontend Design System

## Design Philosophy
Clean, flat surfaces. No glassmorphism, no backdrop-blur, no gradients on mobile. Depth through background color tiers and subtle elevation. Light and dark mode mandatory on every component.

## Color System
- Light page: `#ffffff` | Card: `#f5f5f5` | Hover: `#ebebeb`
- Dark page: `#1a1a1a` | Card: `#252525` | Hover: `#303030`
- All colors via `useTheme()` hook → `palette.xxx`
- NEVER hardcode hex values — always use palette tokens
- Accent color is dynamic per-tenant via `useTheme().accentColor`
- Status chips from `colors.status` object (both light and dark variants)

## Typography (STRICT — from project rules document)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title | 20px | 600 (semibold) | One per screen |
| Section heading | 15px | 700 (bold) | letterSpacing: -0.3 |
| Section subtitle | 12px | 400 | textSecondary color |
| Card title | 13px | 500 (medium) | |
| Card description | 11px | 400 | textSecondary color |
| Body / labels | 14px | 400 | Default for content |
| Field labels | 12px | 600 | UPPERCASE, letterSpacing: 0.5 |
| Badges | 11px | 600 | MINIMUM — never below 11px |

- Import all sizes from `src/theme/typography.ts`
- NEVER use inline fontSize — always reference the token
- NEVER go below 11px for any visible text

## Component Rules

### Styling
- `StyleSheet.create()` for ALL styles — no inline style objects in render
- If a style needs dynamic values (theme colors), use `useMemo` to create style objects

### Corner Radius
- Cards, large panels: 12px
- Inputs, buttons, inner cards: 10px
- Tags, badges, chips: 6px
- NEVER use 0 (sharp corners) on any visible element

### Borders
- 0.5px or 1px max on containers
- Use `palette.border` or `palette.cardBorder`
- Visible in BOTH light and dark mode (test this)

### Touch Targets
- Minimum 44px × 44px (Apple HIG)
- Use `hitSlop` prop to expand small visual elements to 44px touch area
- All interactive elements need press feedback (opacity or background change)

### Icons
- `lucide-react-native` exclusively
- Minimum 16px, default 20px
- Color: `palette.textSecondary` default, `accentColor` when active

## Component Architecture Limits

- **Maximum 1000 lines** per component file — flag at 800, split at 1000
- **Maximum 10 useState** hooks — beyond that, use Zustand store
- **Extract business logic** into pure functions in `src/logic/`
- **React.memo** on ALL list item components (FlatList renderItem)
- **Skia canvas** for any Gantt/timeline rendering — never View-based absolute positioning
- **No god components** — if it has data fetching + business logic + complex UI, split it

### Splitting Pattern
```
MyFeature/
├── MyFeature.tsx          # Shell (<1000 lines) — layout + composition
├── useMyFeature.ts        # Hook — data fetching, state, handlers
├── MyFeatureList.tsx       # Sub-component for list section
├── MyFeatureDetail.tsx     # Sub-component for detail section
└── myFeature.logic.ts     # Pure functions — testable without React
```

## Dark Mode Checklist (MANDATORY)
- [ ] All text uses `palette.text` or `palette.textSecondary`
- [ ] All backgrounds use `palette.background` or `palette.card`
- [ ] Status chips use correct dark variant from `colors.status`
- [ ] Borders use `palette.border` — visible in both modes
- [ ] Accent color uses `accentColor` from theme store
- [ ] No hardcoded #fff, #000, rgb(), or rgba() anywhere
- [ ] Tested visually in both modes before committing

## Layout Patterns
- Page: paddingHorizontal 16, paddingTop 12
- Card: padding 12, borderRadius 12, background `palette.card`, border `palette.cardBorder`
- List items: paddingHorizontal 12, paddingVertical 10, gap 8
- Section gap: 16px between major sections
- Use `spacing` tokens from `src/theme/spacing.ts`

## File Structure
```
src/components/ui/       → Design system primitives (Button, Card, Badge, Input)
src/components/common/   → Shared domain components (StatusChip, FlightCard, CrewAvatar)
src/components/gantt/    → Skia-based Gantt rendering
src/theme/               → Token files (colors.ts, typography.ts, spacing.ts)
src/stores/              → Zustand stores (useThemeStore.ts)
src/logic/               → Pure business logic (no React imports)
```
