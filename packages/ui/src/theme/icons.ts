// SkyHub — Domain Icon Map
// Single source of truth: every airline concept has one assigned Lucide icon.
// Screens reference domainIcons.xxx — never choose icons ad-hoc.

import {
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  Building2,
  MapPin,
  Users,
  UserCircle,
  UserCheck,
  Clock,
  Calendar,
  CalendarDays,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Settings,
  Bell,
  FileText,
  BarChart3,
  TrendingUp,
  Wrench,
  Shield,
  Globe,
  Navigation,
  Route,
  Timer,
  Fuel,
  Weight,
  ArrowRightLeft,
  RefreshCw,
  Download,
  Upload,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  X,
  MoreHorizontal,
  MoreVertical,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sun,
  Moon,
  Palette,
  type LucideIcon,
} from 'lucide-react-native'

export const domainIcons = {
  // Aircraft
  aircraft: Plane,
  takeoff: PlaneTakeoff,
  landing: PlaneLanding,
  // Locations
  airport: Building2,
  location: MapPin,
  globe: Globe,
  route: Route,
  navigation: Navigation,
  // Crew
  crew: Users,
  crewMember: UserCircle,
  crewAssigned: UserCheck,
  // Time
  clock: Clock,
  calendar: Calendar,
  calendarDays: CalendarDays,
  timer: Timer,
  // Status
  info: AlertCircle,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
  cancelled: XCircle,
  // Operations
  fuel: Fuel,
  weight: Weight,
  maintenance: Wrench,
  swap: ArrowRightLeft,
  refresh: RefreshCw,
  // UI
  search: Search,
  filter: Filter,
  settings: Settings,
  notifications: Bell,
  document: FileText,
  chart: BarChart3,
  trending: TrendingUp,
  shield: Shield,
  // Data
  download: Download,
  upload: Upload,
  // Navigation
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  // Actions
  add: Plus,
  remove: Minus,
  close: X,
  moreH: MoreHorizontal,
  moreV: MoreVertical,
  // Visibility
  visible: Eye,
  hidden: EyeOff,
  lock: Lock,
  unlock: Unlock,
  // Theme
  sun: Sun,
  moon: Moon,
  palette: Palette,
} as const

export type DomainIconName = keyof typeof domainIcons

export { type LucideIcon }
