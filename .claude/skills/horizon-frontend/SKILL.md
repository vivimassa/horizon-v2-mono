---
name: horizon-frontend
description: Enforce the SkyHub design system when building or modifying any React Native or Next.js component. Use whenever creating, editing, styling, or refactoring any UI component, screen, modal, card, list, or visual element. Trigger on mentions of "styling", "UI", "layout", "component", "dark mode", "theme", "colors", "Gluestack", "NativeWind", or any SkyHub module name.
---

# SkyHub — Frontend Design System

## Design Foundation

Three merged layers: **Core Design System (XD)** for tokens + dimensions, **Stitch Glass** for premium dark-mode aesthetics, **SkyHub Overrides** for mobile accessibility.

---

## Color System

### Light Mode

| Token                         | Hex       | Usage                     |
| ----------------------------- | --------- | ------------------------- |
| `palette.background`          | `#FAFAFC` | Page background           |
| `palette.backgroundSecondary` | `#F7F7FA` | Secondary surfaces        |
| `palette.backgroundHover`     | `#F2F2F5` | Hover/pressed states      |
| `palette.text`                | `#1C1C28` | Primary text              |
| `palette.textSecondary`       | `#555770` | Secondary/muted text      |
| `palette.textTertiary`        | `#8F90A6` | Placeholder/disabled text |
| `palette.border`              | `#E4E4EB` | Container borders         |
| `palette.card`                | `#FFFFFF` | Card surfaces             |
| `palette.cardBorder`          | `#EBEBF0` | Card borders              |

### Dark Mode

| Token                         | Hex                      | Usage                          |
| ----------------------------- | ------------------------ | ------------------------------ |
| `palette.background`          | `#0E0E14`                | Page background (Stitch depth) |
| `palette.backgroundSecondary` | `#13131A`                | Secondary surfaces             |
| `palette.backgroundHover`     | `#1F1F28`                | Hover/pressed states           |
| `palette.text`                | `#F5F2FD`                | Primary text (warm white)      |
| `palette.textSecondary`       | `#8F90A6`                | Secondary text                 |
| `palette.textTertiary`        | `#555770`                | Placeholder/disabled           |
| `palette.border`              | `rgba(255,255,255,0.08)` | Container borders              |
| `palette.card`                | `#191921`                | Card surfaces                  |
| `palette.cardBorder`          | `rgba(255,255,255,0.06)` | Card borders                   |

### Status Colors (Vibrant XD)

| Status    | Light Text | Dark Text | Usage               |
| --------- | ---------- | --------- | ------------------- |
| On Time   | `#06C270`  | `#39D98A` | Flights on schedule |
| Delayed   | `#E67A00`  | `#FDAC42` | Delayed flights     |
| Cancelled | `#E63535`  | `#FF5C5C` | Cancelled flights   |
| Departed  | `#0063F7`  | `#5B8DEF` | Airborne flights    |
| Diverted  | `#00B7C4`  | `#73DFE7` | Diverted flights    |
| Scheduled | `#555770`  | `#8F90A6` | Future flights      |

NEVER hardcode hex in components. Always `palette.xxx` or `getStatusColors()`.

---

## Shadow System — 6 Levels

Shadow color: `#606170` (blue-gray). NOT black.

| Level | Name        | Y   | Blur | Usage                 |
| ----- | ----------- | --- | ---- | --------------------- |
| 01    | `card`      | 0.5 | 1    | Resting cards         |
| 02    | `cardHover` | 2   | 2    | Hovered cards, inputs |
| 03    | `raised`    | 4   | 4    | Dropdowns, popovers   |
| 04    | `floating`  | 8   | 8    | Floating panels       |
| 05    | `modal`     | 16  | 12   | Modals, dialogs       |
| 06    | `overlay`   | 20  | 16   | Top overlays, toasts  |

```tsx
import { shadowStyles } from '../theme/shadows'
// Usage:
<View style={{ ...shadowStyles.card }}>     // Level 01
<View style={{ ...shadowStyles.raised }}>   // Level 03
<View style={{ ...shadowStyles.floating }}> // Level 04
```

A card without shadow = REJECTED. No exceptions.

---

## Typography

Font: System (SF Pro on iOS, Roboto on Android). NEVER add custom fonts.

