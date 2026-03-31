# Horizon v2 — Frontend Design System

## Core Rule
All components built with **Tamagui** — never raw `View`/`Text` in shared packages (`packages/ui/`).
Apps (`apps/mobile/`, `apps/web/`) may use platform primitives for app-specific screens.

## Typography (STRICT — from v1 rules)
| Role             | Size | Weight | Token       |
|------------------|------|--------|-------------|
| Page title       | 20px | 600    | `$7`        |
| Stat number      | 18px | 600    | `$6`        |
| Section heading  | 15px | 700    | `$5`        |
| Body / labels    | 14px | 400    | `$4` / true |
| Secondary / card | 13px | 500    | `$3`        |
| Caption / field  | 12px | 400    | `$2`        |
| Badge minimum    | 11px | 600    | `$1`        |

**NEVER below 11px for any visible text.**

## Colors
- Always use Tamagui theme tokens: `$background`, `$color`, `$colorSecondary`, `$borderColor`, `$cardBackground`, `$cardBorderColor`, `$accentColor`
- **NEVER hardcode hex values** in component files
- Exception: status chip colors use the `STATUS_CONFIG` map in `Badge.tsx` (light/dark pairs)

## Radius
| Element        | Value | Token    |
|----------------|-------|----------|
| Cards, panels  | 12px  | `$card`  |
| Inputs, buttons| 10px  | `$input` |
| Badges, chips  | 6px   | `$badge` |
| Pills, toggles | 20px  | `$pill`  |

**NEVER use 0 radius on visible elements.**

## Borders
- 0.5px or 1px max on containers
- Use `$borderColor` or `$cardBorderColor` tokens
- Never use hard black/white borders

## Spacing
| Token  | Value |
|--------|-------|
| `$xs`  | 4px   |
| `$sm`  | 8px   |
| `$md`  | 12px  |
| `$lg`  | 16px  |
| `$xl`  | 20px  |
| `$2xl` | 24px  |
| `$3xl` | 32px  |

## Dark Mode
- **Mandatory on every component** — test both modes before considering done
- All text uses `$color` or `$colorSecondary` — no hardcoded `#111` or `#fff`
- All backgrounds use `$background` or `$cardBackground`
- Status chips use correct dark variant (translucent bg + bright text)
- Borders use `$borderColor` — visible in both modes

## Status Chips
Use the `Badge` component from `@horizon/ui`. Status color pairs:
- **On Time**: light `#dcfce7`/`#166534` → dark `rgba(22,163,74,0.15)`/`#4ade80`
- **Delayed**: light `#fef3c7`/`#92400e` → dark `rgba(245,158,11,0.15)`/`#fbbf24`
- **Cancelled**: light `#fee2e2`/`#991b1b` → dark `rgba(220,38,38,0.15)`/`#f87171`
- **Departed**: light `#dbeafe`/`#1e40af` → dark `rgba(30,64,175,0.15)`/`#60a5fa`
- **Diverted**: light `#f3e8ff`/`#6b21a8` → dark `rgba(124,58,237,0.15)`/`#a78bfa`
- **Scheduled**: light `#f5f5f5`/`#555555` → dark `#303030`/`#999999`

## Shadows / Elevation
- Use Tamagui's `elevate` prop or `elevated` variant on `Card` — not raw `shadowOffset`

## Press Feedback
- Every tappable element needs `pressStyle={{ scale: 0.98 }}` or opacity change
- Use `pressable` variant on `Card` for tappable cards

## Accent Color
- Accessed via `$accentColor` theme token
- Dynamic per tenant, default `#1e40af`
- Used for: primary buttons, active indicators, links, badges

## Icons
- Mobile: `lucide-react-native`
- Web: `lucide-react`
- Minimum 16px, default 20px
- Never use icon-only buttons without accessible labels

## Responsive (Web)
- Use Tamagui media queries (`$sm`, `$md`, `$lg`, `$xl`) for web layout changes
- Mobile ignores these — single column layout
- Breakpoints: sm=640, md=768, lg=1024, xl=1280

## Dark Mode Checklist (MANDATORY before any commit)
- [ ] All text uses theme tokens — no hardcoded colors
- [ ] All backgrounds use theme tokens
- [ ] Status chips use correct dark variant
- [ ] Borders visible in both modes
- [ ] Accent color uses `$accentColor` token
- [ ] Cards use `$cardBackground` + `$cardBorderColor`
