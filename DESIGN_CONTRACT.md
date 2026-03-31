# Sky Hub — Design Contract

> Single source of truth for all UI decisions across web and mobile.
> Every new screen, component, or layout must comply with this document.
> If something isn't covered here, ask before building.

---

## 1. Platform Targets

| Platform       | Min width | Primary use        | Framework         |
|----------------|-----------|--------------------|--------------------|
| iPad landscape | 1024px    | **Primary target** | Expo + NativeWind  |
| iPad portrait  | 768px     | Secondary          | Expo + NativeWind  |
| Web desktop    | 1280px+   | Full feature set   | Next.js + Tailwind |
| Web tablet     | 768-1279  | Responsive         | Next.js + Tailwind |
| iPhone         | 375-430   | Read-only / alerts | Expo + NativeWind  |
| Android phone  | 360-412   | Read-only / alerts | Expo + NativeWind  |

**iPad/tablet is the primary mobile target.** Phones get a simplified read-only experience.

---

## 2. Breakpoint System

### Web (Tailwind CSS)
```
phone:   < 768px    → single column, stacked layout
tablet:  768-1024px → collapsible left panel, overlay detail
desktop: > 1024px   → full master-detail side-by-side
```

### Mobile (React Native / NativeWind)
Detection via `useWindowDimensions()` — reliable, updates on rotation.

```typescript
const { width } = useWindowDimensions()
const layout = width >= 1024 ? 'desktop'   // iPad landscape, iPad Pro
             : width >= 768  ? 'tablet'    // iPad portrait
             :                 'phone'     // iPhone, Android phone
```

**Rule:** Never use `Dimensions.get('window')` statically. Always use the hook.

---

## 3. Layout System

### 3.1 MasterDetailLayout — The Universal Shell

Every data screen (admin, reports, control screens) uses this layout:

```
┌──────────┬─────────────────────────┬──────────┐
│ Left     │ Center                  │ Right    │
│ 300px    │ flex-1                  │ 300px    │
│          │                         │ optional │
│ list     │ detail / map / form     │ info     │
│ search   │ tabs                    │ inspector│
│ filters  │                         │          │
└──────────┴─────────────────────────┴──────────┘
```

**Responsive behavior:**

| Breakpoint | Left panel | Center | Right panel |
|------------|-----------|--------|-------------|
| Desktop (>1024) | 300px, always visible | flex-1 | 300px if needed |
| Tablet (768-1024) | 64px collapsed strip; tap to expand 300px overlay | flex-1 | Hidden; moved to bottom sheet |
| Phone (<768) | Full screen list; tap → push to detail | Full screen detail; back button | Hidden |

**On iPad landscape (1024+):** Identical to web desktop — side-by-side panels.
**On iPad portrait (768-1024):** Collapsed strip + overlay. Detail stays visible.
**On phone:** Stack navigation. List → Detail as separate screens.

### 3.2 Screen Types

| Type | Layout | Example |
|------|--------|---------|
| `master-detail` | Left list + Center detail | 4.2.2 Airports |
| `master-detail-right` | Left list + Center + Right info | 2.1.1 Movement Control |
| `dashboard-grid` | Full-width card grid | 4.2 Master Data |
| `report` | Left filters + Center results | 1.3.1 Daily Schedule |
| `gantt` | Left filters + Center timeline | 1.1.3 Gantt Chart |
| `form` | Center form only | 4.1.1 Operator Profile |

---

## 4. Design Tokens

Defined once in `packages/constants`, consumed by both platforms.

### 4.1 Colors

```typescript
// packages/constants/src/design-tokens.ts

export const COLORS = {
  // Backgrounds
  bg:          { light: '#ffffff',  dark: '#1a1a1a' },
  card:        { light: '#f5f5f5',  dark: '#252525' },
  
  // Borders
  border:      { light: '#e8e8e8',  dark: 'rgba(255,255,255,0.10)' },
  borderInput: { light: 'rgba(0,0,0,0.20)', dark: 'rgba(255,255,255,0.20)' },
  
  // Text
  text:          { light: '#111111',  dark: '#f5f5f5' },
  textSecondary: { light: '#6b7280',  dark: '#9ca3af' },
  
  // Status
  onTime:    { fg: '#16a34a', bg: { light: '#dcfce7', dark: 'rgba(22,163,74,0.15)' } },
  delayed:   { fg: '#d97706', bg: { light: '#fef3c7', dark: 'rgba(217,119,6,0.15)' } },
  cancelled: { fg: '#dc2626', bg: { light: '#fee2e2', dark: 'rgba(220,38,38,0.15)' } },
  departed:  { fg: '#2563eb', bg: { light: '#dbeafe', dark: 'rgba(37,99,235,0.15)' } },
  diverted:  { fg: '#7c3aed', bg: { light: '#f3e8ff', dark: 'rgba(124,58,237,0.15)' } },
  scheduled: { fg: '#6b7280', bg: { light: '#f3f4f6', dark: 'rgba(107,114,128,0.12)' } },
  
  // Module accents (from MODULE_THEMES)
  network:     '#2563eb',
  operations:  '#4f46e5',
  ground:      '#059669',
  workforce:   '#7c3aed',
  integration: '#0891b2',
  admin:       '#64748b',
}
```

