'use client'

import type { CharterContractRef } from '@skyhub/api'
import { useCharterStore } from '@/stores/use-charter-store'

interface CostsTabProps {
  contract: CharterContractRef
  isDark: boolean
}

function fmtBlockTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function fmtMoney(val: number, currency: string): string {
  return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function CostsTab({ contract, isDark }: CostsTabProps) {
  const stats = useCharterStore(s => s.stats)
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const labelColor = isDark ? '#8F90A6' : '#555770'

  const totalRevenue = stats.estimatedRevenue

  return (
    <div className="p-5 space-y-4">
      {/* Flight Summary */}
      <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: labelColor }}>Flight Summary</div>
        <div className="space-y-2">
          <Row label="Revenue flights" value={`${stats.revenueFlights} sectors`} color={isDark ? '#39D98A' : '#06C270'} />
          <Row label="Positioning legs" value={`${stats.positioningFlights} sectors`} color={isDark ? '#FDAC42' : '#E67A00'} />
          <Row label="Total block time" value={fmtBlockTime(stats.totalBlockMinutes)} />
          <Row label="Total passengers" value={stats.paxTotal.toString()} />
        </div>
      </div>

      {/* Revenue Estimate */}
      <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: labelColor }}>Revenue Estimate</div>
        {contract.ratePerSector ? (
          <div className="text-[13px] text-hz-text-secondary mb-2">
            {stats.revenueFlights} sectors &times; {fmtMoney(contract.ratePerSector, contract.currency)}/sector
          </div>
        ) : contract.ratePerBlockHour ? (
          <div className="text-[13px] text-hz-text-secondary mb-2">
            {(stats.totalBlockMinutes / 60).toFixed(1)} BH &times; {fmtMoney(contract.ratePerBlockHour, contract.currency)}/BH
          </div>
        ) : (
          <div className="text-[13px] text-hz-text-tertiary mb-2">No rates configured</div>
        )}
        <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold">Total revenue</span>
            <span className="text-[18px] font-bold font-mono" style={{ color: isDark ? '#39D98A' : '#06C270' }}>
              {fmtMoney(totalRevenue, contract.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Cancellation Exposure */}
      {totalRevenue > 0 && (
        <div className="rounded-xl p-4" style={{
          background: isDark ? 'rgba(255,59,59,0.06)' : 'rgba(255,59,59,0.04)',
          border: `1px solid ${isDark ? 'rgba(255,92,92,0.15)' : 'rgba(255,59,59,0.12)'}`,
        }}>
          <div className="text-[13px] font-semibold uppercase tracking-wider mb-3"
            style={{ color: isDark ? '#FF5C5C' : '#E63535' }}>
            Cancellation Exposure
          </div>
          <div className="space-y-2">
            <Row
              label={`If cancelled <14d (${contract.cancelPenalty14d}%)`}
              value={fmtMoney(totalRevenue * contract.cancelPenalty14d / 100, contract.currency)}
              color={isDark ? '#FF5C5C' : '#E63535'}
              mono
            />
            <Row
              label={`If cancelled <7d (${contract.cancelPenalty7d}%)`}
              value={fmtMoney(totalRevenue * contract.cancelPenalty7d / 100, contract.currency)}
              color={isDark ? '#FF5C5C' : '#E63535'}
              mono
            />
            <Row
              label={`If cancelled <48h (${contract.cancelPenalty48h}%)`}
              value={fmtMoney(totalRevenue * contract.cancelPenalty48h / 100, contract.currency)}
              color={isDark ? '#FF5C5C' : '#E63535'}
              mono
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-hz-text-secondary">{label}</span>
      <span className={`text-[13px] font-semibold ${mono ? 'font-mono' : ''}`} style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}
