// Shared shell for Gantt mutation dialogs. Handles BottomSheet ref +
// open-on-target + dismiss → closeMutationSheet pattern. Children render the
// form body inside <BottomSheetView>.

import { useEffect, useMemo, useRef } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { LinearGradient } from 'expo-linear-gradient'
import { X } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'

interface Props {
  open: boolean
  title: string
  snapPercent?: number
  onClose?: () => void
  children?: React.ReactNode
  primaryLabel?: string
  primaryDestructive?: boolean
  primaryDisabled?: boolean
  primaryLoading?: boolean
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export function DialogShell({
  open,
  title,
  snapPercent = 70,
  onClose,
  children,
  primaryLabel,
  primaryDestructive,
  primaryDisabled,
  primaryLoading,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  const { palette, accent } = useAppTheme()
  const ref = useRef<BottomSheet>(null)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const close = onClose ?? closeMutationSheet

  useEffect(() => {
    if (open) ref.current?.snapToIndex(0)
    else ref.current?.close()
  }, [open])

  const snapPoints = useMemo(() => [`${snapPercent}%`], [snapPercent])

  return (
    <BottomSheet
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={-1}
      onClose={() => close()}
      backgroundStyle={{ backgroundColor: palette.card }}
      handleIndicatorStyle={{ backgroundColor: palette.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{title}</Text>
          <Pressable onPress={() => close()} style={{ padding: 4 }} hitSlop={8}>
            <Icon icon={X} size="md" color={palette.textSecondary} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>{children}</View>

        {(primaryLabel || secondaryLabel) && (
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 12 }}>
            {secondaryLabel && (
              <Pressable
                onPress={onSecondary ?? (() => close())}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: palette.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <Text style={{ color: palette.text, fontWeight: '600', fontSize: 14 }}>{secondaryLabel}</Text>
              </Pressable>
            )}
            {primaryLabel && (
              <Pressable
                onPress={onPrimary}
                disabled={primaryDisabled || primaryLoading}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  overflow: 'hidden',
                  opacity: primaryDisabled || primaryLoading ? 0.5 : 1,
                }}
              >
                <LinearGradient
                  colors={primaryDestructive ? ['#E63535', '#FF3B3B'] : [accent, accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    {primaryLoading ? 'Working...' : primaryLabel}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  )
}

export function FieldLabel({ label, palette }: { label: string; palette: { textSecondary: string } }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '700',
        color: palette.textSecondary,
        letterSpacing: 0.6,
        marginBottom: 6,
      }}
    >
      {label}
    </Text>
  )
}
