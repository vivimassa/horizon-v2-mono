// SkyHub — Navigation Tree (single source of truth)
// Both web and mobile derive routes and navigation from this structure.

import type { LucideIcon } from 'lucide-react-native'
import {
  Home as HomeIcon,
  Calendar,
  Clock,
  Handshake,
  Send,
  Radar,
  Wrench,
  ShieldCheck,
  CalendarDays,
  BarChart3,
  Database,
  UserCircle,
  Globe,
  Map,
  AlertTriangle,
  Info,
  MessageSquare,
  FileText,
  PlaneTakeoff,
  GanttChart,
  Repeat,
  CalendarRange,
  Plane,
  ArrowLeftRight,
  Building2,
  Lock,
  Bell,
  Palette,
  Users,
  DoorOpen,
  LayoutGrid,
  Dock,
  Radio,
  LayoutDashboard,
  SlidersHorizontal,
} from 'lucide-react-native'

export interface NavPage {
  key: string
  label: string
  num: string
  route: string
  icon: LucideIcon
}

export interface NavSection {
  key: string
  label: string
  num: string
  icon: LucideIcon
  pages: NavPage[]
}

export interface NavModule {
  key: string
  label: string
  num: string
  sections: NavSection[]
}

export const NAV_TREE: NavModule[] = [
  // ── 1. Home ──
  {
    key: 'home',
    label: 'Home',
    num: '1',
    sections: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        num: '1.1',
        icon: HomeIcon,
        pages: [{ key: 'dashboard', label: 'Dashboard', num: '1.1.1', route: '/', icon: HomeIcon }],
      },
    ],
  },

  // ── 1. Network ──
  {
    key: 'network',
    label: 'Network',
    num: '1',
    sections: [
      {
        key: 'schedule',
        label: 'Schedule',
        num: '1.1',
        icon: Calendar,
        pages: [
          {
            key: 'text-schedule',
            label: 'Text Schedule',
            num: '1.1.1',
            route: '/network/schedule/text-schedule',
            icon: FileText,
          },
          { key: 'gantt', label: 'Gantt View', num: '1.1.2', route: '/network/schedule/gantt', icon: GanttChart },
          {
            key: 'flight-patterns',
            label: 'Flight Patterns',
            num: '1.1.3',
            route: '/network/schedule/flight-patterns',
            icon: Repeat,
          },
          {
            key: 'schedule-messaging',
            label: 'Schedule Messaging',
            num: '1.1.4',
            route: '/network/control/schedule-messaging',
            icon: MessageSquare,
          },
        ],
      },
      {
        key: 'slots',
        label: 'Slot Management',
        num: '1.2',
        icon: Clock,
        pages: [
          {
            key: 'slot-manager',
            label: 'Slot Manager',
            num: '1.2.1',
            route: '/network/slots/slot-manager',
            icon: Clock,
          },
          {
            key: 'slot-requests',
            label: 'Slot Requests',
            num: '1.2.2',
            route: '/network/slots/slot-requests',
            icon: Send,
          },
        ],
      },
      {
        key: 'commercial',
        label: 'Commercial',
        num: '1.3',
        icon: Handshake,
        pages: [
          {
            key: 'codeshare',
            label: 'Codeshare',
            num: '1.3.1',
            route: '/network/commercial/codeshare',
            icon: Handshake,
          },
          {
            key: 'charter-manager',
            label: 'Charter Manager',
            num: '1.3.2',
            route: '/network/control/charter-manager',
            icon: PlaneTakeoff,
          },
          {
            key: 'aircraft-routes',
            label: 'Aircraft Routes',
            num: '1.3.3',
            route: '/network/commercial/aircraft-routes',
            icon: Globe,
          },
        ],
      },
      {
        key: 'distribution',
        label: 'Distribution',
        num: '1.4',
        icon: Send,
        pages: [
          { key: 'publish', label: 'Publish', num: '1.4.1', route: '/network/distribution/publish', icon: Send },
          {
            key: 'ssim-messaging',
            label: 'SSIM Messaging',
            num: '1.4.2',
            route: '/network/distribution/ssim-messaging',
            icon: MessageSquare,
          },
        ],
      },
    ],
  },

  // ── 2. Flight Ops ──
  {
    key: 'flightops',
    label: 'Flight Ops',
    num: '2',
    sections: [
      {
        key: 'control',
        label: 'Ops Control',
        num: '2.1',
        icon: Radar,
        pages: [
          {
            key: 'movement-control',
            label: 'Movement Control',
            num: '2.1.1',
            route: '/flight-ops/control/movement-control',
            icon: Radar,
          },
          {
            key: 'disruption-customization',
            label: 'Disruption Customization',
            num: '2.1.3.3',
            route: '/flight-ops/control/disruption-center/customization',
            icon: SlidersHorizontal,
          },
          {
            key: 'disruption-management',
            label: 'Disruption Management',
            num: '2.1.3.4',
            route: '/flight-ops/control/disruption-center/disruption-management',
            icon: Radar,
          },
          {
            key: 'movement-messages',
            label: 'Movement Messages',
            num: '2.1.4',
            route: '/flight-ops/control/movement-messages',
            icon: Radio,
          },
          { key: 'world-map', label: 'World Map', num: '2.1.5', route: '/flight-ops/control/world-map', icon: Map },
          {
            key: 'occ-dashboard',
            label: 'OCC Dashboard',
            num: '2.1.6',
            route: '/flight-ops/control/occ-dashboard',
            icon: LayoutDashboard,
          },
        ],
      },
      {
        key: 'tools',
        label: 'Tools',
        num: '2.2',
        icon: Wrench,
        pages: [
          {
            key: 'flight-info',
            label: 'Flight Info',
            num: '2.2.1',
            route: '/flight-ops/tools/flight-info',
            icon: Info,
          },
          {
            key: 'messages',
            label: 'Messages',
            num: '2.2.2',
            route: '/flight-ops/tools/messages',
            icon: MessageSquare,
          },
          {
            key: 'movement-log',
            label: 'Movement Log',
            num: '2.2.3',
            route: '/flight-ops/tools/movement-log',
            icon: FileText,
          },
        ],
      },
      {
        key: 'aircraft-status',
        label: 'Aircraft Status',
        num: '2.3',
        icon: ShieldCheck,
        pages: [
          {
            key: 'health-dashboard',
            label: 'Health Dashboard',
            num: '2.3.1',
            route: '/flight-ops/aircraft-status/health-dashboard',
            icon: BarChart3,
          },
          {
            key: 'check-setup',
            label: 'Check Setup',
            num: '2.3.2',
            route: '/flight-ops/aircraft-status/check-setup',
            icon: ShieldCheck,
          },
          {
            key: 'event-schedule',
            label: 'Event Schedule',
            num: '2.3.3',
            route: '/flight-ops/aircraft-status/event-schedule',
            icon: CalendarDays,
          },
        ],
      },
    ],
  },

  // ── 3. Ground Ops ──
  {
    key: 'groundops',
    label: 'Ground Ops',
    num: '3',
    sections: [
      {
        key: 'handling',
        label: 'Handling',
        num: '3.1',
        icon: Dock,
        pages: [
          {
            key: 'turnaround',
            label: 'Turnaround',
            num: '3.1.1',
            route: '/ground-ops/handling/turnaround',
            icon: Repeat,
          },
          {
            key: 'gate-management',
            label: 'Gate Management',
            num: '3.1.2',
            route: '/ground-ops/handling/gate-management',
            icon: DoorOpen,
          },
          {
            key: 'ground-handling',
            label: 'Ground Handling',
            num: '3.1.3',
            route: '/ground-ops/handling/ground-handling',
            icon: LayoutGrid,
          },
        ],
      },
    ],
  },

  // ── 4. Crew Ops ──
  {
    key: 'crewops',
    label: 'Crew Ops',
    num: '4',
    sections: [
      {
        key: 'planning',
        label: 'Planning',
        num: '4.1',
        icon: CalendarDays,
        pages: [
          {
            key: 'crew-pairing',
            label: 'Crew Pairing',
            num: '4.1.1',
            route: '/crew-ops/planning/crew-pairing',
            icon: Users,
          },
          {
            key: 'auto-assignment',
            label: 'Auto Assignment',
            num: '4.1.2',
            route: '/crew-ops/planning/auto-assignment',
            icon: Plane,
          },
          {
            key: 'roster-view',
            label: 'Roster View',
            num: '4.1.3',
            route: '/crew-ops/planning/roster-view',
            icon: CalendarDays,
          },
        ],
      },
      {
        key: 'visualization',
        label: 'Visualization',
        num: '4.2',
        icon: BarChart3,
        pages: [
          {
            key: 'gcs-gantt',
            label: 'GCS Gantt',
            num: '4.2.1',
            route: '/crew-ops/visualization/gcs-gantt',
            icon: GanttChart,
          },
        ],
      },
      {
        key: 'crew-data',
        label: 'Crew Data',
        num: '4.3',
        icon: Database,
        pages: [
          { key: 'crew-list', label: 'Crew List', num: '4.3.1', route: '/crew-ops/crew-data/crew-list', icon: Users },
          {
            key: 'qualifications',
            label: 'Qualifications',
            num: '4.3.2',
            route: '/crew-ops/crew-data/qualifications',
            icon: ShieldCheck,
          },
          {
            key: 'documents',
            label: 'Documents',
            num: '4.3.3',
            route: '/crew-ops/crew-data/documents',
            icon: FileText,
          },
        ],
      },
    ],
  },

  // ── 6. Settings ──
  {
    key: 'settings',
    label: 'Settings',
    num: '6',
    sections: [
      {
        key: 'account',
        label: 'Account',
        num: '6.1',
        icon: UserCircle,
        pages: [
          { key: 'profile', label: 'Profile', num: '6.1.1', route: '/settings/account/profile', icon: UserCircle },
          {
            key: 'appearance',
            label: 'Appearance',
            num: '6.1.2',
            route: '/settings/account/appearance',
            icon: Palette,
          },
          {
            key: 'notifications',
            label: 'Notifications',
            num: '6.1.3',
            route: '/settings/account/notifications',
            icon: Bell,
          },
          { key: 'security', label: 'Security', num: '6.1.4', route: '/settings/account/security', icon: Lock },
        ],
      },
      {
        key: 'admin',
        label: 'Administration',
        num: '6.2',
        icon: ShieldCheck,
        pages: [
          {
            key: 'master-data',
            label: 'Master Data',
            num: '6.2.1',
            route: '/settings/admin/master-data',
            icon: Database,
          },
          {
            key: 'users-roles',
            label: 'Users & Roles',
            num: '6.2.2',
            route: '/settings/admin/users-roles',
            icon: Users,
          },
          {
            key: 'interface',
            label: 'Interface',
            num: '6.2.3',
            route: '/settings/admin/interface',
            icon: ArrowLeftRight,
          },
          {
            key: 'operator-config',
            label: 'Operator Config',
            num: '6.2.4',
            route: '/settings/admin/operator-config',
            icon: Building2,
          },
          { key: 'reports', label: 'Reports', num: '6.2.5', route: '/settings/admin/reports', icon: FileText },
        ],
      },
    ],
  },
]
