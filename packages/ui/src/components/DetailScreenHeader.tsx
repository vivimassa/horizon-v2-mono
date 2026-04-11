// SkyHub — DetailScreenHeader
// Back + icon badge + title/subtitle + edit/save/cancel/delete toolbar + status pill.
// Status pill: 13px SemiBold (memory: feedback_badge_size_header.md).
import React from 'react'
import { View, Pressable, ActivityIndicator } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import { domainIcons, type LucideIcon } from '../theme/icons'
import { Text } from './Text'

const ChevronLeft = domainIcons.chevronLeft
const Pencil = domainIcons.edit
const Save = domainIcons.save
const X = domainIcons.close
const Trash2 = domainIcons.delete

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

interface StatusDescriptor {
  label: string
  tone: StatusTone
}

interface DetailScreenHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  /** Right-of-title slot for extra chips (ICAO, category, etc.) */
  subtitleSlot?: React.ReactNode
  onBack: () => void
  editing?: boolean
  onEdit?: () => void
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  saving?: boolean
  status?: StatusDescriptor
}

const STATUS_COLORS: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: 'rgba(6,194,112,0.12)', fg: '#06C270' },
  danger: { bg: 'rgba(255,59,59,0.12)', fg: '#E63535' },
  warning: { bg: 'rgba(255,136,0,0.12)', fg: '#FF8800' },
  info: { bg: 'rgba(0,99,247,0.12)', fg: '#0063F7' },
  neutral: { bg: 'rgba(128,128,140,0.12)', fg: '#80808C' },
}

export function DetailScreenHeader({
  icon: Icon,
  title,
  subtitle,
  subtitleSlot,
  onBack,
  editing = false,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  saving = false,
  status,
}: DetailScreenHeaderProps) {
  const { palette, accentColor, isDark } = useTheme()
  const badgeBg = accentTint(accentColor, isDark ? 0.15 : 0.08)

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

      {Icon ? (
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
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="pageTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {status ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: STATUS_COLORS[status.tone].bg,
              }}
            >
              <Text variant="cardTitle" color={STATUS_COLORS[status.tone].fg} style={{ fontWeight: '600' }}>
                {status.label}
              </Text>
            </View>
          ) : null}
        </View>
        {subtitle || subtitleSlot ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {subtitle ? (
              <Text variant="secondary" muted numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {subtitleSlot}
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {editing ? (
          <>
            {onCancel ? <IconButton onPress={onCancel} icon={X} tint={palette.textSecondary} label="Cancel" /> : null}
            {onSave ? (
              <Pressable
                onPress={onSave}
                disabled={saving}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: pressed ? accentTint(accentColor, 0.85) : accentColor,
                  opacity: saving ? 0.6 : 1,
                })}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Save size={16} color="#fff" strokeWidth={2.25} />
                )}
                <Text variant="cardTitle" color="#fff" style={{ fontWeight: '600' }}>
                  Save
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {onDelete ? <IconButton onPress={onDelete} icon={Trash2} tint="#E63535" label="Delete" /> : null}
            {onEdit ? <IconButton onPress={onEdit} icon={Pencil} tint={accentColor} label="Edit" /> : null}
          </>
        )}
      </View>
    </View>
  )
}

function IconButton({
  onPress,
  icon: Icon,
  tint,
  label,
}: {
  onPress: () => void
  icon: LucideIcon
  tint: string
  label: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? accentTint(tint, 0.18) : accentTint(tint, 0.1),
      })}
    >
      <Icon size={18} color={tint} strokeWidth={2} />
    </Pressable>
  )
}