| Role            | Size | Weight         | Token                       |
| --------------- | ---- | -------------- | --------------------------- |
| Page title      | 20px | SemiBold (600) | `typography.pageTitle`      |
| Stat hero       | 24px | Bold (700)     | `typography.statLarge`      |
| Section heading | 15px | Bold (700)     | `typography.sectionHeading` |
| Body large      | 16px | Regular (400)  | `typography.bodyLarge`      |
| Body            | 14px | Regular (400)  | `typography.body`           |
| Lead/emphasis   | 14px | Bold (700)     | `typography.lead`           |
| Card title      | 13px | Medium (500)   | `typography.cardTitle`      |
| Label           | 12px | Medium (500)   | `typography.fieldLabel`     |
| Caption         | 12px | Regular (400)  | `typography.caption`        |
| Badge           | 11px | SemiBold (600) | `typography.badge`          |
| Tab label       | 11px | SemiBold (600) | `typography.tabLabel`       |

**Weight rules (from Core Design System):**

- **Bold** → headings, stats, section titles
- **SemiBold** → page title, badges, emphasis
- **Medium** → labels, buttons, card titles, nav items
- **Regular** → body, captions, descriptions

**ABSOLUTE MINIMUM: 11px.** The XD system uses 10px for tiny text — we override. Any text below 11px is REJECTED.

---

## Component Dimensions

### Buttons (from XD)

| Size | Height | Font        | Radius | Use                   |
| ---- | ------ | ----------- | ------ | --------------------- |
| `sm` | 24px   | 11px Medium | 8px    | Compact/toolbar       |
| `md` | 32px   | 12px Medium | 8px    | Standard              |
| `lg` | 40px   | 14px Medium | 8px    | Primary CTA           |
| `xl` | 48px   | 14px Medium | 10px   | Mobile full-width CTA |

Tokens: `buttonSize.sm`, `buttonSize.md`, `buttonSize.lg`, `buttonSize.xl` from `spacing.ts`.

### Badges (from XD)

| Size | Height | Font | Radius |
| ---- | ------ | ---- | ------ |
| `sm` | 20px   | 11px | 6px    |
| `md` | 24px   | 12px | 6px    |
| `lg` | 29px   | 14px | 8px    |

Tokens: `badgeSize.sm`, `badgeSize.md`, `badgeSize.lg`.

**Exception:** Status badges in detail page headers (Active/Inactive next to entity name) use **13px SemiBold** with `rounded-full` pill styling. These are visually prominent and benefit from the larger size.

### Cards

