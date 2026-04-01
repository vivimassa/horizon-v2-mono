// SkyHub — Navigation tree raw data (no React Native / lucide dependencies)
// This file can be safely imported by web (Next.js) without pulling in RN.

export interface NavPageData {
  key: string
  label: string
  num: string
  route: string
  iconName: string
}

export interface NavSectionData {
  key: string
  label: string
  num: string
  iconName: string
  pages: NavPageData[]
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
        { key: 'dashboard', label: 'Dashboard', num: '1.1.1', route: '/', iconName: 'Home' },
      ],
    }],
  },

  // ── 2. Network ──
  {
    key: 'network', label: 'Network', num: '2', iconName: 'Globe',
    sections: [
      {
        key: 'schedule', label: 'Schedule', num: '2.1', iconName: 'Calendar',
        pages: [
          { key: 'text-schedule', label: 'Text Schedule', num: '2.1.1', route: '/network/schedule/text-schedule', iconName: 'FileText' },
          { key: 'gantt', label: 'Gantt View', num: '2.1.2', route: '/network/schedule/gantt', iconName: 'GanttChart' },
          { key: 'flight-patterns', label: 'Flight Patterns', num: '2.1.3', route: '/network/schedule/flight-patterns', iconName: 'Repeat' },
          { key: 'season-manager', label: 'Season Manager', num: '2.1.4', route: '/network/schedule/season-manager', iconName: 'CalendarRange' },
        ],
      },
      {
        key: 'slots', label: 'Slot Management', num: '2.2', iconName: 'Clock',
        pages: [
          { key: 'slot-manager', label: 'Slot Manager', num: '2.2.1', route: '/network/slots/slot-manager', iconName: 'Clock' },
          { key: 'slot-requests', label: 'Slot Requests', num: '2.2.2', route: '/network/slots/slot-requests', iconName: 'Send' },
        ],
      },
      {
        key: 'commercial', label: 'Commercial', num: '2.3', iconName: 'Handshake',
        pages: [
          { key: 'codeshare', label: 'Codeshare', num: '2.3.1', route: '/network/commercial/codeshare', iconName: 'Handshake' },
          { key: 'charter', label: 'Charter', num: '2.3.2', route: '/network/commercial/charter', iconName: 'PlaneTakeoff' },
          { key: 'aircraft-routes', label: 'Aircraft Routes', num: '2.3.3', route: '/network/commercial/aircraft-routes', iconName: 'Globe' },
        ],
      },
      {
        key: 'distribution', label: 'Distribution', num: '2.4', iconName: 'Send',
        pages: [
          { key: 'publish', label: 'Publish', num: '2.4.1', route: '/network/distribution/publish', iconName: 'Send' },
          { key: 'ssim-messaging', label: 'SSIM Messaging', num: '2.4.2', route: '/network/distribution/ssim-messaging', iconName: 'MessageSquare' },
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
          { key: 'movement-control', label: 'Movement Control', num: '3.1.1', route: '/flight-ops/control/movement-control', iconName: 'Radar' },
          { key: 'world-map', label: 'World Map', num: '3.1.2', route: '/flight-ops/control/world-map', iconName: 'Map' },
          { key: 'disruption-center', label: 'Disruption Center', num: '3.1.3', route: '/flight-ops/control/disruption-center', iconName: 'AlertTriangle' },
        ],
      },
      {
        key: 'tools', label: 'Tools', num: '3.2', iconName: 'Wrench',
        pages: [
          { key: 'flight-info', label: 'Flight Info', num: '3.2.1', route: '/flight-ops/tools/flight-info', iconName: 'Info' },
          { key: 'messages', label: 'Messages', num: '3.2.2', route: '/flight-ops/tools/messages', iconName: 'MessageSquare' },
          { key: 'movement-log', label: 'Movement Log', num: '3.2.3', route: '/flight-ops/tools/movement-log', iconName: 'FileText' },
        ],
      },
      {
        key: 'aircraft-status', label: 'Aircraft Status', num: '3.3', iconName: 'ShieldCheck',
        pages: [
          { key: 'health-dashboard', label: 'Health Dashboard', num: '3.3.1', route: '/flight-ops/aircraft-status/health-dashboard', iconName: 'BarChart3' },
          { key: 'check-setup', label: 'Check Setup', num: '3.3.2', route: '/flight-ops/aircraft-status/check-setup', iconName: 'ShieldCheck' },
          { key: 'event-schedule', label: 'Event Schedule', num: '3.3.3', route: '/flight-ops/aircraft-status/event-schedule', iconName: 'CalendarDays' },
        ],
      },
    ],
  },

  // ── 4. Ground Ops ──
  {
    key: 'groundops', label: 'Ground Ops', num: '4', iconName: 'Truck',
    sections: [{
      key: 'handling', label: 'Handling', num: '4.1', iconName: 'Truck',
      pages: [
        { key: 'turnaround', label: 'Turnaround', num: '4.1.1', route: '/ground-ops/handling/turnaround', iconName: 'Repeat' },
        { key: 'gate-management', label: 'Gate Management', num: '4.1.2', route: '/ground-ops/handling/gate-management', iconName: 'DoorOpen' },
        { key: 'ground-handling', label: 'Ground Handling', num: '4.1.3', route: '/ground-ops/handling/ground-handling', iconName: 'LayoutGrid' },
      ],
    }],
  },

  // ── 5. Crew Ops ──
  {
    key: 'crewops', label: 'Crew Ops', num: '5', iconName: 'Users',
    sections: [
      {
        key: 'planning', label: 'Planning', num: '5.1', iconName: 'CalendarDays',
        pages: [
          { key: 'crew-pairing', label: 'Crew Pairing', num: '5.1.1', route: '/crew-ops/planning/crew-pairing', iconName: 'Users' },
          { key: 'auto-assignment', label: 'Auto Assignment', num: '5.1.2', route: '/crew-ops/planning/auto-assignment', iconName: 'Plane' },
          { key: 'roster-view', label: 'Roster View', num: '5.1.3', route: '/crew-ops/planning/roster-view', iconName: 'CalendarDays' },
        ],
      },
      {
        key: 'visualization', label: 'Visualization', num: '5.2', iconName: 'BarChart3',
        pages: [
          { key: 'gcs-gantt', label: 'GCS Gantt', num: '5.2.1', route: '/crew-ops/visualization/gcs-gantt', iconName: 'GanttChart' },
        ],
      },
      {
        key: 'crew-data', label: 'Crew Data', num: '5.3', iconName: 'Database',
        pages: [
          { key: 'crew-list', label: 'Crew List', num: '5.3.1', route: '/crew-ops/crew-data/crew-list', iconName: 'Users' },
          { key: 'qualifications', label: 'Qualifications', num: '5.3.2', route: '/crew-ops/crew-data/qualifications', iconName: 'ShieldCheck' },
          { key: 'documents', label: 'Documents', num: '5.3.3', route: '/crew-ops/crew-data/documents', iconName: 'FileText' },
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
        pages: [
          { key: 'profile', label: 'Profile', num: '6.1.1', route: '/settings/account/profile', iconName: 'UserCircle' },
          { key: 'appearance', label: 'Appearance', num: '6.1.2', route: '/settings/account/appearance', iconName: 'Palette' },
          { key: 'notifications', label: 'Notifications', num: '6.1.3', route: '/settings/account/notifications', iconName: 'Bell' },
          { key: 'security', label: 'Security', num: '6.1.4', route: '/settings/account/security', iconName: 'Lock' },
        ],
      },
      {
        key: 'admin', label: 'Administration', num: '6.2', iconName: 'ShieldCheck',
        pages: [
          { key: 'master-data', label: 'Master Data', num: '6.2.1', route: '/settings/admin/master-data', iconName: 'Database' },
          { key: 'users-roles', label: 'Users & Roles', num: '6.2.2', route: '/settings/admin/users-roles', iconName: 'Users' },
          { key: 'interface', label: 'Interface', num: '6.2.3', route: '/settings/admin/interface', iconName: 'ArrowLeftRight' },
          { key: 'operator-config', label: 'Operator Config', num: '6.2.4', route: '/settings/admin/operator-config', iconName: 'Building2' },
          { key: 'reports', label: 'Reports', num: '6.2.5', route: '/settings/admin/reports', iconName: 'FileText' },
        ],
      },
    ],
  },
]
