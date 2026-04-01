// Web-safe navigation exports (no React Native / lucide-react-native dependencies)
export { NAV_TREE, type NavModuleData, type NavSectionData, type NavPageData } from './navData'
export {
  resolveNavPath,
  buildBreadcrumbs,
  getSiblings,
  getModuleColor,
  type NavPath,
  type BreadcrumbSegment,
} from './navUtils'
