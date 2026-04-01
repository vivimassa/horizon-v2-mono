---
name: horizon-frontend
description: Enforce the SkyHub design system when building or modifying any React Native or Next.js component. Use whenever creating, editing, styling, or refactoring any UI component, screen, modal, card, list, or visual element. Trigger on mentions of "styling", "UI", "layout", "component", "dark mode", "theme", "colors", "Gluestack", "NativeWind", or any SkyHub module name (Home, Network, Flight Ops, Ground Ops, Crew Ops, Settings).
---

# SkyHub — Frontend Design System

## Design Philosophy
Clean, elevated surfaces with depth through **shadows + background tiers**. No glassmorphism, no backdrop-blur. Subtle gradient allowed at page level only (PageShell). Every screen must feel like a polished native iOS/Android app — not a wireframe with data in it. Light and dark mode mandatory on every component.

**The "looks good" test:** If a screen is just flat gray rectangles with text, it's not done. Every card needs shadow. Every section needs hierarchy. Accent color must be visible on every screen.

---

## Color System
- Light page: `#ffffff` → subtle gradient to `#f5f5f5` at bottom | Card: `#f5f5f5` | Hover: `#ebebeb`
- Dark page: `#1a1a1a` → subtle gradient to `#141414` at bottom | Card: `#252525` | Hover: `#303030`
- All colors via `useTheme()` hook → `palette.xxx`
- NEVER hardcode hex values — always use palette tokens
- Status chips from `colors.status` object (both light and dark variants)

### Page Background Gradient
Every screen's root should use a subtle vertical gradient via `PageShell` component:
```tsx
// Light: '#ffffff' → '#f5f5f5'   Dark: '#1a1a1a' → '#141414'
<LinearGradient colors={isDark ? ['#1a1a1a', '#141414'] : ['#ffffff', '#f5f5f5']} style={{ flex: 1 }}>
```
This prevents the "flat white wall" look. The gradient is barely perceptible but removes visual monotony.

---

## Shadow System (CRITICAL — this is what makes SkyHub look premium)

Every elevated surface MUST have a shadow. No exceptions. Import from `packages/ui/src/theme/shadows.ts`:

```ts
export const shadowClasses = {
  card: 'shadow-sm',          // Default card elevation
  cardPressed: 'shadow-none', // Pressed state — flat
  floating: 'shadow-xl',      // Modals, FABs, dropdowns
  sticky: 'shadow-sm',        // Tab bar, sticky headers
  input: 'shadow-sm',         // Search bars, inputs
}

// Native fallback (NativeWind shadow classes inconsistent on Android):
export const shadowStyles = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
    android: { elevation: 2 },
    default: {},
  }),
  // ... same pattern for cardPressed, floating, sticky, input
}
```

### Shadow Rules
- Every `<Card>` component: `shadows.card` always applied
- Cards on press: animate to `shadows.cardPressed` (shadow shrinks = "pushed in" feel)
- Search inputs: `shadows.input` + `palette.card` background (never just a border)
- Tab bar: `shadows.sticky` on the top edge
- Modal overlays: `shadows.floating`
- Dark mode: shadows still apply but are less visible naturally — that's fine

---

## Accent Color (USE AGGRESSIVELY)
- Dynamic per-tenant, stored in MongoDB `operator.settings.accentColor`
- Accessed via `useTheme().accentColor`
- Default: `#1e40af` (blue)

### Where accent MUST appear (every screen should have 3+ accent touches):
- **Active tab indicator** — bottom bar dot or underline
- **Primary buttons** — solid accent background, white text
- **Section header left bar** — 3px wide, accent color, rounded, left edge of section title
- **Active list item** — `accentColor + 8% opacity` background tint
- **Stat numbers** — key metrics displayed in accent color
- **Links / tappable text** — accent color instead of default text
- **Toggle/switch active state** — accent color thumb
- **Search icon when focused** — accent color
- **Badge dots** — unread/active indicators in accent

### Accent tint helper:
```ts
export function accentTint(accentColor: string, opacity: number): string {
  const r = parseInt(accentColor.slice(1, 3), 16)
  const g = parseInt(accentColor.slice(3, 5), 16)
  const b = parseInt(accentColor.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}
```

---

