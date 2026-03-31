export interface ModuleEntry {
  code: string
  name: string
  description: string
  icon: string
  route: string
  parent_code: string | null
  /** Top-level module key for theming */
  module: 'network' | 'operations' | 'ground' | 'workforce' | 'integration' | 'admin'
  level: number
}

/**
 * Sky Hub module registry.
 * Codes follow a hierarchical numbering system:
 *   1. Network  2. Operations  3. Workforce  4. Admin  5. Ground  6. Integration
 *   x.1 Control  x.2 Tools  x.3 Reports
 *   x.y.z Leaf items
 */
export const MODULE_REGISTRY: ModuleEntry[] = [
  // ──────────────────────────────────────────────
  // 1. NETWORK
  // ──────────────────────────────────────────────
  { code: '1', name: 'Network', description: 'Route management, airports, and fleet infrastructure', icon: 'Globe', route: '/network', parent_code: null, module: 'network', level: 0 },

  // 1.1 Control
  { code: '1.1', name: 'Control', description: 'Schedule planning, administration, and distribution', icon: 'Settings', route: '/network/control', parent_code: '1', module: 'network', level: 1 },
  { code: '1.1.1', name: 'Schedule Builder', description: 'Create and manage aircraft routes with flight legs, frequencies, and seasonal periods', icon: 'PenLine', route: '/network/control/schedule-builder', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.2', name: 'Schedule Grid', description: 'Tabular view of all scheduled flights with inline editing and bulk operations', icon: 'LayoutGrid', route: '/network/control/schedule-grid', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.3', name: 'Gantt Chart', description: 'Aircraft rotation timeline showing fleet utilization and tail assignment', icon: 'GanttChart', route: '/network/control/schedule-gantt', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.4', name: 'Schedule Publish', description: 'Review, approve, and publish planning scenarios to the active schedule', icon: 'SendHorizonal', route: '/network/control/schedule-publish', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.5', name: 'Codeshare Manager', description: 'Manage codeshare agreements and partner flight designators', icon: 'Link2', route: '/network/control/codeshare-manager', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.6', name: 'Slot Manager', description: 'Track airport slot allocations and IATA 80/20 utilization', icon: 'CalendarClock', route: '/network/control/slot-manager', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.7', name: 'Charter Manager', description: 'Manage ad-hoc and charter flight operations', icon: 'PlaneTakeoff', route: '/network/control/charter-manager', parent_code: '1.1', module: 'network', level: 2 },
  { code: '1.1.8', name: 'Schedule Messaging', description: 'Generate and process ASM and SSM messages for schedule distribution', icon: 'MessageSquareShare', route: '/network/control/schedule-messaging', parent_code: '1.1', module: 'network', level: 2 },

  // 1.2 Tools
  { code: '1.2', name: 'Tools', description: 'Network tools and utilities', icon: 'Wrench', route: '/network/tools', parent_code: '1', module: 'network', level: 1 },
  { code: '1.2.1', name: 'SSIM Import', description: 'Import SSIM format files to create or update flight schedules', icon: 'Upload', route: '/network/tools/ssim-import', parent_code: '1.2', module: 'network', level: 2 },
  { code: '1.2.2', name: 'SSIM Export', description: 'Export flight schedules in SSIM format for distribution systems', icon: 'Download', route: '/network/tools/ssim-export', parent_code: '1.2', module: 'network', level: 2 },
  { code: '1.2.3', name: 'SSIM Comparison', description: 'Compare two SSIM files or seasons to identify schedule differences', icon: 'GitCompareArrows', route: '/network/tools/ssim-comparison', parent_code: '1.2', module: 'network', level: 2 },
  { code: '1.2.4', name: 'Scenario Compare', description: 'Compare planning scenarios side by side', icon: 'GitCompareArrows', route: '/network/tools/scenario-compare', parent_code: '1.2', module: 'network', level: 2 },
  { code: '1.2.5', name: 'Change Log', description: 'Timeline of schedule modifications', icon: 'History', route: '/network/tools/change-log', parent_code: '1.2', module: 'network', level: 2 },

  // 1.3 Reports
  { code: '1.3', name: 'Reports', description: 'Network reports and analytics', icon: 'FileText', route: '/network/reports', parent_code: '1', module: 'network', level: 1 },
  { code: '1.3.1', name: 'Daily Flight Schedule', description: 'View daily flight schedules with filtering, sorting, and export', icon: 'CalendarDays', route: '/network/reports/daily-schedule', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.2', name: 'Frequency Analysis', description: 'Flight frequencies by day of week, seasonal, and operation days', icon: 'CalendarRange', route: '/network/reports/frequency-analysis', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.3', name: 'Schedule Summary', description: 'Season overview with fleet deployment and capacity trends', icon: 'LayoutDashboard', route: '/network/reports/schedule-summary', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.4', name: 'Public Timetable', description: 'Passenger-facing timetable by route with local times and frequencies', icon: 'Globe', route: '/network/reports/public-timetable', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.5', name: 'Fleet Utilization', description: 'Analyse scheduled fleet utilization by aircraft type and registration', icon: 'BarChart3', route: '/network/reports/fleet-utilization', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.6', name: 'Route Summary', description: 'Every city pair with block time, frequency, and capacity', icon: 'Waypoints', route: '/network/reports/route-summary', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.7', name: 'Airport Activity', description: 'Departures, arrivals, peak hours per station', icon: 'PlaneTakeoff', route: '/network/reports/airport-activity', parent_code: '1.3', module: 'network', level: 2 },
  { code: '1.3.8', name: 'FIDS', description: 'Flight information display for a selected airport and date', icon: 'Monitor', route: '/network/reports/fids', parent_code: '1.3', module: 'network', level: 2 },

  // ──────────────────────────────────────────────
  // 2. OPERATIONS
  // ──────────────────────────────────────────────
  { code: '2', name: 'Operations', description: 'Flight operations, scheduling, and dispatch', icon: 'Plane', route: '/operations', parent_code: null, module: 'operations', level: 0 },

  // 2.1 Control
  { code: '2.1', name: 'Control', description: 'Operations control panel', icon: 'Settings', route: '/operations/control', parent_code: '2', module: 'operations', level: 1 },
  { code: '2.1.1', name: 'Movement Control', description: 'Real-time aircraft movement tracking and operational decision support', icon: 'Radar', route: '/operations/control/movement-control', parent_code: '2.1', module: 'operations', level: 2 },
  { code: '2.1.2', name: 'Aircraft Maintenance', description: 'Aircraft maintenance tracking and scheduling', icon: 'Wrench', route: '/operations/control/aircraft-maintenance', parent_code: '2.1', module: 'operations', level: 2 },
  { code: '2.1.3', name: 'World Map', description: 'Global flight tracking on an interactive world map', icon: 'Globe', route: '/operations/control/world-map', parent_code: '2.1', module: 'operations', level: 2 },
  { code: '2.1.4', name: 'Movement Messages', description: 'Monitor and reprocess incoming ACARS events and MVT/LDM messages', icon: 'Radio', route: '/operations/control/movement-messages', parent_code: '2.1', module: 'operations', level: 2 },
  { code: '2.1.5', name: 'Disruption Center', description: 'Predictive disruption management with live IROPS alerts', icon: 'ShieldAlert', route: '/operations/control/disruption-center', parent_code: '2.1', module: 'operations', level: 2 },
  { code: '2.1.6', name: 'OCC Dashboard', description: 'Operations control centre overview', icon: 'LayoutDashboard', route: '/operations/control/occ-dashboard', parent_code: '2.1', module: 'operations', level: 2 },

  // 2.3 Reports
  { code: '2.3', name: 'Reports', description: 'Operations reports and analytics', icon: 'FileText', route: '/operations/reports', parent_code: '2', module: 'operations', level: 1 },
  { code: '2.3.1', name: 'OTP Report', description: 'On-time performance analysis', icon: 'Clock', route: '/operations/reports/otp-report', parent_code: '2.3', module: 'operations', level: 2 },
  { code: '2.3.2', name: 'Delay Analysis', description: 'Delay statistics and trends', icon: 'BarChart3', route: '/operations/reports/delay-analysis', parent_code: '2.3', module: 'operations', level: 2 },

  // ──────────────────────────────────────────────
  // 3. WORKFORCE
  // ──────────────────────────────────────────────
  { code: '3', name: 'Workforce', description: 'Crew management, rostering, and personnel', icon: 'Users', route: '/workforce', parent_code: null, module: 'workforce', level: 0 },

  // 3.1 Control
  { code: '3.1', name: 'Control', description: 'Workforce control panel', icon: 'Settings', route: '/workforce/control', parent_code: '3', module: 'workforce', level: 1 },
  { code: '3.1.1', name: 'Crew Profile', description: 'Browse and manage crew member profiles and qualifications', icon: 'UserCircle', route: '/workforce/control/crew-profile', parent_code: '3.1', module: 'workforce', level: 2 },
  { code: '3.1.2', name: 'Crew Documents', description: 'Crew compliance documents, licences, and certificates', icon: 'FileText', route: '/workforce/control/documents', parent_code: '3.1', module: 'workforce', level: 2 },
  { code: '3.1.3', name: 'Crew Availability', description: 'Track crew availability, leave, and off-duty periods', icon: 'CalendarCheck', route: '/workforce/control/availability', parent_code: '3.1', module: 'workforce', level: 2 },
  { code: '3.1.4', name: 'Manpower Planning', description: 'Forecast crew requirements against operational demand', icon: 'Users', route: '/workforce/control/manpower-planning', parent_code: '3.1', module: 'workforce', level: 2 },
  { code: '3.1.5', name: 'Crew Pairing', description: 'Build and optimize crew pairings aligned with FDTL limits', icon: 'GitMerge', route: '/workforce/control/pairing', parent_code: '3.1', module: 'workforce', level: 2 },
  { code: '3.1.6', name: 'Crew Schedule', description: 'Interactive Gantt-based crew schedule with drag-and-drop assignment', icon: 'CalendarDays', route: '/workforce/control/crew-schedule', parent_code: '3.1', module: 'workforce', level: 2 },
  { code: '3.1.7', name: 'Crew Tracking', description: 'Real-time crew tracking with list, Gantt, and map views', icon: 'Activity', route: '/workforce/control/tracking', parent_code: '3.1', module: 'workforce', level: 2 },

  // 3.3 Reports
  { code: '3.3', name: 'Reports', description: 'Workforce reports and analytics', icon: 'FileText', route: '/workforce/reports', parent_code: '3', module: 'workforce', level: 1 },
  { code: '3.3.1', name: 'FDTL Report', description: 'Flight duty time analysis', icon: 'Clock', route: '/workforce/reports/fdtl-report', parent_code: '3.3', module: 'workforce', level: 2 },
  { code: '3.3.2', name: 'Roster Summary', description: 'Roster coverage and statistics', icon: 'BarChart3', route: '/workforce/reports/roster-summary', parent_code: '3.3', module: 'workforce', level: 2 },

  // ──────────────────────────────────────────────
  // 4. ADMIN
  // ──────────────────────────────────────────────
  { code: '4', name: 'Admin', description: 'System administration and configuration', icon: 'Settings', route: '/admin', parent_code: null, module: 'admin', level: 0 },

  // 4.1 System
  { code: '4.1', name: 'System', description: 'Core system settings', icon: 'Settings', route: '/admin/system', parent_code: '4', module: 'admin', level: 1 },
  { code: '4.1.1', name: 'Operator Profile', description: 'Manage operator company profile', icon: 'Building2', route: '/admin/system/operator-profile', parent_code: '4.1', module: 'admin', level: 2 },
  { code: '4.1.2', name: 'User Management', description: 'Manage users and access', icon: 'UserCog', route: '/admin/system/users', parent_code: '4.1', module: 'admin', level: 2 },

  // 4.2 Master Database
  { code: '4.2', name: 'Master Database', description: 'Core reference data', icon: 'Database', route: '/admin/master-database', parent_code: '4', module: 'admin', level: 1 },
  { code: '4.2.1', name: 'Countries', description: 'Country reference data', icon: 'Globe', route: '/admin/countries', parent_code: '4.2', module: 'admin', level: 2 },
  { code: '4.2.2', name: 'Airports', description: 'Airport database management', icon: 'PlaneLanding', route: '/admin/airports', parent_code: '4.2', module: 'admin', level: 2 },
  { code: '4.2.3', name: 'Aircraft Types', description: 'Aircraft type catalogue', icon: 'Plane', route: '/admin/aircraft-types', parent_code: '4.2', module: 'admin', level: 2 },
  { code: '4.2.4', name: 'Delay Codes', description: 'IATA delay code definitions', icon: 'AlertTriangle', route: '/admin/delay-codes', parent_code: '4.2', module: 'admin', level: 2 },
  { code: '4.2.5', name: 'Flight Service Types', description: 'Flight service type codes', icon: 'Tag', route: '/admin/service-types', parent_code: '4.2', module: 'admin', level: 2 },

  // 4.3 Workforce Config
  { code: '4.3', name: 'Workforce Config', description: 'Workforce module configuration', icon: 'Users', route: '/admin/workforce-config', parent_code: '4', module: 'admin', level: 1 },
  { code: '4.3.1', name: 'Crew Positions', description: 'Crew position definitions', icon: 'Award', route: '/admin/crew-positions', parent_code: '4.3', module: 'admin', level: 2 },
  { code: '4.3.2', name: 'Expiry Codes', description: 'Qualification tracking rules with expiry formulas', icon: 'BadgeCheck', route: '/admin/expiry-codes', parent_code: '4.3', module: 'admin', level: 2 },

  // 4.4 Operations Config
  { code: '4.4', name: 'Operations Config', description: 'Operations module configuration', icon: 'Cog', route: '/admin/operations-config', parent_code: '4', module: 'admin', level: 1 },

  // ──────────────────────────────────────────────
  // 5. GROUND
  // ──────────────────────────────────────────────
  { code: '5', name: 'Ground', description: 'Ground handling and airport operations', icon: 'Warehouse', route: '/ground', parent_code: null, module: 'ground', level: 0 },

  // ──────────────────────────────────────────────
  // 6. INTEGRATION
  // ──────────────────────────────────────────────
  { code: '6', name: 'Integration', description: 'External system integrations and data exchange', icon: 'ArrowLeftRight', route: '/integration', parent_code: null, module: 'integration', level: 0 },
]

