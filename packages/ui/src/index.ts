// @skyhub/ui — SkyHub Design System

// ── SkyHub Custom Components ──
export { Card } from './components/Card'
export { SectionHeader } from './components/SectionHeader'
export { ListItem } from './components/ListItem'
export { SearchInput } from './components/SearchInput'
export { StatusChip } from './components/StatusChip'
export { Button } from './components/Button'
export { EmptyState } from './components/EmptyState'
export { Badge } from './components/Badge'
export { Icon } from './components/Icon'
export { PageShell } from './components/PageShell'
// AnimatedBackground is lazy-loaded by PageShell — not exported from barrel
// to avoid eagerly pulling in react-native-reanimated/worklets
export { SpotlightDock } from './components/SpotlightDock'
export { NavTile } from './components/NavTile'

// ── Gluestack Primitives ──
export * from './gluestack'

// ── Theme ──
export {
  colors,
  accentTint,
  getStatusColors,
  type Palette,
  type StatusKey,
} from './theme/colors'
export { typography, type TypographyKey } from './theme/typography'
export { shadowClasses, shadowStyles, type ShadowKey } from './theme/shadows'
export { domainIcons, type DomainIconName, type LucideIcon } from './theme/icons'

// ── Navigation ──
export * from './navigation'

// ── Hooks ──
export { useTheme } from './hooks/useTheme'
export { useThemeStore, type BackgroundPreset } from './stores/useThemeStore'
export { useResponsive } from './hooks/useResponsive'
