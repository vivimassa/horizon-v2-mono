// @/components/ui — web design-system mirror of packages/ui
// Keep this in sync with packages/ui/src/index.ts so both platforms
// consume the same component API.

// ── Screen scaffolding ──
export { ScreenContainer } from './ScreenContainer'
export { ListScreenHeader } from './ListScreenHeader'
export { DetailScreenHeader, type StatusTone } from './DetailScreenHeader'
export { TabBar, type TabBarItem } from './TabBar'

// ── Data display ──
export { FieldRow, type FieldRowType, type FieldRowOption } from './FieldRow'

// ── Primitives ──
export { Text, type TextVariant } from './Text'
export { Divider } from './Divider'
export { TextInput } from './TextInput'