// ─── Index maps for fast lookup ────────────────
const byCode = new Map<string, ModuleEntry>()
const byRoute = new Map<string, ModuleEntry>()
for (const m of MODULE_REGISTRY) {
  byCode.set(m.code, m)
  byRoute.set(m.route, m)
}

/** Get a module by its hierarchical code (e.g. "2.1.2") */
export function getModuleByCode(code: string): ModuleEntry | undefined {
  return byCode.get(code)
}

/** Get a module by its route path (exact match) */
export function getModuleByRoute(route: string): ModuleEntry | undefined {
  return byRoute.get(route)
}

/**
 * Find the best-matching module for a given pathname.
 * Walks from longest to shortest prefix until a match is found.
 */
export function resolveModule(pathname: string): ModuleEntry | undefined {
  // Exact match first
  const exact = byRoute.get(pathname)
  if (exact) return exact

  // Walk up path segments
  const segments = pathname.split('/').filter(Boolean)
  while (segments.length > 0) {
    const candidate = '/' + segments.join('/')
    const match = byRoute.get(candidate)
    if (match) return match
    segments.pop()
  }

  return undefined
}

/** Get direct children of a given parent code */
export function getChildModules(parentCode: string): ModuleEntry[] {
  return MODULE_REGISTRY.filter(m => m.parent_code === parentCode)
}

