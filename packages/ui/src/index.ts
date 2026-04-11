// @skyhub/ui — SkyHub Design System

// ── Screen scaffolding ──
export { ScreenContainer } from './components/ScreenContainer'
export { PageShell } from './components/PageShell'
export { ListScreenHeader } from './components/ListScreenHeader'
export { DetailScreenHeader } from './components/DetailScreenHeader'
export { TabBar, type TabBarItem } from './components/TabBar'
export { SpotlightDock } from './components/SpotlightDock'
// AnimatedBackground is lazy-loaded by PageShell — not exported from barrel
// to avoid eagerly pulling in react-native-reanimated/worklets

// ── Data display ──
export { Card } from './components/Card'
export { SectionHeader } from './components/SectionHeader'
export { ListItem } from './components/ListItem'
export { FieldRow, type FieldRowType, type FieldRowOption } from './components/FieldRow'
export { Badge } from './components/Badge'
export { StatusChip } from './components/StatusChip'
export { EmptyState } from './components/EmptyState'
export { NavTile } from './components/NavTile'

// ── Primitives ──
export { Text, type TextVariant } from './components/Text'
export { Button } from './components/Button'
export { Icon } from './components/Icon'
export { Divider } from './components/Divider'
export { TextInput } from './components/TextInput'
export { SearchInput } from './components/SearchInput'
export { Tooltip } from './components/Tooltip'
export { FilterPanel } from './components/FilterPanel'
export { FilterSection } from './components/FilterSection'
export { DateRangePicker } from './components/DateRangePicker'
export { DropdownSelect } from './components/DropdownSelect'
export { MultiSelect } from './components/MultiSelect'

// ── Providers ──
export { QueryProvider } from './providers/QueryProvider'

// ── Gluestack Primitives ──
export * from './gluestack'

// ── Theme ──
export {
  colors,
  accentTint,
  desaturate,
  modeColor,
  darkAccent,
  getStatusColors,
  glass,
  type Palette,
  type StatusKey,
} from './theme/colors'
export { typography, type TypographyKey } from './theme/typography'
export { shadowClasses, shadowStyles, type ShadowLevel, type ShadowKey } from './theme/shadows'
export { domainIcons, type DomainIconName, type LucideIcon } from './theme/icons'
export { buttonSize, badgeSize, type ButtonSizeKey, type BadgeSizeKey } from './theme/spacing'

// ── Navigation ──
export * from './navigation'

// ── Hooks ──
export { useTheme } from './hooks/useTheme'
export { useThemeStore, type BackgroundPreset } from './stores/useThemeStore'
export { useAuthStore, type AuthUser } from './stores/useAuthStore'
export { useResponsive } from './hooks/useResponsive'