- Radius: 12px (mobile override of XD's 8px — rounder is better on touch)
- Padding: `compact` (12px) / `standard` (16px) / `spacious` (20px)
- Always has shadow from `shadowStyles`
- Supports `variant="glass"` for dark-mode hero sections
- Supports `elevation` prop: `'card'` (default) | `'raised'` | `'floating'`

### Inputs

- Height: 40px
- Radius: 8px (NativeWind `rounded-lg`)
- Font: 14px Regular
- Label: 12px Medium
- Border: `palette.border`, focus: `accentColor` with ring

### Touch Targets

Minimum 44px (Apple HIG). Every `Pressable` must be >= 44px tall.

---

## Glass Panels (Stitch Aesthetic)

**When to use:** Profile hero cards, KPI hero strips, featured sections, accent color picker sheets. NOT for regular list cards.

```tsx
<Card variant="glass" elevation="raised">
  {/* Hero content */}
</Card>
```

Produces:

- Dark: `rgba(25,25,33,0.85)` bg + `backdrop-filter: blur(24px)` (web) + `rgba(255,255,255,0.06)` border
- Light: falls back to standard `palette.card`

**Radial glow** behind glass panels (web only):

```tsx
import { glass } from '@horizon/ui'
;<View style={{ background: glass.radialGlow(accentColor) }}>
  <Card variant="glass">...</Card>
</View>
```

---

## Section Headers

Always use `<SectionHeader>` component:

```tsx
<SectionHeader title="Account" />
<SectionHeader title="Administration" color="#7c3aed" badge="Admin Only" badgeColor="#7c3aed" />
```

Renders: `[accent bar 3px] Title [optional badge pill]`

NEVER use plain `<Text>` for section dividers. The accent bar is mandatory visual hierarchy.

---

## Accent Color

Dynamic per-tenant: `useTheme().accentColor`. Default `#1e40af`.
Presets: Blue, Sky (`#3E7BFA`), Teal, Violet, Amber, Green, Maroon, Pink.

Must appear **3+ times per screen**: section bars, primary buttons, active indicators, stat numbers.

For accent-tinted backgrounds: `accentTint(accentColor, 0.10)` for light mode, `accentTint(accentColor, 0.15)` for dark.

---

## Dark Mode Rules (MANDATORY)

1. All text: `palette.text` / `palette.textSecondary` — NEVER hardcode `#fff` or `#111`
2. All backgrounds: `palette.background` / `palette.card` — NEVER hardcode white/black
3. Status chips: use `getStatusColors(key, isDark)` — returns correct light/dark pair
4. Borders: `palette.border` — NEVER `border-gray-200` or similar Tailwind defaults
5. Card borders: `palette.cardBorder` — visible in both modes
6. Glass variant cards: only render glass in dark mode, fall back to solid in light

---

## File Structure

```
packages/ui/src/
  components/
    Card.tsx              → Solid + glass variant, elevation prop
    SectionHeader.tsx     → Accent bar + title + badge
    Button.tsx            → Sized to buttonSize scale
    Badge.tsx             → Sized to badgeSize scale
    ListItem.tsx          → Press feedback, min 44px
    SearchInput.tsx       → Shadow + card bg
    StatusChip.tsx        → Vibrant XD colors
    SpotlightDock.tsx     → Tab bar with accent glow
    PageShell.tsx         → Gradient bg + animated bg
    EmptyState.tsx        → For empty lists
    Icon.tsx              → Lucide wrapper
  theme/
    colors.ts             → XD grays + Stitch darks + vibrant status + glass helpers
    typography.ts         → Weight-aligned type scale
    shadows.ts            → 6-level XD elevation
    spacing.ts            → buttonSize + badgeSize
    icons.ts              → Lucide domain icon map
  stores/
    useThemeStore.ts      → Color mode + accent + background preset
  hooks/
    useTheme.ts           → palette + accentColor + isDark shortcut
```

---

## Primary Color Shades

The XD primary `#3E7BFA` has a full shade scale for interactive states. Available via `colors.primary`:

| Token         | Hex       | Usage                        |
| ------------- | --------- | ---------------------------- |
| `pressed`     | `#3568D4` | Button pressed state         |
| `default`     | `#3E7BFA` | Default primary / Sky accent |
| `hover`       | `#5B8DEF` | Button hover state           |
| `light`       | `#6698FF` | Light accent elements        |
| `lighter`     | `#9DBFF9` | Subtle accent backgrounds    |
| `lightest`    | `#CCDDFF` | Surface tint, selected rows  |
| `surfaceTint` | `#E5F0FF` | Page-level tint wash         |

## Extended Semantic Colors

Beyond status colors, these are available via `colors.semantic`:

| Color  | Light     | Dark      | Usage                              |
| ------ | --------- | --------- | ---------------------------------- |
| Yellow | `#FFCC00` | `#FDDD48` | Caution, attention, stars          |
| Purple | `#6600CC` | `#AC5DD9` | Admin features, special roles      |
| Teal   | `#00CFDE` | `#73DFE7` | Diverted flights, secondary accent |

---

## Buttons — Full Spec

### 5 Variants

| Variant       | Background    | Text   | Usage                       |
| ------------- | ------------- | ------ | --------------------------- |
| `primary`     | `accentColor` | white  | Standard CTA                |
| `secondary`   | transparent   | accent | Outlined, secondary actions |
| `ghost`       | transparent   | accent | Tertiary, inline actions    |
| `destructive` | `#E63535`     | white  | Delete, remove, cancel      |
| `affirmative` | `#06C270`     | white  | Approve, confirm, apply     |

### States (all variants)

- **Normal** — default fill/border
- **Hover** — lighter fill (use `primary.hover` for primary buttons)
- **Pressed** — darker fill (use `primary.pressed`)
- **Focus** — 2px accent ring with 2px offset
- **Disabled** — 50% opacity, no pointer events

### Progressive (Loading)

Use `ButtonSpinner` from Gluestack inside the button. Disable interactions during loading. Text changes to "Saving...", "Creating...", etc.

### Icon Positions

- **Left icon** — icon before text (`leftIcon` prop)
- **Right icon** — icon after text (logout, external link)
- **Double icon** — both sides (increment/decrement controls)
- **Icon only** — square button, no text, tooltip required

---

## Badges — 9 Semantic Variants

| Variant     | Light BG                  | Text Color | Dark BG                   | Dark Text |
| ----------- | ------------------------- | ---------- | ------------------------- | --------- |
| INFO        | `rgba(0,99,247,0.12)`     | `#0063F7`  | `rgba(91,141,239,0.15)`   | `#5B8DEF` |
| SUCCESS     | `rgba(6,194,112,0.12)`    | `#06C270`  | `rgba(57,217,138,0.15)`   | `#39D98A` |
| WARNING     | `rgba(255,136,0,0.12)`    | `#E67A00`  | `rgba(253,172,66,0.15)`   | `#FDAC42` |
| DANGER      | `rgba(255,59,59,0.12)`    | `#E63535`  | `rgba(255,92,92,0.15)`    | `#FF5C5C` |
| REMINDER    | `rgba(190,24,93,0.12)`    | `#be185d`  | `rgba(190,24,93,0.15)`    | `#f472b6` |
| MISC        | `accentTint(accent,0.12)` | accent     | `accentTint(accent,0.15)` | accent    |
| UNAVAILABLE | transparent + border      | `#8F90A6`  | transparent + border      | `#555770` |
| OFFLINE     | `#F2F2F5`                 | `#555770`  | `#28293D`                 | `#8F90A6` |
| PRIMARY     | `accentTint(accent,0.12)` | accent     | `accentTint(accent,0.15)` | accent    |

**Detail header badges** (Active/Inactive next to entity name): 13px SemiBold rounded-full pill. Use SUCCESS colors for Active, DANGER for Inactive.

---

## Avatars

| Size        | Dimension       | Usage                                                        |
| ----------- | --------------- | ------------------------------------------------------------ |
| Icon        | 24x24           | Fallback — Lucide `UserCircle`                               |
| Initials    | 32x32           | 2 uppercase letters on accent-tinted circle, 13px Bold white |
| Picture     | 32x32           | Circular image, 2.5px white border, shadow level 01          |
| With status | 32x32 + 8px dot | Green dot = active, gray dot = idle, offset bottom-right     |

---

## Chips

22px height, 8px radius. 12px Medium text.

| Variant     | Description                                    |
| ----------- | ---------------------------------------------- |
| Text only   | Border + text                                  |
| Icon + text | Leading icon (14px) + text                     |
| Dismissible | Text + trailing X button (red tinted on hover) |
| Colored     | Accent bg, white text                          |
| Avatar      | Mini 18px picture + text, 11px pill radius     |

---

## Alerts

Left accent bar (3px) colored by semantic type. Container: `palette.card` bg, `palette.cardBorder` border, 8px radius.

| Type    | Bar/Icon Color | Icon            |
| ------- | -------------- | --------------- |
| Info    | `#0063F7`      | `AlertCircle`   |
| Success | `#06C270`      | `CheckCircle`   |
| Error   | `#E63535`      | `XCircle`       |
| Warning | `#FF8800`      | `AlertTriangle` |

Variants:

- **Simple** — bar + text only
- **With icon** — bar + icon + text
- **Dismissible** — + close X button top-right
- **With CTA** — + secondary button ("Learn More", "CTA")
- **With header** — bold header + body text + optional CTA
- **Semantic** — full-width colored bar with icon and text

---

## Forms — Input Spec

### Dimensions

- Height: 40px
- Radius: 8px (`rounded-lg`)
- Text: 14px Regular
- Label: 12px Medium, positioned above input
- Assistive text: 12px Regular below, uses status color during validation
- Placeholder: `palette.textTertiary`

### States

| State    | Border           | Ring          | BG                                 |
| -------- | ---------------- | ------------- | ---------------------------------- |
| Normal   | `palette.border` | none          | `palette.background`               |
| Focus    | `accentColor`    | 2px accent/30 | `palette.background`               |
| Error    | `#E63535`        | 2px red/30    | `palette.background`               |
| Success  | `#06C270`        | 2px green/30  | `palette.background`               |
| Disabled | `palette.border` | none          | `palette.backgroundHover` (grayed) |

### Icon Positions

- Left icon: 16px, `palette.textSecondary`, inside left padding
- Right icon: 16px, same treatment, inside right padding
- Double icon: both sides

### Validation Patterns

1. **Checking** — spinner icon + "Checking..." assistive text in `textSecondary`
2. **Valid** — green border + checkmark icon + "Available!" in green
3. **Invalid** — red border + X icon + error message in red
4. **Assistive** — info icon + helper text in `textTertiary` (always visible)

---

## Modals

Use Gluestack `AlertDialog` for confirmations, `Modal` for complex forms.

### Standard Patterns

- **2-option horizontal** — text + two buttons side by side
- **2-option vertical** — stacked buttons (mobile-friendly)
- **Loading** — spinner + "Loading..." text
- **Selection** — radio list + submit button
- **Dismissible** — close X + body text + optional CTA
- **Conditional** — checkbox "Don't show again" + confirm button
- **Destructive** — icon + "Are you sure?" + "No, Cancel" (secondary) + "Yes, Delete" (red)
- **With image** — side image or top image + form content

### Button Pairs

- Confirm: "No, Cancel" (secondary) + "Yes, Do It" (primary accent)
- Destructive: "No, Cancel" (secondary) + "Yes, Delete" (`#E63535`)
- Always put the primary/dangerous action on the RIGHT

---

## Tables

### Header Row

- 12px Medium uppercase, `palette.textTertiary`, bottom border
- Sortable: chevron indicator, accent color on active sort column

### Body Rows

- 14px Regular, `palette.text`
- Alternating bg: even = transparent, odd = `palette.backgroundHover` at 4% opacity
- Hover: `palette.backgroundHover`
- Min row height: 44px (touch target)

### Cell Padding

- Standard: `px-3 py-2.5`
- Compact: `px-2 py-1.5`

### Features

- **Row selection** — checkbox column, selected rows get accent tinted bg
- **Row actions** — `MoreHorizontal` overflow menu with Edit/Delete/Export
- **Drag handle** — grip dots (6-dot pattern) on left
- **Avatar column** — 32px circular image
- **Disabled rows** — 50% opacity, `textTertiary` color
- **Pagination footer** — "Showing X-Y of Z" left, numbered pagination right

---

## Pagination

### Button Pagination

Prev/Next buttons with chevron icons. Secondary variant (outlined).

### Numbered

Number sequence with active page in accent circle: `1  2  [3]  4  5  ...  12  >`

### Visual Indicators

- **Progress bar** — thin accent line showing position
- **Dot indicators** — accent dot for active, gray dots for others

---

## Navigation — Tabs

### 3 Styles

| Style     | Active Indicator                     | Usage                    |
| --------- | ------------------------------------ | ------------------------ |
| Underline | 2px accent bar under active tab      | Default for content tabs |
| Pill      | Accent bg pill on active             | Compact toggles, filters |
| Box       | Bottom border on active + top accent | Section navigation       |

Active tab always uses `accentColor`. Inactive: `palette.textSecondary`.

---

## Progress Indicators

### Bar

4px height, full border-radius. Track: `palette.border`. Fill: accent color. Optional label + percentage.

### Circular

24/32/40px diameter, 3px stroke width. Track: `palette.border`. Fill: accent. Optional percentage text inside (12px Medium).

---

## Notification Badges

- **Dot** — 8px red circle, no text, positioned top-right of icon (-4px offset)
- **Count** — red bg (`#E63535`), white text, min 16px width, 8px height, rounded-full. Shows number (8, 16, 99+)

---

## Tooltips / Popovers

- Height: 30px, radius: 4px
- Light mode: dark bg `#1C1C28`, white text
- Dark mode: light bg `#FAFAFC`, dark text
- 12px Regular text
- Arrow/caret pointing to trigger element
- Appear on hover (desktop) or long-press (mobile)

---

## Sliders

- Track: 4px height, accent fill on active side, `palette.border` on inactive
- Thumb: 16px circle, white fill, 2px accent border, shadow level 02
- Range slider: two thumbs with accent fill between them
- Labeled: value bubble above thumb showing current value
- Label + value: "Contrast" left, "75%" right

---

## Calendar / Date Picker

- Selected date: accent filled circle
- Today: subtle outline circle
- Range selection: connected row with accent-tinted cells, start/end in filled circles
- Month navigation: left/right chevrons
- Month grid: pill buttons in 4x3 grid, active month in accent
- Double calendar: side-by-side months for range selection

---

## Dropdowns — Advanced

| Variant               | Features                                        |
| --------------------- | ----------------------------------------------- |
| Standard              | Gluestack Select — single option list           |
| Tabbed                | Tab switcher inside dropdown panel              |
| Search / Auto-suggest | Input field + filtered result list with avatars |
| Link                  | Items as navigation links with icons            |
| Branched / Cascading  | Nested sub-menus expanding right                |

Selected item: accent bg highlight. Items: 14px Regular, 44px min height.

---

## Scrollbars (Web)

Custom styled: 4px width, 2px radius thumb, `palette.textTertiary` thumb color, transparent track. Apply via CSS `::-webkit-scrollbar`.

---

## Status Icons (Lucide Mapping)

| Status  | Icon            | Color (Light) | Color (Dark) |
| ------- | --------------- | ------------- | ------------ |
| Info    | `AlertCircle`   | `#0063F7`     | `#5B8DEF`    |
| Warning | `AlertTriangle` | `#FF8800`     | `#FDAC42`    |
| Error   | `XCircle`       | `#E63535`     | `#FF5C5C`    |
| Success | `CheckCircle`   | `#06C270`     | `#39D98A`    |

Available via `domainIcons.info`, `domainIcons.warning`, `domainIcons.error`, `domainIcons.success` from `icons.ts`.
