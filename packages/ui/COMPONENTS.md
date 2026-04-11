# SkyHub Component Catalog

This package hosts the shared design-system components consumed by both
`apps/mobile` (React Native) and `apps/web` (Next.js + Tailwind). Web uses
a parallel implementation at `apps/web/src/components/ui/` that mirrors the
same component names and prop names so screens look identical across platforms.

**Single source of truth for tokens:** `packages/ui/src/theme/` (colors,
typography, spacing, shadows, icons). The web mirror imports tokens from
`@skyhub/ui/theme` via the `web-safe.ts` export, so there is only one set
of values to keep in sync.

**Minimum font size:** 13px (user rule — see `feedback_min_font_size.md`).
Every typography token in `typography.ts` and every hardcoded `fontSize:` /
`text-[Npx]` in the shared components is >= 13.

---

## Screen scaffolding

| Component            | Purpose                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| `ScreenContainer`    | Inner-screen wrapper. Safe-area insets + `palette.background`.                |
| `PageShell`          | Main-tab screen wrapper. Adds gradient background + title header.             |
| `ListScreenHeader`   | Back + icon badge + title + count + add button. Used on list screens.         |
| `DetailScreenHeader` | Back + icon + title/subtitle + edit/save/cancel/delete toolbar + status pill. |
| `TabBar`             | Horizontal scrollable tabs (optional icon + label, active underline).         |
| `SpotlightDock`      | Mobile bottom tab bar (main navigation).                                      |

## Data display

| Component       | Purpose                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `Card`          | Grouped content block with shadow + border (supports `variant="glass"`).                    |
| `SectionHeader` | 3px accent bar + title + optional action + optional badge.                                  |
| `ListItem`      | Row inside a card — icon + title + subtitle + chevron + press state.                        |
| `FieldRow`      | Label + value with view/edit modes. Supports text/number/toggle/select/time-hhmm/multiline. |
| `Badge`         | Count/label chip (default/accent/muted variants).                                           |
| `StatusChip`    | Flight status chip (onTime/delayed/cancelled/departed/diverted/scheduled).                  |
| `EmptyState`    | Icon + title + subtitle + optional action button.                                           |
| `NavTile`       | Pressable drill-down tile (mobile navigation grid).                                         |

## Primitives

| Component     | Purpose                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`        | Typography variants (`pageTitle`, `sectionHeading`, `panelHeader`, `body`, `secondary`, `fieldLabel`, `caption`, `badge`, `cardTitle`, `cardDescription`, `stat`, etc.) |
| `Button`      | 5 variants: `primary` / `secondary` / `ghost` / `destructive` / `affirmative`.                                                                                          |
| `TextInput`   | Form input with label/error/hint/icons. 40px height, 8px radius.                                                                                                        |
| `SearchInput` | Search-bar variant with clear button.                                                                                                                                   |
| `Divider`     | 1px horizontal/vertical line in `palette.border`.                                                                                                                       |
| `Icon`        | Lucide wrapper — always use instead of importing from `lucide-react-native`.                                                                                            |
| `Tooltip`     | Web-only popover tooltip.                                                                                                                                               |

---

## Building a new list screen

Same code shape on mobile and web — different imports:

```tsx
// Mobile
import { ScreenContainer, ListScreenHeader, SearchInput, Text, domainIcons } from '@skyhub/ui'
// Web
import { ListScreenHeader, TextInput, Text } from '@/components/ui'
import { PlaneTakeoff } from 'lucide-react'

export function AirportsList() {
  const [search, setSearch] = useState('')
  const [airports, setAirports] = useState<AirportRef[]>([])
  const filtered = useMemo(() => filterAirports(airports, search), [airports, search])

  return (
    <ScreenContainer padded={false}>
      <ListScreenHeader
        icon={PlaneTakeoff}
        title="Airports"
        count={airports.length}
        filteredCount={filtered.length}
        countLabel="airport"
        onBack={goBack}
        onAdd={openCreate}
      />
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search…" />
      {/* List body — FlatList on mobile, grouped buttons on web */}
    </ScreenContainer>
  )
}
```

## Building a new detail screen

```tsx
import { ScreenContainer, DetailScreenHeader, TabBar, FieldRow, SectionHeader, Text, type TabBarItem } from '@skyhub/ui'

const TABS: TabBarItem[] = [
  { key: 'basic', label: 'Basic', icon: InfoIcon },
  { key: 'operations', label: 'Operations', icon: RadioIcon },
]

