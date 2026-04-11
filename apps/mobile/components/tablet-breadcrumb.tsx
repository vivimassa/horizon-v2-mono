import { useState, useCallback, useRef, memo } from 'react'
import { View, Text, Pressable, Modal, FlatList } from 'react-native'
import { resolveNavPath, buildBreadcrumbs, type BreadcrumbSegment } from '@skyhub/ui/navigation'
import {
  Home,
  Globe,
  Plane,
  Truck,
  Users,
  Settings,
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
  FileText,
  GanttChart,
  Repeat,
  CalendarRange,
  Info,
  MessageSquare,
  Map,
  AlertTriangle,
  DoorOpen,
  LayoutGrid,
  PlaneTakeoff,
  Lock,
  Bell,
  Palette as PaletteIcon,
  ArrowLeftRight,
  Building2,
  ChevronDown,
  Armchair,
  Tag,
  Timer,
  UserRound,
  FileCheck,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'

// ── Icon map (string name → component) ──
const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Globe,
  Plane,
  Truck,
  Users,
  Settings,
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
  FileText,
  GanttChart,
  Repeat,
  CalendarRange,
  Info,
  MessageSquare,
  Map,
  AlertTriangle,
  DoorOpen,
  LayoutGrid,
  PlaneTakeoff,
  Lock,
  Bell,
  Palette: PaletteIcon,
  ArrowLeftRight,
  Building2,
  Armchair,
  Tag,
  Timer,
  UserRound,
  FileCheck,
}

interface TabletBreadcrumbProps {
  /** Current route pathname, e.g. "/network/schedule/gantt" */
  pathname: string
  palette: Palette
  isDark: boolean
  accent: string
  onNavigate?: (route: string) => void
}

