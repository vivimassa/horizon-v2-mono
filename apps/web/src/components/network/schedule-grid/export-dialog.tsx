'use client'

import { useState, useCallback } from 'react'
import { Download, X, FileSpreadsheet } from 'lucide-react'
import { api } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'

interface ExportDialogProps {
  seasonCode: string
  scenarioId?: string
  flightCount: number
  dateFrom?: string
  dateTo?: string
  onClose: () => void
}

export function ExportDialog({ seasonCode, scenarioId, flightCount, dateFrom, dateTo, onClose }: ExportDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [exporting, setExporting] = useState(false)

  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const blob = await api.exportSsim({ operatorId: getOperatorId(), seasonCode, scenarioId })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Format filename: Schedule_DDMMYYYY_DDMMYYYY.xlsx
      const toFileDate = (d: string) => {
        if (!d) return '00000000'
        // Handle ISO (YYYY-MM-DD) or DD/MM/YYYY or other formats
        const clean = d.replace(/[-/.]/g, '')
        if (clean.length === 8 && d.includes('-') && d.indexOf('-') === 4) {
          // ISO: YYYYMMDD → DDMMYYYY
          return clean.slice(6, 8) + clean.slice(4, 6) + clean.slice(0, 4)
        }
        return clean.slice(0, 8)
      }
      a.download = `Schedule_${toFileDate(dateFrom ?? '')}_${toFileDate(dateTo ?? '')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }, [seasonCode, scenarioId, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4"
        style={{
          backgroundColor: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 12px 48px rgba(0,0,0,0.5)' : '0 12px 48px rgba(96,97,112,0.18)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.08)' }}
            >
              <Download size={16} className="text-module-accent" />
            </div>
            <h2 className="text-[16px] font-bold text-hz-text">Export Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={15} className="text-hz-text-tertiary" />
          </button>
        </div>

        {/* Info */}
        <div className="flex items-center gap-3 py-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(6,194,112,0.12)' : 'rgba(6,194,112,0.08)' }}
          >
            <FileSpreadsheet size={20} style={{ color: '#06C270' }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-hz-text">Schedule Export</p>
            <p className="text-[13px] text-hz-text-secondary">{flightCount} flights will be exported as .xlsx</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-lg text-[13px] font-medium text-hz-text-secondary transition-colors"
            style={{ border: `1px solid ${border}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="h-10 px-5 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Download .xlsx'}
          </button>
        </div>
      </div>
    </div>
  )
}
