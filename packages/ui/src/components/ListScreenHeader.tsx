// SkyHub — ListScreenHeader
// Back button + icon badge + title + count + add button.
// Extracted from settings list screens (airports, carrier-codes, activity-codes).
import React from 'react'
import { View, Pressable } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import { domainIcons, type LucideIcon } from '../theme/icons'
import { Text } from './Text'

const ChevronLeft = domainIcons.chevronLeft
const Plus = domainIcons.add

interface ListScreenHeaderProps {
  icon: LucideIcon
  title: string
  /** Total count of items */
  count: number
  /** When filtering is active, shows "X of Y" */
  filteredCount?: number
  /** Singular/plural label (default: "item") */
  countLabel?: string
  /** Optional back handler. When omitted the chevron is hidden — users
     navigate via the bottom dock + native edge-swipe gesture instead. */
  onBack?: () => void
  onAdd?: () => void
  addLabel?: string
  /** Extra trailing slot (e.g. import, refresh) */
  rightAction?: React.ReactNode
}

export function ListScreenHeader({
  icon: Icon,
  title,
  count,
  filteredCount,
  countLabel = 'item',
  onBack,
  onAdd,
  addLabel = 'New',
  rightAction,
}: ListScreenHeaderProps) {
  const { palette, accentColor, isDark } = useTheme()
  const badgeBg = accentTint(accentColor, isDark ? 0.15 : 0.08)

  const subtitle =
    filteredCount !== undefined && filteredCount !== count
      ? `${filteredCount} of ${count} ${count === 1 ? countLabel : countLabel + 's'}`
      : `${count} ${count === 1 ? countLabel : countLabel + 's'}`

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        gap: 14,
      }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={22} color={palette.textSecondary} strokeWidth={2} />
        </Pressable>
      ) : null}

      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: badgeBg,
          borderWidth: 1,
          borderColor: accentTint(accentColor, 0.25),
        }}
      >
        <Icon size={20} color={accentColor} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Use raw palette colours so the header reads strongly in dark mode —
           `Text variant="pageTitle"` + `secondary muted` were rendering dim. */}
        <ReadableTitle title={title} color={palette.text} />
        <ReadableSubtitle subtitle={subtitle} color={palette.textSecondary} />
      </View>

      {rightAction}

      {onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => ({
            height: 44,
            borderRadius: 999,
            backgroundColor: pressed ? accentTint(accentColor, 0.75) : accentColor,
            shadowColor: accentColor,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
          })}
        >
          {/* Inner static View forces icon + label onto a single row — the
             Pressable style-as-function has been dropping flexDirection on
             several RN versions, stacking them vertically. */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingHorizontal: 16,
            }}
          >
            <Plus size={17} color="#fff" strokeWidth={2.5} />
            <Text variant="cardTitle" color="#fff" style={{ fontWeight: '700', letterSpacing: 0.2 }}>
              {addLabel}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  )
}

/* Kept as small helpers so Text variants can't muddy the look in dark mode. */
function ReadableTitle({ title, color }: { title: string; color: string }) {
  return (
    <Text variant="pageTitle" style={{ color, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
      {title}
    </Text>
  )
}
function ReadableSubtitle({ subtitle, color }: { subtitle: string; color: string }) {
  return (
    <Text variant="secondary" style={{ color, marginTop: 1 }} numberOfLines={1}>
      {subtitle}
    </Text>
  )
}
