import { memo } from 'react'
import { Text, View, Pressable } from 'react-native'
import { type Palette } from '@skyhub/ui/theme'

interface FloatingSaveBarProps {
  dirtyCount: number
  newCount: number
  deleteCount: number
  saving: boolean
  onSave: () => void
  onDiscard: () => void
  palette: Palette
  accent: string
  isDark: boolean
}

export const FloatingSaveBar = memo(function FloatingSaveBar({
  dirtyCount, newCount, deleteCount, saving, onSave, onDiscard,
  palette, accent, isDark,
}: FloatingSaveBarProps) {
  const parts: string[] = []
  if (dirtyCount > 0) parts.push(`${dirtyCount} modified`)
  if (newCount > 0) parts.push(`${newCount} new`)
  if (deleteCount > 0) parts.push(`${deleteCount} deleted`)

  return (
    <View className="absolute bottom-6 left-4 right-4 flex-row items-center rounded-xl px-4 py-3"
      style={{
        backgroundColor: isDark ? 'rgba(25,25,33,0.92)' : 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        shadowColor: '#000', shadowOpacity: isDark ? 0.4 : 0.15,
        shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
      }}>
      <View className="flex-1">
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
          {parts.join(' \u00B7 ')}
        </Text>
      </View>
      <Pressable onPress={onDiscard} className="px-3 py-2 rounded-lg mr-2 active:opacity-70"
        style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>Discard</Text>
      </Pressable>
      <Pressable onPress={onSave} disabled={saving}
        className="px-4 py-2 rounded-lg active:opacity-70"
        style={{ backgroundColor: '#16a34a', opacity: saving ? 0.5 : 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </View>
  )
})
