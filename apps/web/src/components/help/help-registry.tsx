import type { ComponentType } from 'react'
import { MODULE_REGISTRY } from '@skyhub/constants'
import SchedulingXL from '../../../content/help/scheduling-xl.mdx'
import GanttChart from '../../../content/help/gantt-chart.mdx'
import CrewHotelManagement from '../../../content/help/crew-hotel-management.mdx'
import CrewTransportManagement from '../../../content/help/crew-transport-management.mdx'
import HotacConfigurations from '../../../content/help/hotac-configurations.mdx'

export interface HelpMeta {
  code: string
  title: string
  subtitle?: string
}

export interface HelpEntry {
  meta: HelpMeta
  Content: ComponentType
}

/**
 * Authored help pages — keyed by module code.
 * Add entries here as MDX files are written for each module.
 */
export const HELP_REGISTRY: HelpEntry[] = [
  {
    meta: {
      code: '1.1.1',
      title: 'Scheduling XL',
      subtitle: 'Excel-style bulk editor for the flying program',
    },
    Content: SchedulingXL,
  },
  {
    meta: {
      code: '1.1.2',
      title: 'Gantt Chart',
      subtitle: 'Aircraft rotation timeline and tail assignment',
    },
    Content: GanttChart,
  },
  {
    meta: {
      code: '4.1.8.1',
      title: 'Crew Hotel Management',
      subtitle: 'Layover bookings, rooming lists, and hotel email queue',
    },
    Content: CrewHotelManagement,
  },
  {
    meta: {
      code: '4.1.8.2',
      title: 'Crew Transport Management',
      subtitle: 'Ground trips and deadhead flight bookings',
    },
    Content: CrewTransportManagement,
  },
  {
    meta: {
      code: '4.1.8.3',
      title: 'HOTAC Configurations',
      subtitle: 'Operator policy for layover, room allocation, dispatch, and transport',
    },
    Content: HotacConfigurations,
  },
]

const BY_CODE = new Map<string, HelpEntry>()
for (const entry of HELP_REGISTRY) BY_CODE.set(entry.meta.code, entry)

/**
 * Resolve pathname to a module code using the module registry.
 * Uses longest-prefix match so `/network/control/schedule-grid` resolves to the
 * deepest module that still matches (`1.1.2`), not the root (`1`). When two
 * entries share the same route (e.g. a parent `4.1.8` whose landing page is
 * its first child `4.1.8.1`), we prefer the deeper `level` so help registered
 * on the leaf is found instead of the parent.
 */
export function pathnameToCode(pathname: string): string | undefined {
  if (!pathname) return undefined
  const match = MODULE_REGISTRY.filter((m) => pathname === m.route || pathname.startsWith(m.route + '/')).sort(
    (a, b) => b.route.length - a.route.length || (b.level ?? 0) - (a.level ?? 0),
  )[0]
  return match?.code
}

export function resolveHelp(input: { code?: string; pathname?: string }): HelpEntry | undefined {
  if (input.code) {
    return BY_CODE.get(input.code)
  }
  if (input.pathname) {
    const code = pathnameToCode(input.pathname)
    if (code) return BY_CODE.get(code)
  }
  return undefined
}
