import { useState, useCallback, memo } from 'react'
import { Text, View, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { Filter, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react-native'
import { accentTint, type Palette } from '../theme/colors'

interface FilterPanelProps {
  children: React.ReactNode
  onApply: () => void
  applyDisabled?: boolean
  applyLabel?: string
  loading?: boolean
  activeCount?: number
  collapsible?: boolean
  initialCollapsed?: boolean
  width?: number
  /** Extra bottom padding to clear tab bar — pass useSafeAreaInsets().bottom or a fixed value */
  bottomInset?: number
  accent: string
  palette: Palette
  isDark: boolean
}

const EXPANDED_WIDTH = 280
const COLLAPSED_WIDTH = 44

export const FilterPanel = memo(function FilterPanel({
  children,
  onApply,
  applyDisabled,
  applyLabel = 'Go',
  loading,
  activeCount = 0,
  collapsible = true,
  initialCollapsed = false,
  width = EXPANDED_WIDTH,
  bottomInset = 0,
  accent,
  palette,
  isDark,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const handleApply = useCallback(() => {
    onApply()
    if (collapsible) setCollapsed(true)
  }, [onApply, collapsible])

  const panelWidth = collapsible && collapsed ? COLLAPSED_WIDTH : width

  // ── Collapsed state ──
  if (collapsible && collapsed) {
    return (
      <Pressable
        onPress={() => setCollapsed(false)}
        style={{
          width: COLLAPSED_WIDTH,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderRadius: 16,
          alignItems: 'center',
          backgroundColor: palette.card,
          margin: 8,
          marginRight: 0,
          marginBottom: 8,
          overflow: 'hidden',
          paddingTop: 14,
        }}
      >
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={2} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 80, alignItems: 'center', transform: [{ rotate: '-90deg' }] }}>
            <Text
              style={{ fontSize: 13, fontWeight: '700', letterSpacing: 2, color: palette.textTertiary }}
              numberOfLines={1}
            >
              FILTERS
            </Text>
          </View>
        </View>
      </Pressable>
    )
  }

  // ── Expanded state ──
  return (
    <View
      style={{
        width: panelWidth,
        maxWidth: panelWidth,
        flexShrink: 0,
        alignSelf: 'stretch',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderRadius: 16,
        backgroundColor: palette.card,
        marginTop: 8,
        marginLeft: 8,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View
        className="flex-row items-center px-4"
        style={{
          minHeight: 48,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        }}
      >
        <Filter size={15} color={palette.textSecondary} strokeWidth={1.8} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, marginLeft: 8, flex: 1 }}>Filters</Text>
        {activeCount > 0 && (
          <View
            className="items-center justify-center rounded-full mr-2"
            style={{ width: 20, height: 20, backgroundColor: accent }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{activeCount}</Text>
          </View>
        )}
        {collapsible && (
          <Pressable
            onPress={() => setCollapsed(true)}
            className="items-center justify-center active:opacity-60"
            style={{ width: 28, height: 28 }}
          >
            <ChevronLeft size={14} color={palette.textTertiary} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Body */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* Footer: Apply button */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(16, bottomInset),
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        }}
      >
        {applyDisabled && (
          <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626', marginBottom: 8, textAlign: 'center' }}>
            Select the period to continue
          </Text>
        )}
        <Pressable
          onPress={handleApply}
          disabled={applyDisabled || loading}
          className="flex-row items-center justify-center rounded-xl active:opacity-70"
          style={{
            height: 40,
            backgroundColor: accent,
            opacity: applyDisabled || loading ? 0.5 : 1,
            gap: 6,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Search size={14} color="#fff" strokeWidth={2} />
          )}
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{loading ? 'Loading...' : applyLabel}</Text>
        </Pressable>
      </View>
    </View>
  )
})