### 4.2 Typography Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Page title | 20px | semibold (600) | Top of every screen |
| Section heading | 15px | bold (700) | Panel headers, section labels |
| Card title | 13px | medium (500) | List items, card headings |
| Body text | 13px | regular (400) | Form values, descriptions |
| Label | 12px | semibold (600) | Form labels, filter labels, uppercase tracking-wider |
| Section label | 11px | semibold (600) | Uppercase group headers |
| Caption | 11px | regular (400) | Metadata, secondary info |
| Badge text | 11px | semibold (600) | Status badges, counts |
| Tiny | 10px | medium (500) | Dock labels, compact list items |

**Rule:** No text below 10px on any platform. No text below 11px in data displays.

### 4.3 Spacing

Based on 4px grid. Common values:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps (icon to text) |
| `sm` | 8px | List item gaps, small padding |
| `md` | 12px | Card padding, field spacing |
| `lg` | 16px | Section padding, panel padding |
| `xl` | 24px | Panel gaps, major sections |

### 4.4 Radii

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Inputs, small buttons, badges |
| `md` | 10px | Buttons, form fields |
| `lg` | 12px | Cards, list items, tabs |
| `xl` | 16px | Panels, major containers |
| `2xl` | 20px | Full panels, layout sections |

### 4.5 Shadows

- **None:** List items, flat cards
- **sm:** `0 1px 3px rgba(0,0,0,0.04)` — Subtle card elevation
- **md:** `0 4px 16px rgba(0,0,0,0.08)` — Hover state, dropdowns
- **lg:** `0 8px 32px rgba(0,0,0,0.13)` — Floating dock, modals

---

## 5. Component Parity Rules

Every interactive component exists in both platforms with **identical props**.

| Component | Web path | Mobile path | Key props |
|-----------|----------|-------------|-----------|
| SelectionPanel | `components/selection-criteria/panel` | `components/selection-criteria/panel` | `title, activeCount, children, footer` |
| Field | `selection-criteria/field` | `selection-criteria/field` | `label, required, children` |
| Select | `selection-criteria/select` | `selection-criteria/select` | `value, onChange, options, placeholder` |
| MultiSelect | `selection-criteria/multi-select` | `selection-criteria/multi-select` | `selected, onChange, options` |
| TextInput | `selection-criteria/text-input` | `selection-criteria/text-input` | `value, onChange, placeholder, mono` |
| Segmented | `selection-criteria/segmented` | `selection-criteria/segmented` | `value, onChange, options` |
| Toggle | `selection-criteria/toggle` | `selection-criteria/toggle` | `label, checked, onChange` |
| GoButton | `selection-criteria/go-button` | `selection-criteria/go-button` | `onClick, loading, label` |
| ListItem | `selection-criteria/list-item` | `selection-criteria/list-item` | `selected, onClick, children` |

**Rule:** When building a new component for web, immediately create the mobile counterpart. Same file name, same prop interface. The only difference is `div`→`View`, `span`→`Text`, `button`→`Pressable`.

---

## 6. Screen Manifest

Every screen is registered with its configuration. Both platforms read this to determine layout and behavior.

```typescript
// packages/constants/src/screen-manifest.ts

export interface ScreenManifest {
  code: string            // Module code e.g. '4.2.2'
  layout: 'master-detail' | 'master-detail-right' | 'dashboard-grid' | 'report' | 'gantt' | 'form'
  apiCalls: string[]      // e.g. ['getAirports', 'getCountries']
  list?: {
    groupBy?: string      // Field to group by e.g. 'country'
    searchFields: string[] // Fields to search e.g. ['icaoCode', 'iataCode', 'name', 'city']
    displayFields: { primary: string; secondary: string; badge?: string }
  }
  detail?: {
    tabs: { key: string; label: string; icon: string }[]
    headerFields: { title: string; subtitle: string; badges?: string[] }
    mapField?: { lat: string; lon: string }  // Show map if present
  }
  table?: {               // For simpler list-only views
    columns: { key: string; label: string; width?: string }[]
  }
}
```

