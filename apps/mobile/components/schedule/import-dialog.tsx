import { useState, useCallback, memo } from 'react'
import { Text, View, Pressable, Modal, Alert, ActivityIndicator } from 'react-native'
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react-native'
import { type Palette } from '@skyhub/ui/theme'

interface ImportDialogProps {
  visible: boolean
  onClose: () => void
  onImportComplete: () => void
  operatorId: string
  scenarioId: string | null
  palette: Palette
  accent: string
  isDark: boolean
  apiBaseUrl: string
}

export const ImportDialog = memo(function ImportDialog({
  visible,
  onClose,
  onImportComplete,
  operatorId,
  scenarioId,
  palette,
  accent,
  isDark,
  apiBaseUrl,
}: ImportDialogProps) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handlePick = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const DocumentPicker = require('expo-document-picker') as { getDocumentAsync: (opts: any) => Promise<any> }
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      })
      if (res.canceled || !res.assets?.[0]) return

      const file = res.assets[0]
      setImporting(true)
      setResult(null)

      const formData = new FormData()
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any)
      formData.append('operatorId', operatorId)
      if (scenarioId) formData.append('scenarioId', scenarioId)

      const response = await fetch(`${apiBaseUrl}/ssim/import`, { method: 'POST', body: formData })
      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: `Imported ${data.count ?? data.inserted ?? 0} flights successfully` })
        onImportComplete()
      } else {
        setResult({ success: false, message: data.error || 'Import failed' })
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to import file' })
    } finally {
      setImporting(false)
    }
  }, [operatorId, scenarioId, apiBaseUrl, onImportComplete])

  const handleClose = () => {
    setResult(null)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={handleClose}>
        <View className="flex-1 justify-center items-center">
          <Pressable
            onPress={() => {}}
            className="rounded-2xl p-5"
            style={{
              width: 340,
              backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>Import SSIM</Text>
              <Pressable onPress={handleClose} className="active:opacity-60">
                <X size={18} color={palette.textTertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 16, lineHeight: 20 }}>
              Select an Excel (.xlsx) file containing your schedule data.
            </Text>

            {result && (
              <View
                className="flex-row items-center rounded-lg p-3 mb-4"
                style={{
                  backgroundColor: result.success
                    ? isDark
                      ? 'rgba(22,163,74,0.15)'
                      : '#dcfce7'
                    : isDark
                      ? 'rgba(220,38,38,0.15)'
                      : '#fee2e2',
                  gap: 8,
                }}
              >
                {result.success ? (
                  <CheckCircle size={16} color={isDark ? '#4ade80' : '#16a34a'} strokeWidth={2} />
                ) : (
                  <AlertCircle size={16} color={isDark ? '#f87171' : '#dc2626'} strokeWidth={2} />
                )}
                <Text
                  style={{
                    fontSize: 13,
                    color: result.success ? (isDark ? '#4ade80' : '#16a34a') : isDark ? '#f87171' : '#dc2626',
                    flex: 1,
                  }}
                >
                  {result.message}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handlePick}
              disabled={importing}
              className="flex-row items-center justify-center py-3.5 rounded-xl active:opacity-70"
              style={{ backgroundColor: accent, gap: 8, opacity: importing ? 0.5 : 1 }}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Upload size={16} color="#fff" strokeWidth={2} />
              )}
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                {importing ? 'Importing...' : 'Select File'}
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
})
