import { useState, useCallback, memo } from 'react'
import { Text, View, Pressable, Modal, Alert, ActivityIndicator } from 'react-native'
import { X, Download } from 'lucide-react-native'
import { type Palette } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'

interface ExportDialogProps {
  visible: boolean
  onClose: () => void
  operatorId: string
  scenarioId: string | null
  palette: Palette
  accent: string
  isDark: boolean
}

export const ExportDialog = memo(function ExportDialog({
  visible, onClose, operatorId, scenarioId, palette, accent, isDark,
}: ExportDialogProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const blob = await api.exportSsim({ operatorId, seasonCode: '', scenarioId: scenarioId ?? undefined })

      // Try expo-sharing dynamically
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Sharing = require('expo-sharing') as { shareAsync: (uri: string, opts?: any) => Promise<void> }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const FS = require('expo-file-system') as any
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          const fileUri = `${FS.cacheDirectory}schedule-export.xlsx`
          await FS.writeAsStringAsync(fileUri, base64, { encoding: FS.EncodingType.Base64 })
          await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          onClose()
        }
        reader.readAsDataURL(blob)
      } catch {
        Alert.alert('Export', 'File exported. Sharing not available on this device.')
        onClose()
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export schedule')
    } finally {
      setExporting(false)
    }
  }, [operatorId, scenarioId, onClose])

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={onClose}>
        <View className="flex-1 justify-center items-center">
          <Pressable onPress={() => {}} className="rounded-2xl p-5"
            style={{
              width: 320,
              backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
            }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Export SSIM</Text>
              <Pressable onPress={onClose} className="active:opacity-60">
                <X size={18} color={palette.textTertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 16, lineHeight: 20 }}>
              Export the current schedule as an Excel (.xlsx) file.
            </Text>

            <Pressable onPress={handleExport} disabled={exporting}
              className="flex-row items-center justify-center py-3.5 rounded-xl active:opacity-70"
              style={{ backgroundColor: accent, gap: 8, opacity: exporting ? 0.5 : 1 }}>
              {exporting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Download size={16} color="#fff" strokeWidth={2} />}
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                {exporting ? 'Exporting...' : 'Export & Share'}
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
})