## Typography (STRICT — from project rules document)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title | 20px | 600 (semibold) | One per screen |
| Section heading | 15px | 700 (bold) | letterSpacing: -0.3 |
| Section subtitle | 12px | 400 | textSecondary color |
| Panel header | 15px | 500 (medium) | |
| Card title | 13px | 500 (medium) | |
| Card description | 11px | 400 | textSecondary color |
| Body / labels | 14px | 400 | Default for content |
| Secondary / hints | 13px | 400 | textSecondary |
| Field labels | 12px | 600 | UPPERCASE, letterSpacing: 0.5 |
| Captions / meta | 12px | 400 | textSecondary |
| Badges | 11px | 600 | MINIMUM — never below 11px |
| Stat numbers | 18px | 600 | For KPI values |
| Tab labels | 11px | 600 | Bottom tab bar |

- Import all sizes from `packages/ui/src/theme/typography.ts`
- NEVER use inline fontSize — always reference the token
- NEVER go below 11px for any visible text
- Every screen must use at least 3 distinct typography levels for visual hierarchy

---

## Component Library — Gluestack UI v3

SkyHub uses **Gluestack UI v3** as its accessible primitive layer. Components live in our codebase at `packages/ui/src/gluestack/`, not as an npm dependency (copy-paste model).

### What Gluestack provides (DO NOT rebuild these):
- **Forms:** Button, Input, Textarea, Select, Checkbox, Radio, Switch, Slider, FormControl
- **Overlays:** Modal, Actionsheet, AlertDialog, Drawer, Tooltip, Popover, Menu
- **Feedback:** Toast (useToast), Progress, Spinner
- **Display:** Accordion, Avatar

### What SkyHub builds custom (Gluestack doesn't cover these):
- Card, SectionHeader, ListItem, SearchInput, StatusChip, EmptyState, Badge, Icon, PageShell

### Import rules:
- Screen files import ONLY from `@horizon/ui` — never from `@gluestack-ui/*` directly
- SkyHub wrapper components (Button, SearchInput) import from `../gluestack/` internally
- All Gluestack components re-exported through `packages/ui/src/gluestack/index.ts`
- Gluestack default theme overridden with SkyHub tokens in provider config

### Restyling Gluestack components in screens:
```tsx
<Modal>
  <ModalBackdrop />
  <ModalContent className="bg-[#f5f5f5] dark:bg-[#252525] rounded-xl border border-[#e8e8e8] dark:border-white/10 p-0">
    <ModalHeader className="px-4 pt-4 pb-2">...</ModalHeader>
    <ModalBody className="px-4 py-2">...</ModalBody>
    <ModalFooter className="px-4 pb-4 pt-2 gap-3">
      <Button variant="secondary" title="Cancel" onPress={onClose} />
      <Button variant="primary" title="Confirm" onPress={onConfirm} />
    </ModalFooter>
  </ModalContent>
</Modal>
```

---

## Styling Rules

### NativeWind className — PRIMARY method
- Use NativeWind `className` props for all styling
- NO `StyleSheet.create()` in component files
- Exception: `shadowStyles` in `theme/shadows.ts` uses Platform.select for native shadows
- Exception: dynamic runtime values (accentColor, status colors) via `style={{ backgroundColor: accentColor }}`

### Corner Radius
- Cards, large panels: 12px (`rounded-xl`)
- Inputs, buttons, inner cards: 10px (`rounded-[10px]`)
- Tags, badges, chips: 6px (`rounded-md`)
- NEVER use 0 (sharp corners) on any visible element

### Borders
- 0.5px or 1px max on containers
- Use `palette.border` or `palette.cardBorder`
- Visible in BOTH light and dark mode (test this)

### Touch Targets
- Minimum 44px × 44px (Apple HIG)
- Use `hitSlop` prop to expand small visual elements to 44px touch area
- All interactive elements need press feedback (opacity or background change)
- All press animations: 150ms duration

---

## Icon System (CRITICAL — prevents emoji/inconsistency)

### Single Source: `lucide-react-native` + `react-native-svg`
One library. One import path. Works on iOS, Android, AND Expo Web.

### `<Icon>` Wrapper — `packages/ui/src/components/Icon.tsx`
ALL icon usage goes through this wrapper. No screen file ever imports from `lucide-react-native` directly.

Props: `icon: LucideIcon`, `size?: 'sm'|'md'|'lg'|'xl'` (16/20/24/32px), `color?: string`, `accentActive?: boolean`
Default color: `palette.textSecondary`. StrokeWidth always 1.75.

### Domain Icon Map — `packages/ui/src/theme/icons.ts`
Every airline concept has one assigned Lucide icon. Screens reference `domainIcons.airport`, `domainIcons.flight`, etc. — never choose icons ad-hoc.

