export interface ModuleEntry {
  code: string
  name: string
  description: string
  icon: string
  route: string
  parent_code: string | null
  /** Top-level module key for theming */
  module: 'home' | 'network' | 'operations' | 'ground' | 'workforce' | 'integration' | 'admin' | 'sysadmin' | 'settings'
  level: number
}

/**
 * Sky Hub module registry.
 * Codes follow a hierarchical numbering system:
 *   1. Network  2. Flight Ops  3. Ground Ops  4. Crew Ops  5. Settings/Admin  6. Integration
 *   x.1 Control  x.2 Tools  x.3 Reports
 *   x.y.z Leaf items
 */
export const MODULE_REGISTRY: ModuleEntry[] = [
  // ──────────────────────────────────────────────
  // 0. HOME
  // ──────────────────────────────────────────────
  {
    code: '0',
    name: 'Home',
    description: 'Dashboard with KPIs and daily overview',
    icon: 'Home',
    route: '/',
    parent_code: null,
    module: 'home',
    level: 0,
  },

  // ──────────────────────────────────────────────
  // 1. NETWORK
  // ──────────────────────────────────────────────
  {
    code: '1',
    name: 'Network',
    description: 'Route management, airports, and fleet infrastructure',
    icon: 'Globe',
    route: '/network',
    parent_code: null,
    module: 'network',
    level: 0,
  },

  // 1.1 Control
  {
    code: '1.1',
    name: 'Control',
    description: 'Schedule planning, administration, and distribution',
    icon: 'Settings',
    route: '/network/control',
    parent_code: '1',
    module: 'network',
    level: 1,
  },
  {
    code: '1.1.1',
    name: 'Scheduling XL',
    description: 'Excel-style flight schedule editor with inline editing and bulk operations',
    icon: 'LayoutGrid',
    route: '/network/control/schedule-grid',
    parent_code: '1.1',
    module: 'network',
    level: 2,
  },
  {
    code: '1.1.2',
    name: 'Gantt Chart',
    description: 'Aircraft rotation timeline showing fleet utilization and tail assignment',
    icon: 'GanttChart',
    route: '/network/schedule/gantt',
    parent_code: '1.1',
    module: 'network',
    level: 2,
  },
  {
    code: '1.1.3',
    name: 'Slot Planning',
    description: 'Track airport slot allocations and IATA 80/20 utilization',
    icon: 'CalendarClock',
    route: '/network/schedule/slot-manager',
    parent_code: '1.1',
    module: 'network',
    level: 2,
  },
  {
    code: '1.1.4',
    name: 'Codeshare Manager',
    description: 'Manage codeshare agreements and partner flight designators',
    icon: 'Link2',
    route: '/network/control/codeshare-manager',
    parent_code: '1.1',
    module: 'network',
    level: 2,
  },
  {
    code: '1.1.5',
    name: 'Charter Manager',
    description: 'Manage ad-hoc and charter flight operations',
    icon: 'PlaneTakeoff',
    route: '/network/control/charter-manager',
    parent_code: '1.1',
    module: 'network',
    level: 2,
  },
  {
    code: '1.1.6',
    name: 'Schedule Messaging',
    description: 'Generate and process ASM and SSM messages for schedule distribution',
    icon: 'MessageSquareShare',
    route: '/network/control/schedule-messaging',
    parent_code: '1.1',
    module: 'network',
    level: 2,
  },

  // 1.2 Tools
  {
    code: '1.2',
    name: 'Tools',
    description: 'Network tools and utilities',
    icon: 'Wrench',
    route: '/network/tools',
    parent_code: '1',
    module: 'network',
    level: 1,
  },
  {
    code: '1.2.1',
    name: 'SSIM Import',
    description: 'Import SSIM format files to create or update flight schedules',
    icon: 'Upload',
    route: '/network/tools/ssim-import',
    parent_code: '1.2',
    module: 'network',
    level: 2,
  },
  {
    code: '1.2.2',
    name: 'SSIM Export',
    description: 'Export flight schedules in SSIM format for distribution systems',
    icon: 'Download',
    route: '/network/tools/ssim-export',
    parent_code: '1.2',
    module: 'network',
    level: 2,
  },
  {
    code: '1.2.3',
    name: 'SSIM Comparison',
    description: 'Compare two SSIM files or seasons to identify schedule differences',
    icon: 'GitCompareArrows',
    route: '/network/tools/ssim-comparison',
    parent_code: '1.2',
    module: 'network',
    level: 2,
  },
  {
    code: '1.2.4',
    name: 'Scenario Compare',
    description: 'Compare planning scenarios side by side',
    icon: 'GitCompareArrows',
    route: '/network/tools/scenario-compare',
    parent_code: '1.2',
    module: 'network',
    level: 2,
  },
  // 1.3 Reports
  {
    code: '1.3',
    name: 'Reports',
    description: 'Network reports and analytics',
    icon: 'FileText',
    route: '/network/reports',
    parent_code: '1',
    module: 'network',
    level: 1,
  },
  {
    code: '1.3.1',
    name: 'Daily Flight Schedule',
    description: 'View daily flight schedules with filtering, sorting, and export',
    icon: 'CalendarDays',
    route: '/network/reports/daily-schedule',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.2',
    name: 'Frequency Analysis',
    description: 'Flight frequencies by day of week, seasonal, and operation days',
    icon: 'CalendarRange',
    route: '/network/reports/frequency-analysis',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.3',
    name: 'Schedule Summary',
    description: 'Season overview with fleet deployment and capacity trends',
    icon: 'LayoutDashboard',
    route: '/network/reports/schedule-summary',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.4',
    name: 'Public Timetable',
    description: 'Passenger-facing timetable by route with local times and frequencies',
    icon: 'Globe',
    route: '/network/reports/public-timetable',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.5',
    name: 'Fleet Utilization',
    description: 'Analyse scheduled fleet utilization by aircraft type and registration',
    icon: 'BarChart3',
    route: '/network/reports/fleet-utilization',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.6',
    name: 'Route Summary',
    description: 'Every city pair with block time, frequency, and capacity',
    icon: 'Waypoints',
    route: '/network/reports/route-summary',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.7',
    name: 'Airport Activity',
    description: 'Departures, arrivals, peak hours per station',
    icon: 'PlaneTakeoff',
    route: '/network/reports/airport-activity',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },
  {
    code: '1.3.8',
    name: 'FIDS',
    description: 'Flight information display for a selected airport and date',
    icon: 'Monitor',
    route: '/network/reports/fids',
    parent_code: '1.3',
    module: 'network',
    level: 2,
  },

  // ──────────────────────────────────────────────
  // 2. OPERATIONS
  // ──────────────────────────────────────────────
  {
    code: '2',
    name: 'Flight Ops',
    description: 'Flight operations, scheduling, and dispatch',
    icon: 'Plane',
    route: '/flight-ops',
    parent_code: null,
    module: 'operations',
    level: 0,
  },

  // 2.1 Control
  {
    code: '2.1',
    name: 'Control',
    description: 'Operations control panel',
    icon: 'Settings',
    route: '/flight-ops/control',
    parent_code: '2',
    module: 'operations',
    level: 1,
  },
  {
    code: '2.1.1',
    name: 'Movement Control',
    description: 'Real-time aircraft movement tracking and operational decision support',
    icon: 'Radar',
    route: '/flight-ops/control/movement-control',
    parent_code: '2.1',
    module: 'operations',
    level: 2,
  },
  {
    code: '2.1.2',
    name: 'Aircraft Maintenance',
    description: 'Aircraft maintenance tracking, check setup, and scheduling',
    icon: 'Wrench',
    route: '/flight-ops/control/aircraft-maintenance',
    parent_code: '2.1',
    module: 'operations',
    level: 2,
  },
  {
    code: '2.1.2.1',
    name: 'Maintenance Planning',
    description: 'Plan and forecast upcoming maintenance events',
    icon: 'CalendarClock',
    route: '/flight-ops/control/aircraft-maintenance/planning',
    parent_code: '2.1.2',
    module: 'operations',
    level: 3,
  },
  {
    code: '2.1.2.2',
    name: 'Aircraft Status Board',
    description: 'Fleet-wide maintenance status and health overview',
    icon: 'BarChart3',
    route: '/flight-ops/control/aircraft-maintenance/status-board',
    parent_code: '2.1.2',
    module: 'operations',
    level: 3,
  },
  {
    code: '2.1.3',
    name: 'Disruption Center',
    description: 'Disruption toolkit — live IROPS management, ML training and AI customization',
    icon: 'ShieldAlert',
    route: '/flight-ops/control/disruption-center',
    parent_code: '2.1',
    module: 'operations',
    level: 2,
  },
  // 2.1.3.1 — Machine Learning Training (FUTURE, next year).
  // Purpose: let each operator train the disruption-prediction model on THEIR
  // own historical data (flights, tail swaps, crew mods, cancellations, weather
  // at the time). The global v1 model was fleet-agnostic and weak.
  //
  // Data sources to wire in when this ships:
  //   - Internal: flight_instances, crew_modifications (once Crew Ops exists),
  //     maintenance_events, disruption_issues history.
  //   - External weather (historical METAR):
  //       * Iowa State IEM ASOS archive — free CSV, decades, preferred for ML.
  //         https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py
  //       * NOAA ISD via NCEI — authoritative, bulk download.
  //   - NOAA AWC live API only gives 15 days via hoursBeforeNow — NOT enough
  //     for training. Do not rely on it for this module.
  //
  // Scope when built: dataset picker (date range, stations, fleet), feature
  // preview, train/validate/publish flow, per-operator model versioning, A/B
  // comparison against baseline rules. Keep UI separate from the live
  // Disruption Center feed — this is a lab surface, not an ops surface.
  {
    code: '2.1.3.1',
    name: 'Machine Learning Training',
    description:
      'Train the disruption-prediction model on operator-specific historical data (planned — not yet built).',
    icon: 'Brain',
    route: '/flight-ops/control/disruption-center/ml-training',
    parent_code: '2.1.3',
    module: 'operations',
    level: 3,
  },
  // 2.1.3.2 — AI Customization (FUTURE, stub only).
  // Per-operator controls over the Disruption Center AI advisor. Principle:
  // users never see raw model names (Haiku/Sonnet/Opus) — instead pick a
  // "smartness tier" with a friendly label. What matters is output quality,
  // not the underlying model.
  //
  // Planned features: smartness tier, advisory-scope toggles, priority
  // weights (OTP vs cost vs crew welfare), regulatory context (CAAV VAR 15 /
  // FAA / EASA), operator SOP upload (RAG), output language, feedback loop,
  // cost guardrails, allowed-action scope, privacy/redaction, confidence
  // threshold. Full notes live in the stub page.
  {
    code: '2.1.3.2',
    name: 'AI Customization',
    description:
      'Tune the Disruption Center AI advisor — smartness, scope, tone and priorities (planned — not yet built).',
    icon: 'Sparkles',
    route: '/flight-ops/control/disruption-center/ai-customization',
    parent_code: '2.1.3',
    module: 'operations',
    level: 3,
  },
  // 2.1.3.3 — Disruption Customization. Per-operator tuning of the
  // Disruption Management surface (SLAs, backlog threshold, rolling-period
  // stops, vocabulary overrides, resolution types). Config-first flow:
  // users set ML (2.1.3.1) → AI (2.1.3.2) → Disruption rules (2.1.3.3)
  // before operating the module (2.1.3.4).
  {
    code: '2.1.3.3',
    name: 'Disruption Customization',
    description: 'Tune SLAs, labels, resolution vocabulary and feed defaults for the Disruption Management module.',
    icon: 'SlidersHorizontal',
    route: '/flight-ops/control/disruption-center/customization',
    parent_code: '2.1.3',
    module: 'operations',
    level: 3,
  },
  // 2.1.3.4 — Disruption Management. The live ops surface for IROPS
  // handling. Rule-based detection today; ML predictions plug in from
  // 2.1.3.1 and the AI advisor from 2.1.3.2 without changes here.
  {
    code: '2.1.3.4',
    name: 'Disruption Management',
    description: 'Live IROPS feed, severity triage and recovery-solver hand-off.',
    icon: 'Radar',
    route: '/flight-ops/control/disruption-center/disruption-management',
    parent_code: '2.1.3',
    module: 'operations',
    level: 3,
  },
  {
    code: '2.1.4',
    name: 'Communication Deck',
    description: 'Monitor incoming ACARS events and outgoing MVT/LDM messages',
    icon: 'Radio',
    route: '/flight-ops/control/communication-deck',
    parent_code: '2.1',
    module: 'operations',
    level: 2,
  },
  {
    code: '2.1.5',
    name: 'World Map',
    description: 'Global flight tracking on an interactive world map',
    icon: 'Globe',
    route: '/flight-ops/control/world-map',
    parent_code: '2.1',
    module: 'operations',
    level: 2,
  },
  {
    code: '2.1.6',
    name: 'OCC Dashboard',
    description: 'Operations control centre overview',
    icon: 'LayoutDashboard',
    route: '/flight-ops/control/occ-dashboard',
    parent_code: '2.1',
    module: 'operations',
    level: 2,
  },

  // 2.3 Reports
  {
    code: '2.3',
    name: 'Reports',
    description: 'Operations reports and analytics',
    icon: 'FileText',
    route: '/flight-ops/reports',
    parent_code: '2',
    module: 'operations',
    level: 1,
  },
  {
    code: '2.3.1',
    name: 'OTP Report',
    description: 'On-time performance analysis',
    icon: 'Clock',
    route: '/flight-ops/reports/otp-report',
    parent_code: '2.3',
    module: 'operations',
    level: 2,
  },
  {
    code: '2.3.2',
    name: 'Delay Analysis',
    description: 'Delay statistics and trends',
    icon: 'BarChart3',
    route: '/flight-ops/reports/delay-analysis',
    parent_code: '2.3',
    module: 'operations',
    level: 2,
  },

  // ──────────────────────────────────────────────
  // 3. GROUND
  // ──────────────────────────────────────────────
  {
    code: '3',
    name: 'Ground Ops',
    description: 'Ground handling and airport operations',
    icon: 'Truck',
    route: '/ground-ops',
    parent_code: null,
    module: 'ground',
    level: 0,
  },

  // 3.1 Cargo
  {
    code: '3.1',
    name: 'Cargo',
    description: 'Cargo operations and loading',
    icon: 'Package',
    route: '/ground-ops/cargo',
    parent_code: '3',
    module: 'ground',
    level: 1,
  },
  {
    code: '3.1.1',
    name: 'Cargo Manifest',
    description: 'Aircraft loading and cargo manifest management',
    icon: 'Package',
    route: '/ground-ops/cargo/cargo-manifest',
    parent_code: '3.1',
    module: 'ground',
    level: 2,
  },

  // ──────────────────────────────────────────────
  // 4. CREW OPS
  // ──────────────────────────────────────────────
  {
    code: '4',
    name: 'Crew Ops',
    description: 'Crew management, rostering, and personnel',
    icon: 'Users',
    route: '/crew-ops',
    parent_code: null,
    module: 'workforce',
    level: 0,
  },

  // 4.1 Control
  {
    code: '4.1',
    name: 'Control',
    description: 'Crew operations control panel',
    icon: 'Settings',
    route: '/crew-ops/control',
    parent_code: '4',
    module: 'workforce',
    level: 1,
  },
  {
    code: '4.1.1',
    name: 'Crew Profile',
    description: 'Browse and manage crew member profiles and qualifications',
    icon: 'UserCircle',
    route: '/crew-ops/control/crew-profile',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.1.2',
    name: 'Crew Documents',
    description: 'Crew compliance documents, licences, and certificates',
    icon: 'FileText',
    route: '/crew-ops/control/documents',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.1.3',
    name: 'Crew Availability',
    description: 'Track crew availability, leave, and off-duty periods',
    icon: 'CalendarCheck',
    route: '/crew-ops/control/availability',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.1.4',
    name: 'Manpower Planning',
    description: 'Forecast crew requirements against operational demand',
    icon: 'Users',
    route: '/crew-ops/control/manpower-planning',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.1.5',
    name: 'Crew Pairing',
    description: 'Build and optimize crew pairings aligned with FDTL limits',
    icon: 'GitMerge',
    route: '/crew-ops/control/pairing',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.1.6',
    name: 'Crew Schedule',
    description: 'Interactive Gantt-based crew schedule with drag-and-drop assignment',
    icon: 'CalendarDays',
    route: '/crew-ops/control/crew-schedule',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.1.7',
    name: 'Crew Tracking',
    description: 'Real-time crew tracking with list, Gantt, and map views',
    icon: 'Activity',
    route: '/crew-ops/control/tracking',
    parent_code: '4.1',
    module: 'workforce',
    level: 2,
  },

  // 4.3 Reports
  {
    code: '4.3',
    name: 'Reports',
    description: 'Crew operations reports and analytics',
    icon: 'FileText',
    route: '/crew-ops/reports',
    parent_code: '4',
    module: 'workforce',
    level: 1,
  },
  {
    code: '4.3.1',
    name: 'FDTL Report',
    description: 'Flight duty time analysis',
    icon: 'Clock',
    route: '/crew-ops/reports/fdtl-report',
    parent_code: '4.3',
    module: 'workforce',
    level: 2,
  },
  {
    code: '4.3.2',
    name: 'Roster Summary',
    description: 'Roster coverage and statistics',
    icon: 'BarChart3',
    route: '/crew-ops/reports/roster-summary',
    parent_code: '4.3',
    module: 'workforce',
    level: 2,
  },

  // ──────────────────────────────────────────────
  // 5. MASTER DATABASE
  // ──────────────────────────────────────────────
  {
    code: '5',
    name: 'Master Database',
    description: 'Reference data catalogues for every operational domain',
    icon: 'Database',
    route: '/settings',
    parent_code: null,
    module: 'admin',
    level: 0,
  },

  // 5.1 Network (Master Database)
  {
    code: '5.1',
    name: 'Network',
    description: 'Network reference data',
    icon: 'Globe',
    route: '/admin/network',
    parent_code: '5',
    module: 'admin',
    level: 1,
  },
  {
    code: '5.1.1',
    name: 'Countries',
    description: 'Country reference data',
    icon: 'Globe',
    route: '/admin/countries',
    parent_code: '5.1',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.1.2',
    name: 'Airports',
    description: 'Airport database management',
    icon: 'PlaneLanding',
    route: '/admin/airports',
    parent_code: '5.1',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.1.3',
    name: 'Citypairs',
    description: 'Routes, distances, block times',
    icon: 'ArrowLeftRight',
    route: '/admin/city-pairs',
    parent_code: '5.1',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.1.4',
    name: 'LOPA',
    description: 'Cabin classes and seat configurations',
    icon: 'Armchair',
    route: '/admin/lopa',
    parent_code: '5.1',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.1.5',
    name: 'Flight Service Types',
    description: 'Flight service type codes',
    icon: 'Tag',
    route: '/admin/service-types',
    parent_code: '5.1',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.1.6',
    name: 'Carrier Codes',
    description: 'Codeshare & wetlease carrier definitions',
    icon: 'Building2',
    route: '/admin/carrier-codes',
    parent_code: '5.1',
    module: 'admin',
    level: 2,
  },

  // 5.2 Flight Ops (Master Database)
  {
    code: '5.2',
    name: 'Flight Ops',
    description: 'Flight operations reference data',
    icon: 'Plane',
    route: '/admin/flight-ops',
    parent_code: '5',
    module: 'admin',
    level: 1,
  },
  {
    code: '5.2.1',
    name: 'Aircraft Types',
    description: 'Aircraft type catalogue',
    icon: 'Plane',
    route: '/admin/aircraft-types',
    parent_code: '5.2',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.2.2',
    name: 'Aircraft Registrations',
    description: 'Tail numbers, MSN, status, home base',
    icon: 'PlaneTakeoff',
    route: '/admin/aircraft-registrations',
    parent_code: '5.2',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.2.3',
    name: 'Delay Codes',
    description: 'IATA delay code definitions',
    icon: 'AlertTriangle',
    route: '/admin/delay-codes',
    parent_code: '5.2',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.2.4',
    name: 'Maintenance Checks Setup',
    description: 'Configure maintenance check types, frequency thresholds, and maintenance windows',
    icon: 'ClipboardCheck',
    route: '/admin/maintenance-checks',
    parent_code: '5.2',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.2.5',
    name: 'Non-Crew Directory',
    description: 'Non-crew personnel for jumpseat assignment & APIS',
    icon: 'Contact',
    route: '/admin/non-crew-people',
    parent_code: '5.2',
    module: 'admin',
    level: 2,
  },

  // 5.3 Ground Ops (Master Database)
  {
    code: '5.3',
    name: 'Ground Ops',
    description: 'Ground operations reference data',
    icon: 'Truck',
    route: '/admin/ground-ops',
    parent_code: '5',
    module: 'admin',
    level: 1,
  },

  // 5.4 Crew Ops (Master Database)
  {
    code: '5.4',
    name: 'Crew Ops',
    description: 'Crew operations configuration',
    icon: 'Users',
    route: '/admin/crew-ops',
    parent_code: '5',
    module: 'admin',
    level: 1,
  },
  {
    code: '5.4.1',
    name: 'Crew Bases',
    description: 'Airport crew home bases & reporting times',
    icon: 'MapPin',
    route: '/admin/crew-bases',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.2',
    name: 'Crew Positions',
    description: 'Cockpit & cabin roles, rank order',
    icon: 'Award',
    route: '/admin/crew-positions',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.3',
    name: 'Expiry Codes',
    description: 'Qualification validity & formulas',
    icon: 'BadgeCheck',
    route: '/admin/expiry-codes',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.4',
    name: 'Activity Codes',
    description: 'Duty, standby, training & leave classification',
    icon: 'Tag',
    route: '/admin/activity-codes',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.5',
    name: 'Crew Complements',
    description: 'Min crew per aircraft type & augmentation',
    icon: 'Layers',
    route: '/admin/crew-complements',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.6',
    name: 'Crew Groups',
    description: 'Scheduling groups & crew classification',
    icon: 'UsersRound',
    route: '/admin/crew-groups',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.7',
    name: 'FDT Rules',
    description: 'Flight duty time limitations & regulatory framework',
    icon: 'Timer',
    route: '/admin/fdt-rules',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.8',
    name: 'Off/Duty Patterns',
    description: 'ON/OFF rotation patterns for crew rostering',
    icon: 'CalendarDays',
    route: '/admin/duty-patterns',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },
  {
    code: '5.4.9',
    name: 'MPP Lead Times',
    description: 'Training & recruitment lead times for manpower planning',
    icon: 'Clock',
    route: '/admin/mpp-lead-times',
    parent_code: '5.4',
    module: 'admin',
    level: 2,
  },

  // ──────────────────────────────────────────────
  // 6. INTEGRATION
  // ──────────────────────────────────────────────
  {
    code: '6',
    name: 'Integration',
    description: 'External system integrations and data exchange',
    icon: 'ArrowLeftRight',
    route: '/integration',
    parent_code: null,
    module: 'integration',
    level: 0,
  },

  // ──────────────────────────────────────────────
  // 7. SYSTEM ADMINISTRATION
  // ──────────────────────────────────────────────
  {
    code: '7',
    name: 'System Administration',
    description: 'User accounts, access rights, operator profile and the company document library',
    icon: 'ShieldCheck',
    route: '/sysadmin',
    parent_code: null,
    module: 'sysadmin',
    level: 0,
  },
  {
    code: '7.1',
    name: 'Administration',
    description: 'Operator profile, user management and document library',
    icon: 'ShieldCheck',
    route: '/sysadmin',
    parent_code: '7',
    module: 'sysadmin',
    level: 1,
  },
  {
    code: '7.1.1',
    name: 'Operator Profile',
    description: 'Operator-wide settings — branding, accent colour, time zone and defaults',
    icon: 'Building2',
    route: '/settings/admin/operator-config',
    parent_code: '7.1',
    module: 'sysadmin',
    level: 2,
  },
  {
    code: '7.1.2',
    name: 'User List Maintenance',
    description: 'Manage user accounts and their profile details',
    icon: 'Users',
    route: '/sysadmin/users',
    parent_code: '7.1',
    module: 'sysadmin',
    level: 2,
  },
  {
    code: '7.1.3',
    name: 'User Access Rights',
    description: 'Define roles, permissions and module-level access control',
    icon: 'KeyRound',
    route: '/sysadmin/access-rights',
    parent_code: '7.1',
    module: 'sysadmin',
    level: 2,
  },
  {
    code: '7.1.4',
    name: 'Document Management',
    description: 'Central library for operational manuals, SOPs and procedures shared across every module',
    icon: 'FolderOpen',
    route: '/sysadmin/company-documents',
    parent_code: '7.1',
    module: 'sysadmin',
    level: 2,
  },
  {
    code: '7.1.5',
    name: 'Integration',
    description: 'Outbound message transmission, ACARS ingestion and external system interfaces',
    icon: 'Plug',
    route: '/settings/admin/integration',
    parent_code: '7.1',
    module: 'sysadmin',
    level: 2,
  },
  {
    code: '7.1.5.1',
    name: 'ASM/SSM Transmission',
    description: 'Schedule change message delivery — ASM Ad-hoc and SSM seasonal — to IATA SSIM recipients',
    icon: 'MessageSquare',
    route: '/settings/admin/integration/asm-ssm-transmission',
    parent_code: '7.1.5',
    module: 'sysadmin',
    level: 3,
  },
  {
    code: '7.1.5.2',
    name: 'ACARS/MVT/LDM Transmission',
    description:
      'Movement, load and ACARS message automation — validation rules, auto-transmit scheduler and audit trail',
    icon: 'Radio',
    route: '/settings/admin/integration/acars-mvt-ldm-transmission',
    parent_code: '7.1.5',
    module: 'sysadmin',
    level: 3,
  },
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
  return MODULE_REGISTRY.filter((m) => m.parent_code === parentCode)
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
  return MODULE_REGISTRY.filter((m) => m.level === 0)
}

/** Module theme colors for dynamic theming */
export const MODULE_THEMES: Record<string, { accent: string; bg: string; bgSubtle: string }> = {
  home: { accent: '#1e40af', bg: '#dbeafe', bgSubtle: '#eff6ff' },
  network: { accent: '#2563eb', bg: '#dbeafe', bgSubtle: '#eff6ff' },
  operations: { accent: '#F59E0B', bg: '#fde68a', bgSubtle: '#fef3c7' },
  ground: { accent: '#059669', bg: '#d1fae5', bgSubtle: '#ecfdf5' },
  workforce: { accent: '#7c3aed', bg: '#ede9fe', bgSubtle: '#f5f3ff' },
  integration: { accent: '#0891b2', bg: '#cffafe', bgSubtle: '#ecfeff' },
  admin: { accent: '#64748b', bg: '#e2e8f0', bgSubtle: '#f8fafc' },
  sysadmin: { accent: '#B45309', bg: '#fed7aa', bgSubtle: '#ffedd5' },
  settings: { accent: '#64748b', bg: '#e2e8f0', bgSubtle: '#f8fafc' },
}
