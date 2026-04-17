'use client'

/**
 * 7.1.5.1 Delivery Log section.
 *
 * Per-consumer delivery audit. Each row is a released message; expanding
 * reveals one sub-row per consumer with delivery status, attempt count
 * and error detail. Export-to-CSV dumps the visible set.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react'
import { api, type DeliveryLogEntry, type AsmSsmDeliveryEntry } from '@skyhub/api'
import type { Palette as PaletteType } from '@skyhub/ui/theme'

interface Props {
  operatorId: string
  accent: string
  isDark: boolean
  palette: PaletteType
  onError: (msg: string | null) => void
}

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(255,136,0,0.12)', text: '#E67A00' },
  sent: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  partial: { bg: 'rgba(255,136,0,0.12)', text: '#E67A00' },
  failed: { bg: 'rgba(230,53,53,0.12)', text: '#E63535' },
  delivered: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  retrying: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
}

export function DeliveryLogSection({ operatorId, accent, isDark, onError }: Props) {
  const [entries, setEntries] = useState<DeliveryLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getDeliveryLog({
        operatorId,
        limit: 200,
        status: statusFilter ?? undefined,
      })
      setEntries(res.entries)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load delivery log')
    } finally {
      setLoading(false)
    }
  }, [operatorId, statusFilter, onError])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, sent: 0, partial: 0, failed: 0 }
    for (const e of entries) c[e.status] = (c[e.status] ?? 0) + 1
    return c
  }, [entries])

  const exportCsv = () => {
    const rows: string[] = []
    rows.push(
      [
        'messageId',
        'family',
        'actionCode',
        'flightNumber',
        'flightDate',
        'route',
        'status',
        'consumer',
        'mode',
        'deliveryStatus',
        'attempts',
        'deliveredAt',
        'error',
      ].join(','),
    )
    for (const e of entries) {
      const route = e.depStation && e.arrStation ? `${e.depStation}-${e.arrStation}` : ''
      if (e.deliveries.length === 0) {
        rows.push(
          [
            e._id,
            e.messageType,
            e.actionCode,
            e.flightNumber ?? '',
            e.flightDate ?? '',
            route,
            e.status,
            '',
            '',
            '',
            '',
            '',
            '',
          ]
            .map(csvEscape)
            .join(','),
        )
      } else {
        for (const d of e.deliveries) {
          rows.push(
            [
              e._id,
              e.messageType,
              e.actionCode,
              e.flightNumber ?? '',
              e.flightDate ?? '',
              route,
              e.status,
              d.consumerName ?? d.consumerId,
              d.deliveryMode,
              d.status,
              String(d.attemptCount ?? 0),
              d.deliveredAtUtc ?? '',
              d.errorDetail ?? '',
            ]
              .map(csvEscape)
              .join(','),
          )
        }
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
    a.download = `asm-ssm-delivery-log-${ts}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cardBg = isDark ? 'rgba(25,25,33,0.85)' : '#FFFFFF'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[13px] font-medium text-hz-text">
            {entries.length} message{entries.length === 1 ? '' : 's'} in window
          </div>
          <div className="text-[13px] text-hz-text-secondary">
            Expand a row to see per-consumer delivery state and retry history.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="h-9 px-3 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: accent }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter(null)}
          className="h-8 px-3 rounded-full text-[13px] font-medium"
          style={{
            background: statusFilter === null ? accent : 'rgba(96,97,112,0.08)',
            color: statusFilter === null ? '#fff' : 'var(--color-hz-text-secondary)',
          }}
        >
          All
        </button>
        {(['pending', 'sent', 'partial', 'failed'] as const).map((s) => {
          const c = STATUS_PILL[s]
          const active = statusFilter === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(active ? null : s)}
              className="h-8 px-3 rounded-full text-[13px] font-medium capitalize"
              style={{
                background: active ? c.text : c.bg,
                color: active ? '#fff' : c.text,
              }}
            >
              {s} ({counts[s] ?? 0})
            </button>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-hz-text-secondary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: cardBg, border: `1px dashed ${cardBorder}` }}>
          <div className="text-[14px] font-medium text-hz-text mb-1">No released messages yet</div>
          <div className="text-[13px] text-hz-text-secondary">
            Release messages from the Held Queue tab to see delivery attempts here.
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(96,97,112,0.04)',
                }}
              >
                <th className="px-3 py-2.5 w-[30px]"></th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Flight
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Deliveries
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const id = e._id
                const isOpen = expanded.has(id)
                const statusPill = STATUS_PILL[e.status] ?? {
                  bg: 'rgba(96,97,112,0.08)',
                  text: accent,
                }
                const summary = summarizeDeliveries(e.deliveries)
                return (
                  <>
                    <tr
                      key={id}
                      className="border-t cursor-pointer"
                      style={{
                        borderColor: cardBorder,
                        background:
                          i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(96,97,112,0.03)') : 'transparent',
                      }}
                      onClick={() => toggle(id)}
                    >
                      <td className="px-3 py-2.5 text-hz-text-secondary">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-3 py-2.5 text-hz-text font-medium">
                        {e.flightNumber ?? '—'}
                        {e.flightDate && <span className="text-hz-text-tertiary font-mono ml-2">{e.flightDate}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-hz-text-secondary">
                        {e.messageType} / {e.actionCode}
                      </td>
                      <td className="px-3 py-2.5 text-hz-text-tertiary">
                        {e.updatedAtUtc ? new Date(e.updatedAtUtc).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[11px] font-bold capitalize tracking-wider px-2 py-0.5 rounded"
                          style={{ background: statusPill.bg, color: statusPill.text }}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-hz-text-secondary">{summary}</td>
                    </tr>
                    {isOpen &&
                      (e.deliveries.length === 0 ? (
                        <tr key={`${id}-empty`}>
                          <td
                            colSpan={6}
                            className="px-6 py-3 text-[13px] text-hz-text-tertiary italic"
                            style={{ background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)' }}
                          >
                            No deliveries recorded — released before consumers were configured.
                          </td>
                        </tr>
                      ) : (
                        e.deliveries.map((d, di) => {
                          const dPill = STATUS_PILL[d.status] ?? { bg: 'rgba(96,97,112,0.08)', text: accent }
                          return (
                            <tr
                              key={`${id}-${di}`}
                              style={{
                                background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                              }}
                            >
                              <td></td>
                              <td className="px-3 py-2 text-hz-text-secondary">
                                {d.consumerName ?? d.consumerId.slice(0, 8)}
                              </td>
                              <td className="px-3 py-2 text-hz-text-tertiary">{d.deliveryMode}</td>
                              <td className="px-3 py-2 text-hz-text-tertiary">
                                {d.deliveredAtUtc
                                  ? new Date(d.deliveredAtUtc).toLocaleString()
                                  : d.lastAttemptAtUtc
                                    ? new Date(d.lastAttemptAtUtc).toLocaleString()
                                    : '—'}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className="text-[11px] font-bold capitalize tracking-wider px-2 py-0.5 rounded"
                                  style={{ background: dPill.bg, color: dPill.text }}
                                >
                                  {d.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-hz-text-tertiary text-[12px]">
                                attempt {d.attemptCount ?? 0}
                                {d.errorDetail && ` · ${d.errorDetail}`}
                              </td>
                            </tr>
                          )
                        })
                      ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function summarizeDeliveries(deliveries: AsmSsmDeliveryEntry[]): string {
  if (deliveries.length === 0) return 'none'
  const by: Record<string, number> = {}
  for (const d of deliveries) by[d.status] = (by[d.status] ?? 0) + 1
  return Object.entries(by)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ')
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}
