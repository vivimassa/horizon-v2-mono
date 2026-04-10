import { memo } from 'react'
import { Text, View, Pressable, Modal } from 'react-native'
import {
  Copy, Scissors, ClipboardPaste, Plus, SeparatorHorizontal, Trash2,
} from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#6b7280' },
  { key: 'active', label: 'Active', color: '#16a34a' },
  { key: 'suspended', label: 'Suspended', color: '#f59e0b' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
]

interface ContextMenuProps {
  visible: boolean
  onClose: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onInsertRow: () => void
  onSeparateCycle: () => void
  onChangeStatus: (status: string) => void
  onDeleteRow: () => void
  palette: Palette
  isDark: boolean
}

export const ContextMenu = memo(function ContextMenu({
  visible, onClose, onCopy, onCut, onPaste,
  onInsertRow, onSeparateCycle, onChangeStatus, onDeleteRow,
  palette, isDark,
}: ContextMenuProps) {
  const itemStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={onClose}>
        <View className="flex-1 justify-center items-center">
          <Pressable onPress={() => {}} className="rounded-2xl overflow-hidden"
            style={{
              width: 260,
              backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
            }}>
            <MenuItem icon={Copy} label="Copy" shortcut="Ctrl+C" onPress={() => { onCopy(); onClose() }} palette={palette} isDark={isDark} />
            <MenuItem icon={Scissors} label="Cut" shortcut="Ctrl+X" onPress={() => { onCut(); onClose() }} palette={palette} isDark={isDark} />
            <MenuItem icon={ClipboardPaste} label="Paste" shortcut="Ctrl+V" onPress={() => { onPaste(); onClose() }} palette={palette} isDark={isDark} />

            <Separator isDark={isDark} />

            <MenuItem icon={Plus} label="Insert Row" shortcut="Insert" onPress={() => { onInsertRow(); onClose() }} palette={palette} isDark={isDark} />
            <MenuItem icon={SeparatorHorizontal} label="Separate Cycle" onPress={() => { onSeparateCycle(); onClose() }} palette={palette} isDark={isDark} />

            <Separator isDark={isDark} />

            {/* Change Status sub-items */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Change Status
              </Text>
            </View>
            {STATUS_OPTIONS.map(s => (
              <Pressable key={s.key} onPress={() => { onChangeStatus(s.key); onClose() }}
                className="flex-row items-center active:opacity-70"
                style={{ paddingHorizontal: 24, paddingVertical: 10, gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{s.label}</Text>
              </Pressable>
            ))}

            <Separator isDark={isDark} />

            <MenuItem icon={Trash2} label="Delete Row" shortcut="Ctrl+Del" onPress={() => { onDeleteRow(); onClose() }}
              palette={palette} isDark={isDark} destructive />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
})

function MenuItem({ icon: Icon, label, shortcut, onPress, palette, isDark, destructive }: {
  icon: any; label: string; shortcut?: string; onPress: () => void;
  palette: Palette; isDark: boolean; destructive?: boolean
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center active:opacity-70"
      style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
      <Icon size={16} color={destructive ? (isDark ? '#f87171' : '#dc2626') : palette.textSecondary} strokeWidth={1.8} />
      <Text style={{ fontSize: 14, fontWeight: '500', flex: 1, color: destructive ? (isDark ? '#f87171' : '#dc2626') : palette.text }}>
        {label}
      </Text>
      {shortcut && (
        <Text style={{ fontSize: 12, fontFamily: 'monospace', color: palette.textTertiary }}>{shortcut}</Text>
      )}
    </Pressable>
  )
}

function Separator({ isDark }: { isDark: boolean }) {
  return <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: 12 }} />
}
