// Mobile/native exports — include navTree with LucideIcon references
export { NAV_TREE as NAV_TREE_WITH_ICONS, type NavPage, type NavSection, type NavModule } from './navTree'

// Platform-safe exports — no RN dependencies
export { NAV_TREE, type NavModuleData, type NavSectionData, type NavPageData } from './navData'
export {
  resolveNavPath,
  buildBreadcrumbs,
  getSiblings,
  getModuleColor,
  type NavPath,
  type BreadcrumbSegment,
} from './navUtils'
