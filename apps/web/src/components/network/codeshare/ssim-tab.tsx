'use client'

import { useMemo } from 'react'
import { Copy, Download } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import type { CodeshareAgreementRef, CodeshareMappingRef } from '@skyhub/api'

interface SsimTabProps {
  agreement: CodeshareAgreementRef
  mappings: CodeshareMappingRef[]
  operatorCode: string
  isDark: boolean
}

function formatDateSsim(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${String(dt.getDate()).padStart(2, '0')}${months[dt.getMonth()]}${String(dt.getFullYear()).slice(2)}`
}

function statusChar(s: string): string {
  switch (s) {
    case 'active':
      return 'J'
    case 'pending':
      return 'W'
    case 'cancelled':
      return 'X'
    default:
      return 'J'
  }
}

export function SsimTab({ agreement, mappings, operatorCode, isDark }: SsimTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const ssimText = useMemo(() => {
    const lines: string[] = []

    // Header comments
    lines.push(`/ CODESHARE SSIM OUTPUT`)
    lines.push(`/ Partner: ${agreement.partnerAirlineName} (${agreement.partnerAirlineCode})`)
    lines.push(`/ Operating carrier: ${operatorCode}`)
    lines.push(`/ Agreement type: ${agreement.agreementType.replace(/_/g, ' ')}`)
    lines.push(
      `/ Effective: ${agreement.effectiveFrom}${agreement.effectiveUntil ? ' to ' + agreement.effectiveUntil : ' onwards'}`,
    )
    lines.push(`/ Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`)
    lines.push(`/ Mappings: ${mappings.length}`)
    lines.push(`/`)

    // SSIM Type 3 lines
    for (const m of mappings) {
      const partnerFlt = `${agreement.partnerAirlineCode}${m.marketingFlightNumber.padStart(4, ' ')}`
      const opFlt = `${operatorCode}${m.operatingFlightNumber.padStart(4, ' ')}`
      const from = formatDateSsim(m.effectiveFrom)
      const until = m.effectiveUntil ? formatDateSsim(m.effectiveUntil) : '       '
      const dow = m.daysOfOperation.padEnd(7, ' ')
      const status = statusChar(m.status)

      lines.push(`3 ${partnerFlt} ${m.departureIata}${m.arrivalIata} ${opFlt} ${dow} ${from} ${until} ${status}`)
    }

    return lines.join('\n')
  }, [agreement, mappings, operatorCode])

  function handleCopy() {
    navigator.clipboard.writeText(ssimText)
  }

  function handleDownload() {
    const blob = new Blob([ssimText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codeshare-${agreement.partnerAirlineCode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.ssim`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold" style={{ color: palette.text }}>
          SSIM Output
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors hover:opacity-90"
            style={{ background: accent, color: '#ffffff' }}
          >
            <Copy size={14} />
            Copy to clipboard
          </button>
          <button
            onClick={handleDownload}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${glassBorder}`,
              color: palette.text,
            }}
          >
            <Download size={14} />
            Download .ssim
          </button>
        </div>
      </div>

      {/* SSIM text output */}
      <pre
        className="rounded-xl p-4 text-[13px] font-mono leading-relaxed overflow-x-auto whitespace-pre"
        style={{
          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${glassBorder}`,
          color: palette.text,
        }}
      >
        {ssimText}
      </pre>

      {mappings.length === 0 && (
        <div className="text-center text-[13px] mt-6" style={{ color: palette.textTertiary }}>
          Add flight mappings to generate SSIM output
        </div>
      )}
    </div>
  )
}
