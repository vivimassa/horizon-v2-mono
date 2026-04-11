# Sprint 3 — Component Library Extraction

**Estimated time:** 5–6 hours in a focused session (the original plan's 3–4h estimate was too optimistic — see below)
**Risk level:** High — pixel-match risk. If rushed, screens will look subtly broken.
**Do NOT start this sprint if you don't have 5+ hours**

---

## Context

This is Session C of the infrastructure hardening plan. Sessions already completed on `main`:

- **Sprint 1** (`80d8e4e`) — ESLint + Prettier + Husky
- **Sprint 2** (`c1ce06c`) — `@skyhub/env` Zod validation
- **Sprint 7** (`2b8c076`) — GitHub Actions CI
- **Sprint 4** — Auth + operator ID retrofit (assumed done by the time you start this, but this sprint does not technically depend on Sprint 4)

**Repo:** `C:\Users\ADMIN\horizon-v2-mono`
**Package namespace:** `@skyhub/*`
**Design system canonical reference:** `.claude/skills/horizon-frontend/SKILL.md` — **read this before writing ANY UI code**

### What you're building and why

The monorepo currently has ~50 mobile screens in `apps/mobile/app/(tabs)/settings/`. They were all built individually, and each one rebuilds the same UI patterns from raw `<View>`, `<Text>`, `<Pressable>` primitives with inline styles. Fonts are frequently hardcoded as `{ fontSize: 20, fontWeight: '700' }` instead of using typography tokens. The design system already has the tokens (`packages/ui/src/theme/`) and half the components — but half is missing, and screens don't use what does exist.

This sprint:

1. Adds the **8 missing components** to `packages/ui/src/components/`
2. Refactors exactly **4 reference screens** to use the shared components (proof of concept, not a full migration)
3. Produces a `COMPONENTS.md` catalog so future screens follow the pattern

### Reality check — what already exists

Verified by exploration before tonight's planning session. **Do not duplicate these — read them first:**

**Components already in `packages/ui/src/components/`:**

- `Card.tsx` — has `variant="glass"` support ✓
- `Button.tsx` — has primary/secondary/ghost/destructive variants. **Missing:** `affirmative` (green `#06C270`). Quick win — add it as the first 5 minutes of this sprint.
- `Badge.tsx`
- `ListItem.tsx` — maps to the plan's "ListItemRow" concept
- `SectionHeader.tsx` — maps to "SectionGroupHeader"
- `SearchInput.tsx` — maps to "SearchBar"
- `EmptyState.tsx`
- `Icon.tsx` — Lucide wrapper
- `PageShell.tsx`
- `SpotlightDock.tsx` — custom mobile tab bar (used instead of standard)
- `NavTile.tsx`, `Tooltip.tsx`, `FilterPanel.tsx`, `FilterSection.tsx`, `DateRangePicker.tsx`, `DropdownSelect.tsx`, `MultiSelect.tsx`, `StatusChip.tsx`

**Theme tokens already exist (`packages/ui/src/theme/`):**

- `colors.ts` — palette, accent, glass helpers
- `typography.ts` — **has `TypographyKey` variant system already** with 16 predefined styles (`pageTitle`, `sectionHeading`, `panelHeader`, `body`, `fieldLabel`, `badge`, etc.) — your `<Text>` component just needs to consume these, not invent new ones
- `spacing.ts` — `buttonSize`, `badgeSize`, page padding, etc.
- `shadows.ts` — 6-level elevation system

**Barrel export** (`packages/ui/src/index.ts`): currently exports Card, SectionHeader, ListItem, SearchInput, StatusChip, Button, EmptyState, Badge, Icon, PageShell, SpotlightDock, NavTile, Tooltip, FilterPanel, FilterSection, DateRangePicker, DropdownSelect, MultiSelect, plus gluestack + theme.

### What's actually missing (the 8 components you need to create)

1. **`<Text variant="...">`** — the most important one. Consumes `TypographyKey` from `packages/ui/src/theme/typography.ts`. Auto-applies `palette.textSecondary` for inherently-muted variants.
2. **`<FieldRow>`** — label + value row with editing mode. Every detail screen needs this. Extract from the existing `Field()` helper in `airport-detail.tsx`.
3. **`<ListScreenHeader>`** — back button + icon badge + title + count + add button. Combine existing pieces.
4. **`<DetailScreenHeader>`** — back + icon badge + title/subtitle + edit/save/cancel/delete action buttons.
5. **`<TabBar>`** — horizontal scrollable tabs with icon + label, active-tab indicator.
6. **`<Divider>`** — horizontal or vertical line using `palette.border`.
7. **`<TextInput>`** — form input wrapper (different from `<SearchInput>`) with label, error, hint, icon slots.
8. **`<ScreenContainer>`** — root wrapper with safe area + theme background. **Needed for Sprint 6.**

---

## Pre-flight — READ THESE FIRST

1. `.claude/skills/horizon-frontend/SKILL.md` — **critical**. This is the canonical design system reference.
2. `CLAUDE.md` — Critical Rules sections 1–7 (design system, color, shadows, typography, component dimensions, glass panels, section headers).
3. `packages/ui/src/theme/colors.ts` — palette structure, accent helpers
4. `packages/ui/src/theme/typography.ts` — `TypographyKey` enum and the 16 predefined styles
5. `packages/ui/src/theme/spacing.ts` — `buttonSize`, `badgeSize`, page padding tokens
6. `packages/ui/src/theme/shadows.ts` — 6-level elevation (`card`, `cardHover`, `raised`, `floating`, `modal`, `overlay`)
7. `packages/ui/src/components/Card.tsx` — reference for how existing components consume tokens
8. `packages/ui/src/components/Button.tsx` — reference for variant pattern (and to add `affirmative`)
9. `packages/ui/src/index.ts` — the barrel you'll be updating

**The 6 reference screens** (all in `apps/mobile/app/(tabs)/settings/`):

- `airports.tsx` (~185 lines) — list screen with SectionList + country grouping
- `carrier-codes.tsx` (~177 lines) — list screen with FlatList
- `airport-detail.tsx` (~505 lines) — detail screen with tabs + edit mode + custom `Field()`/`ToggleField()` helpers
- `carrier-code-detail.tsx` (~362 lines) — detail screen with field rows
- `activity-codes.tsx` (~242 lines) — list screen with grouped data
- `activity-code-detail.tsx` (~412 lines) — detail screen with complex forms

Read all 6 before writing any component code. You're extracting patterns — you need to see them first.

---

## Task breakdown

Use `TaskCreate` to split into **5 phases**. **Phase A is read-only** — do not start editing until you've finished reading.

### Phase 0 — Quick win (5 min)

Add the `affirmative` variant to `Button.tsx`:

- Background: `#06C270`
- Text: white
- Hover/pressed variants per the XD core design system
- Add to the `variant` prop type union
- Export nothing new — the barrel already exports Button

Confirm existing usages don't break (`grep -rn "affirmative" apps/ packages/`).

### Phase A — Pattern discovery (read only, 30 min)

Read the 6 reference screens completely. As you read, write down (in a scratch file or a TodoWrite task) every repeated pattern you see. You WILL find at least these (but look for more):

- List screen header block (back + icon badge + title + count + add)
- Search bar with clear button
- Detail screen header (back + icon badge + title + edit/save/cancel/delete toolbar)
- Horizontal tab bar with icon + label
- Field rows (label + value, editable in edit mode) — currently reinvented as `Field()` and `ToggleField()` helpers in `airport-detail.tsx`
- Section group headers
- List item rows with left icon, middle title+subtitle, right chevron
- Empty state for empty lists
- Pressable press-feedback pattern

Confirm your discovered patterns match the 8 missing components listed above. If you find additional patterns, create additional components — the list is a floor, not a ceiling.

### Phase B — Build the 8 components (≈ 2 hours)

For each component below:

1. Match the **exact** visual output of the cleanest existing usage in the reference screens
2. Use `useAppTheme()` or `useTheme()` — match the import path the existing components use
3. All colors from `palette.xxx` — **zero hardcoded hex values** in component files
4. Keep each component under 200 lines
5. Dark mode must work — test with `useThemeStore().toggleColorMode()`

#### B1. `<Text variant="...">`

Props:

```ts
type TextVariant =
  | 'pageTitle' // 20px, weight 600
  | 'sectionHeading' // 15px, weight 700
  | 'panelHeader' // 15px, weight 500
  | 'body' // 14px, weight 400
  | 'secondary' // 13px, weight 400, secondary color
  | 'fieldLabel' // 12px, weight 600, uppercase
  | 'caption' // 12px, weight 400, secondary color
  | 'badge' // 11px, weight 600
  | 'cardTitle' // 13px, weight 500
  | 'cardDescription' // 11px, weight 400, secondary color
  | 'stat' // 18px, weight 600

interface TextProps extends RNTextProps {
  variant?: TextVariant
  muted?: boolean // force secondary color
}
```

**Reuse `TypographyKey` from `packages/ui/src/theme/typography.ts`** — do not redefine the sizes. Auto-apply `palette.textSecondary` for inherently muted variants.

**Minimum font size: 13px (not 11px).** Per user memory: `~/.claude/projects/.../memory/feedback_min_font_size.md`. The CLAUDE.md default of 11px is overridden — the user has clarified multiple times that UI text must be 13px minimum. If your variant list has anything below 13px, bump it to 13px before writing.

#### B2. `<FieldRow>`

Extract from `airport-detail.tsx`'s `Field()` helper. Props:

```ts
interface FieldRowProps {
  label: string
  value?: string | number | boolean | null
  editing?: boolean
  onChangeText?: (text: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'toggle' | 'select' | 'readonly'
  options?: { label: string; value: string }[]
  suffix?: string
  icon?: React.ReactNode
}
```

In view mode: label left, value right. In edit mode: label top, `<TextInput>` (or `<Toggle>`) below.

#### B3. `<ListScreenHeader>`

```ts
interface ListScreenHeaderProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  title: string
  count: number
  filteredCount?: number
  countLabel?: string
  onBack: () => void
  onAdd?: () => void
  addLabel?: string
  rightAction?: React.ReactNode
}
```

Extract from `carrier-codes.tsx` header area. Use `accentTint()` helper for the icon background if it exists in `colors.ts`; otherwise inline via `accentColor + '1A'` (10% alpha).

#### B4. `<DetailScreenHeader>`

```ts
interface DetailScreenHeaderProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  title: string
  subtitle?: string
  onBack: () => void
  editing?: boolean
  onEdit?: () => void
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  saving?: boolean
  status?: { label: string; tone: 'success' | 'danger' | 'warning' | 'info' }
}
```

Use **13px SemiBold pill** for the status badge (detail header exception — per CLAUDE.md and memory `feedback_badge_size_header.md`).

#### B5. `<TabBar>`

```ts
interface Tab {
  key: string
  label: string
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
}
interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (key: string) => void
}
```

Active tab: accent-colored text + 2px bottom border. Inactive: `palette.textSecondary`. Use `<ScrollView horizontal>` with `showsHorizontalScrollIndicator={false}`.

#### B6. `<Divider>`

```ts
interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  marginY?: number
  marginX?: number
}
```

Color: `palette.border`. 1px. Trivial component — 20 lines max.

#### B7. `<TextInput>`

```ts
interface TextInputProps extends RNTextInputProps {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}
```

40px height, 8px radius, 14px Regular text, 12px Medium label. Focus state: accent border + 2px ring. Error state: red border + error message below.

#### B8. `<ScreenContainer>`

```ts
interface ScreenContainerProps extends ViewProps {
  safeBottom?: boolean // default true
  padded?: boolean // default true
  padTop?: boolean // default true
}
```

Uses `useSafeAreaInsets()` from `react-native-safe-area-context`. Applies `palette.background`, page padding from `spacing.ts`. This component is **also needed by Sprint 6** — create it as part of Sprint 3.

### Phase C — Refactor exactly 4 reference screens (≈ 1.5 hours)

Refactor these 4, in order:

1. `apps/mobile/app/(tabs)/settings/airports.tsx`
2. `apps/mobile/app/(tabs)/settings/carrier-codes.tsx`
3. `apps/mobile/app/(tabs)/settings/airport-detail.tsx`
4. `apps/mobile/app/(tabs)/settings/carrier-code-detail.tsx`

**Pixel-identical rule:** after refactoring, each screen MUST look identical to before. Same colors, spacing, fonts, shadows. The only change is in the code — shared components replacing inline JSX. If you notice the screen looks different, you missed a detail.

**Do NOT refactor all 50 screens.** Just these 4 as a proof of concept. Future screens use the components from the start; existing screens migrate gradually.

After each refactor:

- Start the app (`cd apps/mobile && npm start`)
- Open the screen
- Toggle dark mode
- Compare against a before screenshot (take one in Phase A before editing)
- Only mark complete when the visual match is confirmed

### Phase D — Update barrel exports

Add every new component to `packages/ui/src/index.ts`. Export order: screen scaffolding → data display → primitives. Keep the existing exports.

### Phase E — Document the catalog

Create `packages/ui/COMPONENTS.md` with sections:

- **Screen scaffolding** — `<ListScreenHeader>`, `<DetailScreenHeader>`, `<SearchInput>`, `<TabBar>`, `<ScreenContainer>`
- **Data display** — `<FieldRow>`, `<ListItem>`, `<SectionHeader>`, `<StatusChip>`, `<Badge>`
- **Primitives** — `<Text variant="...">`, `<Card>`, `<Button>` (all 5 variants including new `affirmative`), `<TextInput>`, `<SearchInput>`, `<Divider>`, `<Icon>`, `<EmptyState>`

Include a short **"When building a new list screen"** code sample and a **"When building a new detail screen"** code sample using the shared components. This catalog becomes the reference for all future screen work.

---

## Acceptance criteria

1. All 8 new components exist in `packages/ui/src/components/` and are exported from `@skyhub/ui`
2. `Button` has 5 variants — `primary`, `secondary`, `ghost`, `destructive`, `affirmative`
3. Zero hardcoded `fontSize:` in the 4 refactored screens (search with `grep -n "fontSize:" apps/mobile/app/\(tabs\)/settings/{airports,carrier-codes,airport-detail,carrier-code-detail}.tsx`)
4. All 4 refactored screens render pixel-identical to the pre-refactor state in both light and dark mode
5. `packages/ui/COMPONENTS.md` exists with sections and two usage examples
6. `npm run lint` passes (new warnings allowed, no new errors)
7. `ScreenContainer` is ready for Sprint 6 to consume
8. The user memory `feedback_min_font_size.md` is respected — no text below 13px in any new component

## Self-test commands

```bash
# 1. Zero hardcoded font sizes in refactored screens
grep -n "fontSize:" apps/mobile/app/\(tabs\)/settings/airports.tsx apps/mobile/app/\(tabs\)/settings/carrier-codes.tsx apps/mobile/app/\(tabs\)/settings/airport-detail.tsx apps/mobile/app/\(tabs\)/settings/carrier-code-detail.tsx | wc -l
# Expected: 0

# 2. All new components exported
node -e "const ui = require('@skyhub/ui'); ['Text','FieldRow','ListScreenHeader','DetailScreenHeader','TabBar','Divider','TextInput','ScreenContainer'].forEach(k => console.log(k, k in ui ? 'OK' : 'MISSING'))"

# 3. Lint still passes
cd packages/ui && npm run lint

# 4. Visual check (manual)
# Open each refactored screen in the app, compare to a before screenshot, toggle dark mode
```

## Commit

One commit at the end:

```
infra(sprint-3): extract 8 shared components + refactor 4 reference screens
```

Body mentions: the 8 new components, the Button `affirmative` variant, the 4 screens refactored pixel-identically, and the new `COMPONENTS.md` catalog.

## What this sprint does NOT do

- **Does not refactor all 50 settings screens** — only 4 as proof of concept
- **Does not redesign anything** — strict extraction, no visual changes
- **Does not touch web components** — web has its own shell components (see `apps/web/src/components/admin/**/*-shell.tsx`) and is out of scope tonight
- **Does not add animation, transitions, or new interactions** — use what the reference screens already do

## Common traps

- **Hardcoded 11px text** in components like `Badge` — bump to 13px per user memory, or you'll need another session later to fix it
- **Shadow color** — must be `#606170` (neutral blue-gray), NOT pure black. Pure black was a v1 mistake.
- **Card radius** — 12px (mobile override), not the XD default 8px
- **`accentColor`** — comes from `useTheme().accentColor`, dynamic per tenant. Never hardcode `#1e40af`.
- **Glass panel overuse** — `<Card variant="glass">` is only for hero/featured sections in dark mode. Not every card.
