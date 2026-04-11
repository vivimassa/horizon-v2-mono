import { memo } from 'react'
import { Text, View, Pressable } from 'react-native'
import { Plus, Save, Filter, Trash2 } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'

export const ScheduleToolbar = memo(function ScheduleToolbar({
  onAdd,
  onSave,
  onFilter,
  onDeleteSelected,
  hasDirty,
  hasSelected,
  saving,
  isTablet,
  accent,
  palette,
  isDark,
}: {
  onAdd: () => void
  onSave: () => void
  onFilter: () => void
  onDeleteSelected: () => void
  hasDirty: boolean
  hasSelected: boolean
  saving: boolean
  isTablet: boolean
  accent: string
  palette: any
  isDark: boolean
}) {
  return (
    <View
      className="flex-row items-center px-4 py-2"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        gap: 8,
      }}
    >
      <ToolBtn
        icon={Plus}
        label={isTablet ? 'Add Flight' : undefined}
        onPress={onAdd}
        accent={accent}
        palette={palette}
        isDark={isDark}
        primary
      />
      <ToolBtn
        icon={Save}
        label={isTablet ? 'Save' : undefined}
        onPress={onSave}
        accent={accent}
        palette={palette}
        isDark={isDark}
        disabled={!hasDirty || saving}
      />
      {hasSelected && (
        <ToolBtn
          icon={Trash2}
          label={isTablet ? 'Delete' : undefined}
          onPress={onDeleteSelected}
          accent="#dc2626"
          palette={palette}
          isDark={isDark}
        />
      )}
      <View className="flex-1" />
      <ToolBtn
        icon={Filter}
        label={isTablet ? 'Filter' : undefined}
        onPress={onFilter}
        accent={accent}
        palette={palette}
        isDark={isDark}
      />
    </View>
  )
})

function ToolBtn({
  icon: Icon,
  label,
  onPress,
  accent,
  palette,
  isDark,
  disabled,
  primary,
}: {
  icon: any
  label?: string
  onPress: () => void
  accent: string
  palette: any
  isDark: boolean
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
      style={{
        backgroundColor: primary ? accent : accentTint(accent, isDark ? 0.1 : 0.05),
        opacity: disabled ? 0.35 : 1,
        gap: 5,
      }}
    >
      <Icon size={15} color={primary ? '#fff' : accent} strokeWidth={2} />
      {label && <Text style={{ fontSize: 13, fontWeight: '600', color: primary ? '#fff' : accent }}>{label}</Text>}
    </Pressable>
  )
}
