'use client'

import { useState, useCallback, useMemo } from 'react'
import { Download, X, FileText, Globe, Clock } from 'lucide-react'
import { api } from '@skyhub/api'
import { getOperatorId, useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'

interface SsimExportDialogProps {
  seasonCode: string
  scenarioId?: string
  flightCount: number
  onClose: () => void
}

type TimeMode = 'local' | 'utc'

/** Format an IANA timezone as "+HH:MM" for display, e.g. Asia/Ho_Chi_Minh → +07:00 */
function formatOffsetForDisplay(timeZone: string | null | undefined): string {
  if (!timeZone) return '+00:00'
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    const part = fmt.formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
    const m = part.match(/GMT([+-])(\d{2}):?(\d{2})/)
    if (!m) return '+00:00'
    return `${m[1]}${m[2]}:${m[3]}`
  } catch {
    return '+00:00'
  }
}

export function SsimExportDialog({ seasonCode, scenarioId, flightCount, onClose }: SsimExportDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const operator = useOperatorStore((s) => s.operator)
  const [exporting, setExporting] = useState(false)
  const [timeMode, setTimeMode] = useState<TimeMode>('local')

  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  const localOffset = useMemo(() => formatOffsetForDisplay(operator?.timezone), [operator?.timezone])
  const tzLabel = operator?.timezone ? `${operator.timezone} (${localOffset})` : 'Operator local time'

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const blob = await api.exportSsim({
        operatorId: getOperatorId(),
        seasonCode,
        scenarioId,
        format: 'ssim',
        timeMode,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const code = operator?.iataCode || operator?.code || 'OP'
      a.href = url
      const seasonPart = seasonCode ? `${seasonCode}_` : ''
      a.download = `SSIM_${code}_${seasonPart}${timeMode.toUpperCase()}_${stamp}.ssim`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      console.error('SSIM export failed:', e)
    } finally {
      setExporting(false)
    }
  }, [seasonCode, scenarioId, timeMode, operator?.iataCode, operator?.code, onClose])

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
              <FileText size={16} className="text-module-accent" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-hz-text leading-none">Export SSIM</h2>
              <p className="text-[13px] text-hz-text-tertiary mt-1">IATA Chapter 7 fixed-width text</p>
            </div>
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
        <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ backgroundColor: subtleBg }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(6,194,112,0.12)' : 'rgba(6,194,112,0.08)' }}
          >
            <Download size={18} style={{ color: '#06C270' }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-hz-text">{flightCount} flights</p>
            <p className="text-[13px] text-hz-text-secondary">
              Action code <span className="font-semibold">N</span> · New schedule
            </p>
          </div>
        </div>

        {/* Time mode radio */}
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-hz-text">Time format</p>
          <div className="grid grid-cols-2 gap-2">
            <TimeModeOption
              active={timeMode === 'local'}
              isDark={isDark}
              icon={<Clock size={16} />}
              title="Local time"
              subtitle={tzLabel}
              onClick={() => setTimeMode('local')}
            />
            <TimeModeOption
              active={timeMode === 'utc'}
              isDark={isDark}
              icon={<Globe size={16} />}
              title="UTC time"
              subtitle="Zulu (+00:00)"
              onClick={() => setTimeMode('utc')}
            />
          </div>
          <p className="text-[13px] text-hz-text-tertiary">
            {timeMode === 'local'
              ? 'Times are written as operator-local with the proper UTC offset.'
              : 'All times written as UTC; offset fields will be +0000.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
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
            disabled={exporting || flightCount === 0}
            className="h-10 px-5 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Download .ssim'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface TimeModeOptionProps {
  active: boolean
  isDark: boolean
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}

function TimeModeOption({ active, isDark, icon, title, subtitle, onClick }: TimeModeOptionProps) {
  const inactiveBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const activeBg = isDark ? 'rgba(62,123,250,0.12)' : 'rgba(30,64,175,0.06)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all"
      style={{
        border: active ? '1px solid var(--hz-accent, #1e40af)' : `1px solid ${inactiveBorder}`,
        background: active ? activeBg : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <div
        className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{
          border: active ? '5px solid var(--hz-accent, #1e40af)' : `1.5px solid ${inactiveBorder}`,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={active ? 'text-module-accent' : 'text-hz-text-secondary'}>{icon}</span>
          <span className="text-[13px] font-semibold text-hz-text">{title}</span>
        </div>
        <p className="text-[13px] text-hz-text-tertiary mt-0.5 truncate">{subtitle}</p>
      </div>
    </button>
  )
}
