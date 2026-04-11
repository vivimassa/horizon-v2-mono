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
  onBack: () => void
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
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 12,
        gap: 10,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={22} color={palette.textSecondary} strokeWidth={2} />
      </Pressable>

      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: badgeBg,
        }}
      >
        <Icon size={18} color={accentColor} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="pageTitle" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="secondary" muted numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {rightAction}

      {onAdd ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            height: 36,
            borderRadius: 10,
            backgroundColor: pressed ? accentTint(accentColor, 0.85) : accentColor,
          })}
        >
          <Plus size={16} color="#fff" strokeWidth={2.25} />
          <Text variant="cardTitle" color="#fff" style={{ fontWeight: '600' }}>
            {addLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