export function AirportDetail({ airport }: { airport: AirportRef }) {
  const [tab, setTab] = useState<'basic' | 'operations'>('basic')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<AirportRef>>({})

  return (
    <ScreenContainer padded={false}>
      <DetailScreenHeader
        icon={BuildingIcon}
        title={airport.name}
        subtitle={`${airport.iataCode} / ${airport.icaoCode}`}
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => {
          setEditing(false)
          setDraft({})
        }}
        onSave={async () => {
          await save(draft)
          setEditing(false)
        }}
        onDelete={handleDelete}
        status={{
          label: airport.isActive ? 'Active' : 'Inactive',
          tone: airport.isActive ? 'success' : 'danger',
        }}
      />
      <TabBar tabs={TABS} activeTab={tab} onTabChange={(k) => setTab(k as any)} />

      {tab === 'basic' && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <FieldRow
            label="IATA Code"
            value={airport.iataCode}
            editing={editing}
            editValue={draft.iataCode}
            onChangeValue={(v) => setDraft({ ...draft, iataCode: v as string })}
            mono
          />
          <FieldRow
            label="City"
            value={airport.city}
            editing={editing}
            editValue={draft.city}
            onChangeValue={(v) => setDraft({ ...draft, city: v as string })}
          />
          <FieldRow
            label="Active"
            value={airport.isActive}
            editing={editing}
            editValue={draft.isActive}
            onChangeValue={(v) => setDraft({ ...draft, isActive: v as boolean })}
            type="toggle"
          />
        </ScrollView>
      )}
    </ScreenContainer>
  )
}
```

---

## Tokens cheat sheet

**Typography variants** (via `<Text variant="...">` — all >= 13px):

| Variant           | Size | Weight | Notes                          |
| ----------------- | ---- | ------ | ------------------------------ |
| `pageTitle`       | 20   | 600    | Screen titles                  |
| `sectionHeading`  | 15   | 700    | Section titles                 |
| `panelHeader`     | 15   | 500    | Card/panel headers             |
| `body`            | 14   | 400    | Default body                   |
| `bodyLarge`       | 16   | 400    | Hero body                      |
| `lead`            | 14   | 700    | Emphatic body                  |
| `secondary`       | 13   | 400    | Muted body (auto-muted)        |
| `fieldLabel`      | 13   | 500    | Uppercase field labels         |
| `caption`         | 13   | 400    | Captions (auto-muted)          |
| `badge`           | 13   | 600    | Pill/badge text                |
| `cardTitle`       | 13   | 500    | Card titles                    |
| `cardDescription` | 13   | 400    | Card descriptions (auto-muted) |
| `stat`            | 18   | 600    | Stat numbers                   |
| `statLarge`       | 24   | 700    | Hero stats                     |
| `tabLabel`        | 13   | 600    | Tab bar labels                 |

**Button variants:** `primary` · `secondary` · `ghost` · `destructive` · `affirmative`

**Status badge tones** (`DetailScreenHeader` `status` prop):
`success` (#06C270) · `danger` (#E63535) · `warning` (#FF8800) · `info` (#0063F7) · `neutral`

**Shadow levels** (from `shadowStyles` in `packages/ui/src/theme/shadows.ts`):
`card` · `cardHover` · `raised` · `floating` · `modal` · `overlay`

---

## Migration notes

- **All detail screens** should use `DetailScreenHeader` — it enforces the
  13px SemiBold status pill and semantic status colors. Legacy inline
  `bg-green-*` / `bg-red-*` status badges violate CLAUDE.md rule #20.
- **All list screens** should use `ListScreenHeader` — it enforces the
  back + icon-badge + title/count + add-button layout.
- **All field rows** should use `FieldRow` from the barrel, not reinvent
  `Field()` / `ToggleField()` / `TimeField()` helpers locally.
- **The old `apps/web/src/components/admin/airports/field-row.tsx`** is a
  thin legacy adapter. 13 admin shells still import from it with the old
  `fieldKey`/`onChange(key, v)` API. Each shell should migrate to
  `@/components/ui` over time; once all consumers are gone, delete the shim.
- **Gantt / schedule-grid / cargo / flight-ops** files intentionally retain
  some dense 11–12px text for data-density reasons. They will be revisited
  in a later sprint after Core Design System dimensions are locked in.
