// SkyHub — Navigation utilities
// Route resolution, breadcrumb building, sibling lookup
// Uses navData.ts (no React Native dependencies) so web can import safely.

import { NAV_TREE, type NavModuleData, type NavSectionData, type NavPageData } from './navData'

export interface NavPath {
  module: NavModuleData
  section?: NavSectionData
  page?: NavPageData
}

export interface BreadcrumbSegment {
  level: 'module' | 'section' | 'page'
  num: string
  label: string
  route: string
  iconName: string
  siblings: Array<{ key: string; label: string; num: string; route: string; iconName: string }>
  parentLabel?: string
}

const MODULE_COLORS: Record<string, string> = {
  home: '#1e40af',
  network: '#0f766e',
  flightops: '#1e40af',
  groundops: '#b45309',
  crewops: '#7c3aed',
  settings: '#555555',
}

export function getModuleColor(moduleKey: string): string {
  return MODULE_COLORS[moduleKey] ?? '#1e40af'
}

function firstRoute(mod: NavModuleData): string {
  return mod.sections[0]?.pages[0]?.route ?? '/'
}

function firstSectionRoute(section: NavSectionData): string {
  return section.pages[0]?.route ?? '/'
}

export function resolveNavPath(pathname: string): NavPath | null {
  // Exact page match
  for (const mod of NAV_TREE) {
    for (const section of mod.sections) {
      for (const page of section.pages) {
        if (page.route === pathname) {
          return { module: mod, section, page }
        }
      }
    }
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    const home = NAV_TREE.find((m) => m.key === 'home')
    if (home) return { module: home, section: home.sections[0], page: home.sections[0]?.pages[0] }
    return null
  }

  // Match module by first segment
  const moduleSlug = segments[0]
  const mod = NAV_TREE.find((m) => {
    const modSlug = firstRoute(m).split('/').filter(Boolean)[0]
    return modSlug === moduleSlug
  })
  if (!mod) return null

  if (segments.length >= 2) {
    const sectionSlug = segments[1]
    const section = mod.sections.find((s) => {
      const sSlug = s.pages[0]?.route.split('/').filter(Boolean)[1]
      return sSlug === sectionSlug
    })
    if (section) {
      if (segments.length >= 3) {
        const pageSlug = segments[2]
        const page = section.pages.find((p) => {
          const pSlug = p.route.split('/').filter(Boolean)[2]
          return pSlug === pageSlug
        })
        if (page) return { module: mod, section, page }
      }
      return { module: mod, section }
    }
  }

  return { module: mod }
}

export function buildBreadcrumbs(path: NavPath): BreadcrumbSegment[] {
  const segs: BreadcrumbSegment[] = []

  segs.push({
    level: 'module',
    num: path.module.num,
    label: path.module.label,
    route: firstRoute(path.module),
    iconName: path.module.iconName,
    siblings: NAV_TREE.map((m) => ({
      key: m.key, label: m.label, num: m.num, route: firstRoute(m), iconName: m.iconName,
    })),
  })

  if (path.section) {
    segs.push({
      level: 'section',
      num: path.section.num,
      label: path.section.label,
      route: firstSectionRoute(path.section),
      iconName: path.section.iconName,
      parentLabel: path.module.label,
      siblings: path.module.sections.map((s) => ({
        key: s.key, label: s.label, num: s.num, route: firstSectionRoute(s), iconName: s.iconName,
      })),
    })
  }

  if (path.page && path.section) {
    segs.push({
      level: 'page',
      num: path.page.num,
      label: path.page.label,
      route: path.page.route,
      iconName: path.page.iconName,
      parentLabel: path.section.label,
      siblings: path.section.pages.map((p) => ({
        key: p.key, label: p.label, num: p.num, route: p.route, iconName: p.iconName,
      })),
    })
  }

  return segs
}

export function getSiblings(
  path: NavPath,
): Array<{ key: string; label: string; num: string; route: string; iconName: string }> {
  if (path.page && path.section) {
    return path.section.pages.map((p) => ({
      key: p.key, label: p.label, num: p.num, route: p.route, iconName: p.iconName,
    }))
  }
  if (path.section) {
    return path.module.sections.map((s) => ({
      key: s.key, label: s.label, num: s.num, route: firstSectionRoute(s), iconName: s.iconName,
    }))
  }
  return NAV_TREE.map((m) => ({
    key: m.key, label: m.label, num: m.num, route: firstRoute(m), iconName: m.iconName,
  }))
}