export const TabletBreadcrumb = memo(function TabletBreadcrumb({
  pathname,
  palette,
  isDark,
  accent,
  onNavigate,
}: TabletBreadcrumbProps) {
  const navPath = resolveNavPath(pathname)
  const segments = navPath ? buildBreadcrumbs(navPath) : []
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleSegmentPress = useCallback(
    (idx: number, seg: BreadcrumbSegment) => {
      if (seg.siblings.length <= 1) {
        onNavigate?.(seg.route)
        return
      }
      setOpenIndex((prev) => (prev === idx ? null : idx))
    },
    [onNavigate],
  )

  const handleItemPress = useCallback(
    (route: string) => {
      setOpenIndex(null)
      onNavigate?.(route)
    },
    [onNavigate],
  )

  if (segments.length === 0) return null

  const accentColor = isDark ? '#60a5fa' : accent

  return (
    <View className="flex-row items-center" style={{ gap: 2 }}>
      {/* Glass pill container */}
      <View
        className="flex-row items-center rounded-2xl"
        style={{
          paddingHorizontal: 6,
          paddingVertical: 5,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
        }}
      >
        {segments.map((seg, i) => {
          const isPage = seg.level === 'page'
          const isModule = seg.level === 'module'
          const hasSiblings = seg.siblings.length > 1
          const Icon = ICON_MAP[seg.iconName]

          return (
            <View key={seg.num} className="flex-row items-center">
              {/* Separator */}
              {i > 0 && (
                <Text style={{ fontSize: 13, color: isDark ? '#888' : palette.textTertiary, marginHorizontal: 3 }}>
                  ›
                </Text>
              )}

              {/* Segment pill */}
              <Pressable
                onPress={() => handleSegmentPress(i, seg)}
                className="flex-row items-center rounded-lg active:opacity-70"
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  backgroundColor: isPage ? accentTint(accentColor, isDark ? 0.12 : 0.08) : 'transparent',
                  gap: 4,
                }}
              >
                {/* Module icon pill */}
                {isModule && Icon && (
                  <View
                    className="items-center justify-center rounded-md"
                    style={{ width: 20, height: 20, backgroundColor: accentTint(accentColor, isDark ? 0.15 : 0.1) }}
                  >
                    <Icon size={12} color={accentColor} strokeWidth={1.8} />
                  </View>
                )}

                {/* Section number */}
                {!isPage && !seg.hideNum && (
                  <Text style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.45, color: palette.text }}>
                    {seg.num}
                  </Text>
                )}

                {/* Label */}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isPage ? '600' : '500',
                    color: isPage ? accentColor : isDark ? '#c4c4cc' : palette.textSecondary,
                  }}
                >
                  {seg.label}
                </Text>

                {/* Chevron */}
                {hasSiblings && !(isPage && !hasSiblings) && (
                  <ChevronDown
                    size={10}
                    color={isPage ? accentColor : palette.textTertiary}
                    strokeWidth={2}
                    style={{ opacity: 0.5 }}
                  />
                )}
              </Pressable>

              {/* Dropdown */}
              {openIndex === i && (
                <DropdownModal
                  segment={seg}
                  palette={palette}
                  isDark={isDark}
                  accent={accentColor}
                  onItemPress={handleItemPress}
                  onClose={() => setOpenIndex(null)}
                />
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
})

// ── Dropdown as a Modal overlay ──
function DropdownModal({
  segment,
  palette,
  isDark,
  accent,
  onItemPress,
  onClose,
}: {
  segment: BreadcrumbSegment
  palette: Palette
  isDark: boolean
  accent: string
  onItemPress: (route: string) => void
  onClose: () => void
}) {
  const isPageLevel = segment.level === 'page'
  const hasGroups = segment.siblings.some((s) => s.group)

  // Build grouped structure for horizontal column layout
  const groups: { name: string; iconName?: string; items: typeof segment.siblings }[] = []
  if (hasGroups) {
    for (const item of segment.siblings) {
      const gName = item.group || 'Other'
      const existing = groups.find((g) => g.name === gName)
      if (existing) existing.items.push(item)
      else groups.push({ name: gName, iconName: item.groupIconName, items: [item] })
    }
  }

  const renderItem = (item: (typeof segment.siblings)[0]) => {
    const isCurrent = item.num === segment.num
    const Icon = ICON_MAP[item.iconName]
    return (
      <Pressable
        key={item.key}
        onPress={() => {
          onItemPress(item.route)
          onClose()
        }}
        className="flex-row items-center rounded-xl active:opacity-70"
        style={{
          paddingHorizontal: 10,
          paddingVertical: 9,
          backgroundColor: isCurrent ? accentTint(accent, isDark ? 0.1 : 0.06) : 'transparent',
          gap: 10,
        }}
      >
        <View
          className="items-center justify-center rounded-lg"
          style={{
            width: 28,
            height: 28,
            backgroundColor: isCurrent
              ? accentTint(accent, isDark ? 0.18 : 0.1)
              : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)',
          }}
        >
          {Icon && <Icon size={14} color={isCurrent ? accent : palette.textSecondary} strokeWidth={1.8} />}
        </View>
        <View className="flex-1">
          <Text
            style={{
              fontSize: 13,
              fontWeight: isCurrent ? '600' : '400',
              color: isCurrent ? accent : palette.text,
            }}
          >
            {item.label}
          </Text>
          {isPageLevel && item.desc && (
            <Text style={{ fontSize: 11, color: palette.textTertiary, marginTop: 1 }} numberOfLines={1}>
              {item.desc}
            </Text>
          )}
        </View>
        {isCurrent && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />}
      </Pressable>
    )
  }

  // For grouped layouts, compute width based on number of columns
  const groupedWidth = hasGroups ? Math.max(groups.length * 220, 500) : undefined

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1" onPress={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <View
          className="absolute rounded-2xl"
          style={{
            top: 90,
            left: 16,
            width: groupedWidth,
            minWidth: hasGroups ? undefined : 260,
            maxWidth: hasGroups ? undefined : 340,
            backgroundColor: isDark ? '#1e1e22' : '#ffffff',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.4 : 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
            padding: 6,
          }}
        >
          {hasGroups ? (
            /* Grouped: horizontal columns like web */
            <View className="flex-row" style={{ gap: 4 }}>
              {groups.map((g) => {
                const GIcon = g.iconName ? ICON_MAP[g.iconName] : null
                return (
                  <View key={g.name} style={{ flex: 1 }}>
                    {/* Group header */}
                    <View className="flex-row items-center px-3 pt-2 pb-2 mb-1" style={{ gap: 6 }}>
                      {GIcon && <GIcon size={15} color={palette.textSecondary} strokeWidth={1.8} />}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: palette.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {g.name}
                      </Text>
                    </View>
                    {g.items.map(renderItem)}
                  </View>
                )
              })}
            </View>
          ) : (
            /* Non-grouped: flat list */
            <>
              {segment.parentLabel && (
                <View className="flex-row items-center px-3 pt-1 pb-2" style={{ gap: 6 }}>
                  <View style={{ width: 2, height: 14, borderRadius: 1, backgroundColor: accent }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: palette.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    {segment.parentLabel}
                  </Text>
                </View>
              )}
              {segment.siblings.map(renderItem)}
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  )
}
