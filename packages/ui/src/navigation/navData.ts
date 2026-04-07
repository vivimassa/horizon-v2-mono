// SkyHub — Navigation tree raw data (no React Native / lucide dependencies)
// This file can be safely imported by web (Next.js) without pulling in RN.

export interface NavPageData {
  key: string
  label: string
  num: string
  route: string
  iconName: string
  desc?: string
  /** Optional group header for dropdown rendering (e.g. "Network", "Flight Ops") */
  group?: string
  groupIconName?: string
}

export interface NavSectionData {
  key: string
  label: string
  num: string
  iconName: string
  /** Optional landing route for this section (e.g. /admin). Falls back to first page route. */
  route?: string
  pages: NavPageData[]
  /** When true, this section is hidden in breadcrumbs — pages appear directly under the module */
  flatBreadcrumb?: boolean
}

export interface NavModuleData {
  key: string
  label: string
  num: string
  iconName: string
  sections: NavSectionData[]
}

export const NAV_TREE: NavModuleData[] = [
  // ── 1. Home ──
  {
    key: 'home', label: 'Home', num: '1', iconName: 'Home',
    sections: [{
      key: 'dashboard', label: 'Dashboard', num: '1.1', iconName: 'Home',
      pages: [
        { key: 'dashboard', label: 'Dashboard', num: '1.1.1', route: '/', iconName: 'Home', desc: 'KPIs & today\'s flights' },
      ],
    }],
  },

  // ── 2. Network ──
  {
    key: 'network', label: 'Network', num: '1', iconName: 'Globe',
    sections: [
      {
        key: 'schedule', label: 'Schedule', num: '1.1', iconName: 'Calendar',
        pages: [
          { key: 'schedule-grid', label: 'Scheduling XL', num: '1.1.1', route: '/network/control/schedule-grid', iconName: 'LayoutGrid', desc: 'Excel-style flight schedule editor' },
          { key: 'gantt', label: 'Gantt Chart', num: '1.1.2', route: '/network/schedule/gantt', iconName: 'GanttChart', desc: 'Visual timeline' },
          { key: 'flight-patterns', label: 'Flight Patterns', num: '1.1.3', route: '/network/schedule/flight-patterns', iconName: 'Repeat', desc: 'Build & edit patterns' },
          { key: 'season-manager', label: 'Season Manager', num: '1.1.4', route: '/network/schedule/season-manager', iconName: 'CalendarRange', desc: 'Seasonal schedule management' },
        ],
      },
      {
        key: 'slots', label: 'Slot Management', num: '1.2', iconName: 'Clock',
        pages: [
          { key: 'slot-manager', label: 'Slot Manager', num: '1.2.1', route: '/network/slots/slot-manager', iconName: 'Clock', desc: 'Airport slot allocation' },
          { key: 'slot-requests', label: 'Slot Requests', num: '1.2.2', route: '/network/slots/slot-requests', iconName: 'Send', desc: 'Request & track slots' },
        ],
      },
      {
        key: 'commercial', label: 'Commercial', num: '2.3', iconName: 'Handshake',
        pages: [
          { key: 'codeshare', label: 'Codeshare', num: '2.3.1', route: '/network/commercial/codeshare', iconName: 'Handshake', desc: 'Codeshare agreements' },
          { key: 'charter', label: 'Charter', num: '2.3.2', route: '/network/commercial/charter', iconName: 'PlaneTakeoff', desc: 'Charter flights' },
          { key: 'aircraft-routes', label: 'Aircraft Routes', num: '2.3.3', route: '/network/commercial/aircraft-routes', iconName: 'Globe', desc: 'Route-tail assignment' },
        ],
      },
      {
        key: 'distribution', label: 'Distribution', num: '2.4', iconName: 'Send',
        pages: [
          { key: 'publish', label: 'Publish', num: '2.4.1', route: '/network/distribution/publish', iconName: 'Send', desc: 'Publish & distribute' },
          { key: 'ssim-messaging', label: 'SSIM Messaging', num: '2.4.2', route: '/network/distribution/ssim-messaging', iconName: 'MessageSquare', desc: 'SSIM/SSM distribution' },
        ],
      },
    ],
  },

  // ── 3. Flight Ops ──
  {
    key: 'flightops', label: 'Flight Ops', num: '3', iconName: 'Plane',
    sections: [
      {
        key: 'control', label: 'Ops Control', num: '3.1', iconName: 'Radar',
        pages: [
          { key: 'movement-control', label: 'Movement Control', num: '3.1.1', route: '/flight-ops/control/movement-control', iconName: 'Radar', desc: 'Live flight tracking & OOOI' },
          { key: 'world-map', label: 'World Map', num: '3.1.2', route: '/flight-ops/control/world-map', iconName: 'Map', desc: 'Global fleet positions' },
          { key: 'disruption-center', label: 'Disruption Center', num: '3.1.3', route: '/flight-ops/control/disruption-center', iconName: 'AlertTriangle', desc: 'IROPS & recovery' },
        ],
      },
      {
        key: 'tools', label: 'Tools', num: '3.2', iconName: 'Wrench',
        pages: [
          { key: 'flight-info', label: 'Flight Info', num: '3.2.1', route: '/flight-ops/tools/flight-info', iconName: 'Info', desc: 'Detailed flight view' },
          { key: 'messages', label: 'Messages', num: '3.2.2', route: '/flight-ops/tools/messages', iconName: 'MessageSquare', desc: 'MVT/LDM messages' },
          { key: 'movement-log', label: 'Movement Log', num: '3.2.3', route: '/flight-ops/tools/movement-log', iconName: 'FileText', desc: 'Historical movements' },
        ],
      },
      {
        key: 'aircraft-status', label: 'Aircraft Status', num: '3.3', iconName: 'ShieldCheck',
        pages: [
          { key: 'health-dashboard', label: 'Health Dashboard', num: '3.3.1', route: '/flight-ops/aircraft-status/health-dashboard', iconName: 'BarChart3', desc: 'Aircraft health overview' },
          { key: 'check-setup', label: 'Check Setup', num: '3.3.2', route: '/flight-ops/aircraft-status/check-setup', iconName: 'ShieldCheck', desc: 'Maintenance check config' },
          { key: 'event-schedule', label: 'Event Schedule', num: '3.3.3', route: '/flight-ops/aircraft-status/event-schedule', iconName: 'CalendarDays', desc: 'Schedule maintenance events' },
        ],
      },
    ],
  },

  // ── 4. Ground Ops ──
  {
    key: 'groundops', label: 'Ground Ops', num: '4', iconName: 'Truck',
    sections: [
      {
        key: 'planning', label: 'Planning', num: '4.1', iconName: 'ClipboardList',
        pages: [
          { key: 'cargo-acceptance', label: 'Cargo Acceptance', num: '4.1.1', route: '/ground-ops/planning/cargo-acceptance', iconName: 'PackageCheck', desc: 'Review booked cargo, weigh, screen' },
          { key: 'dangerous-goods', label: 'Dangerous Goods', num: '4.1.2', route: '/ground-ops/planning/dangerous-goods', iconName: 'AlertTriangle', desc: 'DG verification & NOTOC generation' },
          { key: 'loading-plan', label: 'Loading Plan', num: '4.1.3', route: '/ground-ops/cargo/cargo-manifest', iconName: 'Package', desc: 'Assign cargo to compartments (LIR)' },
          { key: 'seat-plan', label: 'Seat Plan', num: '4.1.4', route: '/ground-ops/planning/seat-plan', iconName: 'Armchair', desc: 'Pax seating distribution for W&B zones' },
        ],
      },
      {
        key: 'loading', label: 'Live Loading', num: '4.2', iconName: 'Loader',
        pages: [
          { key: 'skyhub-go', label: 'SkyHub GO', num: '4.2.1', route: '/ground-ops/loading/skyhub-go', iconName: 'Truck', desc: 'Station board, KPIs & flight ops' },
          { key: 'flight-loading', label: 'Flight Loading', num: '4.2.2', route: '/ground-ops/loading/flight-loading', iconName: 'Plane', desc: 'Unified cargo + pax live view' },
          { key: 'handler-view', label: 'Handler View', num: '4.2.3', route: '/ground-ops/loading/handler-view', iconName: 'Smartphone', desc: 'Ground handler confirmation (SkyHub)' },
        ],
      },
      {
        key: 'load-control', label: 'Load Control', num: '4.3', iconName: 'Scale',
        pages: [
          { key: 'load-summary', label: 'Load Summary', num: '4.3.1', route: '/ground-ops/load-control/load-summary', iconName: 'BarChart3', desc: 'Combined pax + cargo + bags dashboard' },
          { key: 'messages', label: 'Messages', num: '4.3.2', route: '/ground-ops/load-control/messages', iconName: 'MessageSquare', desc: 'Generate LDM, CPM, NOTOC' },
          { key: 'loadsheet', label: 'Loadsheet', num: '4.3.3', route: '/ground-ops/load-control/loadsheet', iconName: 'FileBarChart', desc: 'Weight & Balance' },
          { key: 'lmc', label: 'Last Minute Changes', num: '4.3.4', route: '/ground-ops/load-control/lmc', iconName: 'PenLine', desc: 'Recalculate after late changes' },
          { key: 'captain-acceptance', label: 'Captain Acceptance', num: '4.3.5', route: '/ground-ops/load-control/captain-acceptance', iconName: 'BadgeCheck', desc: 'Digital sign-off, push to EFB' },
        ],
      },
      {
        key: 'reports', label: 'Reports', num: '4.4', iconName: 'BarChart3',
        pages: [
          { key: 'loading-history', label: 'Loading History', num: '4.4.1', route: '/ground-ops/reports/loading-history', iconName: 'History', desc: 'Archived loadsheets & messages' },
          { key: 'ground-performance', label: 'Ground Performance', num: '4.4.2', route: '/ground-ops/reports/ground-performance', iconName: 'TrendingUp', desc: 'Turnaround times & load factors' },
          { key: 'dg-log', label: 'DG Log', num: '4.4.3', route: '/ground-ops/reports/dg-log', iconName: 'ShieldAlert', desc: 'Dangerous goods audit trail' },
        ],
      },
    ],
  },

  // ── 5. Crew Ops ──
  {
    key: 'crewops', label: 'Crew Ops', num: '5', iconName: 'Users',
    sections: [
      {
        key: 'planning', label: 'Planning', num: '5.1', iconName: 'CalendarDays',
        pages: [
          { key: 'crew-pairing', label: 'Crew Pairing', num: '5.1.1', route: '/crew-ops/planning/crew-pairing', iconName: 'Users', desc: 'Build pairings from flights' },
          { key: 'auto-assignment', label: 'Auto Assignment', num: '5.1.2', route: '/crew-ops/planning/auto-assignment', iconName: 'Plane', desc: 'Automated crew assignment' },
          { key: 'roster-view', label: 'Roster View', num: '5.1.3', route: '/crew-ops/planning/roster-view', iconName: 'CalendarDays', desc: 'Crew schedule view' },
        ],
      },
      {
        key: 'visualization', label: 'Visualization', num: '5.2', iconName: 'BarChart3',
        pages: [
          { key: 'gcs-gantt', label: 'GCS Gantt', num: '5.2.1', route: '/crew-ops/visualization/gcs-gantt', iconName: 'GanttChart', desc: 'Crew schedule visualization' },
        ],
      },
      {
        key: 'crew-data', label: 'Crew Data', num: '5.3', iconName: 'Database',
        pages: [
          { key: 'crew-list', label: 'Crew List', num: '5.3.1', route: '/crew-ops/crew-data/crew-list', iconName: 'Users', desc: 'Crew records & qualifications' },
          { key: 'qualifications', label: 'Qualifications', num: '5.3.2', route: '/crew-ops/crew-data/qualifications', iconName: 'ShieldCheck', desc: 'License & rating tracking' },
          { key: 'documents', label: 'Documents', num: '5.3.3', route: '/crew-ops/crew-data/documents', iconName: 'FileText', desc: 'Crew document management' },
        ],
      },
    ],
  },

  // ── 6. Settings ──
  {
    key: 'settings', label: 'Settings', num: '6', iconName: 'Settings',
    sections: [
      {
        key: 'account', label: 'Account', num: '6.1', iconName: 'UserCircle',
        flatBreadcrumb: true,
        pages: [
          { key: 'profile', label: 'Profile', num: '6.1.1', route: '/settings/account/profile', iconName: 'UserCircle', desc: 'Personal details' },
          { key: 'appearance', label: 'Appearance', num: '6.1.2', route: '/settings/account/appearance', iconName: 'Palette', desc: 'Theme & display' },
          { key: 'notifications', label: 'Notifications', num: '6.1.3', route: '/settings/account/notifications', iconName: 'Bell', desc: 'Alert preferences' },
          { key: 'security', label: 'Security', num: '6.1.4', route: '/settings/account/security', iconName: 'Lock', desc: 'Password & 2FA' },
        ],
      },
      {
        key: 'admin', label: 'Administration', num: '6.2', iconName: 'ShieldCheck',
        flatBreadcrumb: true,
        pages: [
          { key: 'users-roles', label: 'Users & Roles', num: '6.2.1', route: '/settings/admin/users-roles', iconName: 'Users', desc: 'Access management' },
          { key: 'interface', label: 'Interface', num: '6.2.2', route: '/settings/admin/interface', iconName: 'ArrowLeftRight', desc: 'Integrations & APIs' },
          { key: 'operator-config', label: 'Operator Config', num: '6.2.3', route: '/settings/admin/operator-config', iconName: 'Building2', desc: 'Airline settings' },
          { key: 'reports', label: 'Reports', num: '6.2.4', route: '/settings/admin/reports', iconName: 'FileText', desc: 'System reports' },
        ],
      },
      {
        key: 'master-database', label: 'Master Database', num: '6.3', iconName: 'Database', route: '/admin',
        pages: [
          // Network
          { key: 'countries', label: 'Countries', num: '5.1.1', route: '/admin/countries', iconName: 'Globe', desc: 'ISO codes, regions, currency', group: 'Network', groupIconName: 'Globe' },
          { key: 'airports', label: 'Airports', num: '5.1.2', route: '/admin/airports', iconName: 'PlaneTakeoff', desc: 'ICAO/IATA codes, coordinates, facilities', group: 'Network', groupIconName: 'Globe' },
          { key: 'city-pairs', label: 'Citypairs', num: '5.1.3', route: '/admin/city-pairs', iconName: 'ArrowLeftRight', desc: 'Routes, distances, block times', group: 'Network', groupIconName: 'Globe' },
          { key: 'lopa', label: 'LOPA', num: '5.1.4', route: '/admin/lopa', iconName: 'Armchair', desc: 'Cabin classes and seat configurations', group: 'Network', groupIconName: 'Globe' },
          { key: 'service-types', label: 'Flight Service Types', num: '5.1.5', route: '/admin/service-types', iconName: 'Tag', desc: 'Define flight service types for your operation', group: 'Network', groupIconName: 'Globe' },
          { key: 'carrier-codes', label: 'Carrier Codes', num: '5.1.6', route: '/admin/carrier-codes', iconName: 'Building2', desc: 'Codeshare & wetlease carrier definitions', group: 'Network', groupIconName: 'Globe' },
          // Flight Ops
          { key: 'aircraft-types', label: 'Aircraft Types', num: '5.2.1', route: '/admin/aircraft-types', iconName: 'Plane', desc: 'Fleet types, capacity, performance', group: 'Flight Ops', groupIconName: 'Plane' },
          { key: 'aircraft-registrations', label: 'Aircraft Registrations', num: '5.2.2', route: '/admin/aircraft-registrations', iconName: 'PlaneTakeoff', desc: 'Tail numbers, MSN, status, home base', group: 'Flight Ops', groupIconName: 'Plane' },
          { key: 'delay-codes', label: 'Delay Codes', num: '5.2.3', route: '/admin/delay-codes', iconName: 'Timer', desc: 'IATA standard & custom codes', group: 'Flight Ops', groupIconName: 'Plane' },
          // Crew Ops
          { key: 'crew-bases', label: 'Crew Bases', num: '5.4.1', route: '/admin/crew-bases', iconName: 'MapPin', desc: 'Airport crew home bases & reporting times', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'crew-positions', label: 'Crew Positions', num: '5.4.2', route: '/admin/crew-positions', iconName: 'UserRound', desc: 'Cockpit & cabin roles, rank order', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'expiry-codes', label: 'Expiry Codes', num: '5.4.3', route: '/admin/expiry-codes', iconName: 'FileCheck', desc: 'Qualification validity & formulas', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'activity-codes', label: 'Activity Codes', num: '5.4.4', route: '/admin/activity-codes', iconName: 'Activity', desc: 'Duty, standby, training & leave classification', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'crew-complements', label: 'Crew Complements', num: '5.4.5', route: '/admin/crew-complements', iconName: 'Users', desc: 'Aircraft type crew requirements & templates', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'crew-groups', label: 'Crew Groups', num: '5.4.6', route: '/admin/crew-groups', iconName: 'Users', desc: 'Scheduling groups & crew classification', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'fdt-rules', label: 'FDT Rules', num: '5.4.7', route: '/admin/fdt-rules', iconName: 'ShieldCheck', desc: 'Flight duty time limitations & regulatory framework', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'duty-patterns', label: 'Off/Duty Patterns', num: '5.4.8', route: '/admin/duty-patterns', iconName: 'CalendarDays', desc: 'ON/OFF rotation patterns for crew rostering', group: 'Crew Ops', groupIconName: 'Users' },
          { key: 'mpp-lead-times', label: 'MPP Lead Times', num: '5.4.9', route: '/admin/mpp-lead-times', iconName: 'Timer', desc: 'Training & recruitment lead times for manpower planning', group: 'Crew Ops', groupIconName: 'Users' },
        ],
      },
    ],
  },
]