**Rule:** When adding a new admin screen, add its manifest entry first. Both platforms consume the same manifest.

---

## 7. Interaction Patterns

### 7.1 Touch Targets
- Minimum 44×44px on all platforms
- On phone: minimum 48×48px

### 7.2 Hover States (web + iPad trackpad)
- Cards: `hover:shadow-md` transition
- List items: `hover:bg-black/5 dark:hover:bg-white/10`
- Buttons: `hover:opacity-90`
- Duration: 150ms for color, 200ms for shadow/transform

### 7.3 Selection States
- Selected list item: left accent bar (3px) in module accent color + 8% tinted background
- Active tab: module accent color fill + white text

### 7.4 Transitions
- Panel expand/collapse: 200ms ease-out
- Mobile screen push: 300ms ease-out
- Hover color change: 150ms
- Shadow change: 200ms

---

## 8. Dark Mode Rules

- **Web:** Toggle via `.dark` class on `<html>`, persisted in localStorage
- **Mobile:** Follow system preference via `useColorScheme()`, with manual override
- **Glass surfaces:** Use reduced opacity in dark mode (0.75 instead of 0.85)
- **Status colors:** Use rgba tinted backgrounds in dark mode (15% opacity)
- **Borders:** `border-black/20 → border-white/20` in dark mode
- **Dynamic module colors:** saturate(0.60) on solid-color elements in dark mode

---

## 9. V1 Lessons Learned — Rules

### 9.1 File Size
**No file may exceed 400 lines.** Extract features into separate files proactively.

### 9.2 State Management
- State lives in the component that uses it, not in a parent
- Derived data is computed via `useMemo`, never stored in state
- Never use `.find()` inside `.map()` — build a `Map<string, T>` lookup first

### 9.3 Render Performance
- `React.memo()` on any component receiving large data arrays
- No JSX as props to memo'd components (defeats memo)
- Heavy computation (>100ms) runs in `startTransition` or a Web Worker

### 9.4 One Feature = One File
- Every panel, dialog, form tab, or data computation gets its own file
- Never add a new useMemo/useState inline to a file already over 300 lines

### 9.5 Don't Hardcode
- No hardcoded colors — use design tokens
- No hardcoded API URLs — use `setApiBaseUrl()`
- No hardcoded module codes in layouts — read from registry
- No hardcoded column definitions — read from screen manifest

### 9.6 Platform Parity
- Build web first (easier to iterate)
- Mobile counterpart within the same PR
- Same prop interfaces, same visual output
- If a feature can't work on phone, it still must work on iPad

---

## 10. Folder Structure

```
apps/
  web/src/
    app/                        # Next.js routes
      admin/
        airports/page.tsx       # Route entry point (thin)
    components/
      layout/                   # MasterDetailLayout, etc.
      selection-criteria/       # Full filter kit
      admin/                    # Admin-specific components
        airports/               # 4.2.2 components
          airports-shell.tsx    # Orchestrator
          airport-list.tsx      # Left panel
          airport-detail.tsx    # Center panel
          airport-basic-tab.tsx # Tab content
          airport-map.tsx       # Mapbox
  
  mobile/app/
    (tabs)/admin.tsx            # Tab entry
    admin/
      airports/
        index.tsx               # List screen
        [id].tsx                # Detail screen
    components/
      layout/                   # Same structure as web
      selection-criteria/       # NativeWind versions

packages/
  api/                          # Shared API client + types
  constants/                    # Module registry + design tokens + screen manifest
  types/                        # Shared TypeScript types
```

---

## 11. Reference Implementations

Once built, these are the canonical examples:

| Pattern | Reference screen | Code |
|---------|-----------------|------|
| Master-detail with map + tabs | Airports | 4.2.2 |
| Master-detail simple | Aircraft Types | 4.2.3 |
| Dashboard grid | Master Data | 4.2 |
| Report with filters | Daily Schedule | 1.3.1 |
| Operations Gantt | Movement Control | 2.1.1 |

**4.2.2 Airports is the FIRST reference implementation.** Every other screen follows its patterns.

---

## 12. Quality Gates

Before any screen is considered done:

- [ ] Works on web desktop (>1024px)
- [ ] Works on web tablet (768-1024px)
- [ ] Works on iPad landscape (1024px)
- [ ] Works on iPad portrait (768px)
- [ ] Works on phone (375px) — at minimum read-only
- [ ] Dark mode correct on both platforms
- [ ] No file exceeds 400 lines
- [ ] All data from API — no hardcoded data
- [ ] Design tokens used — no hardcoded colors/sizes
- [ ] Screen manifest entry exists