/** Get the breadcrumb chain for a module: [root, ..., current] */
export function getBreadcrumbChain(codeOrRoute: string): ModuleEntry[] {
  let mod = byCode.get(codeOrRoute) ?? byRoute.get(codeOrRoute)
  if (!mod) {
    // Try resolving as pathname
    mod = resolveModule(codeOrRoute)
  }
  if (!mod) return []

  const chain: ModuleEntry[] = []
  let current: ModuleEntry | undefined = mod
  while (current) {
    chain.unshift(current)
    current = current.parent_code ? byCode.get(current.parent_code) : undefined
  }
  return chain
}

/** Get all top-level modules (level 0) */
export function getTopLevelModules(): ModuleEntry[] {
  return MODULE_REGISTRY.filter(m => m.level === 0)
}

/** Module theme colors for dynamic theming */
export const MODULE_THEMES: Record<string, { accent: string; bg: string; bgSubtle: string }> = {
  network:     { accent: '#2563eb', bg: '#dbeafe', bgSubtle: '#eff6ff' },
  operations:  { accent: '#4f46e5', bg: '#e0e7ff', bgSubtle: '#eef2ff' },
  ground:      { accent: '#059669', bg: '#d1fae5', bgSubtle: '#ecfdf5' },
  workforce:   { accent: '#7c3aed', bg: '#ede9fe', bgSubtle: '#f5f3ff' },
  integration: { accent: '#0891b2', bg: '#cffafe', bgSubtle: '#ecfeff' },
  admin:       { accent: '#64748b', bg: '#e2e8f0', bgSubtle: '#f8fafc' },
}