### Icon Color Rules
- Default: `palette.textSecondary`
- Active / selected: `accentColor` via `accentActive` prop
- Destructive: status cancelled text color (red)
- Disabled: `palette.textTertiary`
- Inside primary buttons: `#ffffff`
- NEVER use `palette.text` for icons — they should be visually lighter than text

### ABSOLUTE PROHIBITIONS
- **NEVER use emoji** — not as icons, not as decorators, not as placeholders. Zero emoji in codebase.
- **NEVER use `@expo/vector-icons`** or `react-native-vector-icons`
- **NEVER import from `lucide-react-native` in screen files** — use `<Icon>` wrapper or `domainIcons`
- **NEVER use `lucide-react`** (web-only) — `lucide-react-native` works on web via `react-native-svg`

---

## Primitive Component Specs

### `<Card>` — The Foundation
Every grouped content block wraps in `<Card>`. Never render raw content directly on page background.
```
Background: palette.card | Border: 0.5px palette.cardBorder | Radius: 12px (rounded-xl)
Shadow: shadows.card (ALWAYS) | Padding: 12px (compact) | 16px (standard)
Press state: scale 0.98 + shadows.cardPressed with 150ms spring
```

### `<SectionHeader>` — Groups of Cards
```
Row: [3px accent bar, 16px tall, rounded-full] + [title 15px bold] + [optional right action in accent]
Margin: mt-6 mb-2 (first on page: mt-0 mb-2)
```

### `<ListItem>` — Rows Inside Cards
```
Row: [left icon 36px] + [title+subtitle, flex-1] + [right accessory: chevron / chip / text]
Min height: 44px | Padding: px-3 py-2.5 | Separator: 0.5px inset (skip on last)
Press: backgroundHover | Active: accentTint(0.08)
```

### `<SearchInput>` — Premium Search (wraps Gluestack Input)
```
Background: palette.card | Border: 0.5px | Radius: 10px | Shadow: shadows.input | Height: 40px
Left icon: Search 18px (textTertiary → accentColor on focus) | Right: clear button when non-empty
```

### `<StatusChip>` — Compact Status Indicator
```
Padding: px-2 py-0.5 | Radius: 6px | Font: 11px weight 600
Colors: getStatusColors(status, isDark) — ALWAYS pair bg + text
```

### `<Button>` — SkyHub Button (wraps Gluestack Button)
```
Primary: solid accentColor bg, white text, shadow | Secondary: transparent, accent text, accent border
Ghost: transparent, accent text, no border | Destructive: red tint bg, red text
Min height: 44px (md) or 36px (sm) | Radius: 10px | Loading: Spinner replaces text
```

### `<EmptyState>` — When List Has No Data
```
Center aligned: icon 32px (xl) in textTertiary + title 14px medium textSecondary + subtitle 12px textTertiary
Optional CTA button below
```

### `<PageShell>` — Screen Wrapper
```
Root: LinearGradient (#fff→#f5f5f5 light, #1a1a1a→#141414 dark)
SafeAreaView + title (20px semibold) + optional subtitle (12px textSecondary)
Scrollable content with padding: px-4 pb-4 pt-2
```

---

## Status Chips
- On time: light `#dcfce7` text `#166534` | dark `rgba(22,163,74,0.15)` text `#4ade80`
- Delayed: light `#fef3c7` text `#92400e` | dark `rgba(245,158,11,0.15)` text `#fbbf24`
- Cancelled: light `#fee2e2` text `#991b1b` | dark `rgba(220,38,38,0.15)` text `#f87171`
- Departed: light `#dbeafe` text `#1e40af` | dark `rgba(30,64,175,0.15)` text `#60a5fa`
- Diverted: light `#f3e8ff` text `#6b21a8` | dark `rgba(124,58,237,0.15)` text `#a78bfa`
- Scheduled: light `#f5f5f5` text `#555555` | dark `#303030` text `#999999`
- All from `packages/ui/src/theme/colors.ts` → `colors.status`

---

## Component Architecture Limits

- **Maximum 400 lines** per component file — flag at 300, split at 400
- **Maximum 8 useState** hooks — beyond that, use Zustand store
- **Extract business logic** into pure functions in `packages/shared/src/logic/`
- **React.memo** on ALL list item components (FlatList renderItem must be memoized)
- **Skia canvas** for any Gantt/timeline rendering — never View-based absolute positioning
- **No god components** — if it has data fetching + business logic + complex UI, split it

### Splitting Pattern
```
MyFeature/
├── MyFeature.tsx          # Shell (<400 lines) — layout + composition
├── useMyFeature.ts        # Hook — data fetching, state, handlers
├── MyFeatureList.tsx       # Sub-component for list section
├── MyFeatureDetail.tsx     # Sub-component for detail section
└── myFeature.logic.ts     # Pure functions — testable without React
```

---

## Layout Patterns

### Page Layout
- Root: PageShell with LinearGradient background
- Padding: horizontal 16px, top 12px, bottom 16px
- Use `ScrollView` with `contentContainerStyle` for padding

### Section Spacing
- Between sections: 24px gap
- Between cards within a section: 8px gap
- SectionHeader to first card: 8px
- Inside card between rows: 0px (separators handle spacing)

### Responsive Layout (Web vs Mobile)
```ts
import { useWindowDimensions } from 'react-native'
export function useResponsive() {
  const { width } = useWindowDimensions()
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    columns: width < 768 ? 1 : width < 1024 ? 2 : 3,
  }
}
```

**Mobile (< 768px):** Single column. Full-width cards. Bottom tab nav. Padding 16px.
**Tablet (768–1024px):** 2-column grid. Bottom tab dock. Padding 20px.
**Desktop (1024px+):** 3-column or sidebar+content. Collapsible bottom dock. Padding 24px. Max content 1200px.

---

## Dark Mode Checklist (MANDATORY before any component is complete)
- [ ] All text uses `palette.text` or `palette.textSecondary` — no hardcoded colors
- [ ] All backgrounds use `palette.background` or `palette.card`
- [ ] Status chips use correct dark variant from `colors.status`
- [ ] Borders use `palette.border` — visible in both modes
- [ ] Accent color uses `accentColor` from theme store
- [ ] Shadows still applied (subtle in dark — that's correct)
- [ ] Page gradient uses dark variant
- [ ] No #fff, #000, rgb(), or rgba() hardcoded anywhere

---

## Visual Polish Checklist (MANDATORY — prevents "wireframe look")
- [ ] Every card has `shadows.card` applied
- [ ] Accent color visible in 3+ places on every screen
- [ ] At least 3 typography levels used (title → heading → body minimum)
- [ ] SectionHeaders have accent left bar
- [ ] Empty states shown for empty lists (never blank space)
- [ ] Search inputs have shadow + card background (not just border)
- [ ] List items have press feedback
- [ ] Page uses gradient background (not flat white/black)
- [ ] Active/selected states use accent tint background
- [ ] ALL icons use `<Icon>` wrapper — zero emoji, zero raw lucide imports
- [ ] Icons use `domainIcons` map for airline concepts
- [ ] Icon colors: textSecondary default, accentColor active, white in primary buttons

---

## File Structure
```
packages/
  ui/                      → SHARED design system (@horizon/ui — both apps import from here)
    src/
      components/          → SkyHub primitives (Card, SectionHeader, ListItem, Button, Icon, etc.)
      gluestack/           → Gluestack v3 accessible primitives (Modal, Select, Toast, etc.)
      theme/               → Token files (colors.ts, typography.ts, spacing.ts, shadows.ts, icons.ts)
      stores/              → Zustand stores (useThemeStore.ts)
      hooks/               → Shared hooks (useTheme.ts, useResponsive.ts)
  shared/
    src/
      logic/               → Pure business logic (no React imports)
      types/               → TypeScript interfaces
      constants/           → Static reference data

apps/
  mobile/                  → Expo app (imports from @horizon/ui)
    app/(tabs)/            → Tab screens
  web/                     → Next.js app (imports from @horizon/ui)
    src/app/               → App Router pages
```

---

## Batch Migration Pattern (V1 → V2)

### Per-batch prompt structure:
1. **List the screens** being migrated (e.g., "Airport Database, Aircraft Fleet, Crew List")
2. **Reference V1 feature set** — describe what V1 does, not how it's coded
3. **Apply SkyHub design system** — every screen uses Card, SectionHeader, ListItem, SearchInput, StatusChip from `@horizon/ui`
4. **Data layer** — define the MongoDB document shape + WatermelonDB model for each entity
5. **Responsive check** — every screen must work at mobile (375px) and desktop (1200px) widths

### After each batch, verify:
- Dark mode toggle: every screen correct in both modes
- Accent color: change to a contrasting preset, verify nothing breaks
- Responsive: test at 375px, 768px, 1200px widths
- Shadow visibility: cards must be visually elevated, not flat
- Typography hierarchy: 3+ levels per screen
- Empty states: what does each screen look like with zero data?
- Icons: all from `<Icon>` wrapper + `domainIcons` map, zero emoji, consistent size/color
