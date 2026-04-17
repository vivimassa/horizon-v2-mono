'use client'

/**
 * ASM/SSM Message Dialog for Movement Control (2.1.1)
 * Same pattern as 1.1.1 Scheduling XL's MessageDialog —
 * generates ASM messages by comparing scenario vs production.
 */

import { useState, useCallback } from 'react'
import { MessageSquare, X, RefreshCw, Copy, Check, PauseCircle } from 'lucide-react'
import Link from 'next/link'
import { getOperatorId } from '@/stores/use-operator-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useGanttStore } from '@/stores/use-gantt-store'
import { api } from '@skyhub/api'

interface ScheduleMessage {
  type: string
  actionCode: string
  flightNumber: string
  depStation: string
  arrStation: string
  summary: string
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  CNL: { bg: 'rgba(255,59,59,0.12)', text: '#E63535' },
  TIM: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
  EQT: { bg: 'rgba(102,0,204,0.10)', text: '#6600CC' },
  RRT: { bg: 'rgba(255,136,0,0.12)', text: '#E67A00' },
}

export function AsmMessageDialog({ onClose }: { onClose: () => void }) {
  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)
  const scenarioId = useOperatorStore((s) => s.activeScenarioId)
  const operatorIataCode = useOperatorStore((s) => s.operator?.iataCode)

  const [messages, setMessages] = useState<ScheduleMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [holding, setHolding] = useState(false)
  // After a successful hold we show a confirmation banner with a link to 7.1.5.1.
  const [holdResult, setHoldResult] = useState<{ held: number; neutralized: number } | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.generateScheduleMessages({
        operatorId: getOperatorId(),
        dateFrom: periodFrom,
        dateTo: periodTo,
        targetScenarioId: scenarioId ?? undefined,
      })
      setMessages(result.messages)
      setGenerated(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [periodFrom, periodTo, scenarioId])

  const handleHold = useCallback(async () => {
    if (!operatorIataCode) {
      setHoldError('Operator IATA code is not configured — cannot emit ASM/SSM.')
      return
    }
    setHolding(true)
    setHoldError(null)
    try {
      const result = await api.generateAndHoldScheduleMessages({
        operatorId: getOperatorId(),
        dateFrom: periodFrom,
        dateTo: periodTo,
        targetScenarioId: scenarioId ?? undefined,
        operatorIataCode,
      })
      setHoldResult(result)
    } catch (e) {
      setHoldError(e instanceof Error ? e.message : 'Hold failed')
    } finally {
      setHolding(false)
    }
  }, [periodFrom, periodTo, scenarioId, operatorIataCode])

  const handleCopy = useCallback(() => {
    const text = messages.map((m) => m.summary).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [messages])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-module-accent" />
            <h2 className="text-[16px] font-bold">ASM/SSM Messages</h2>
            {scenarioId && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-module-accent/10 text-module-accent">
                What-If mode
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors">
            <X size={16} className="text-hz-text-secondary" />
          </button>
        </div>

        {!generated ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-[14px] text-hz-text-secondary">
              {scenarioId
                ? 'Generate ASM messages by comparing What-If scenario with production schedule.'
                : 'Generate ASM messages by comparing production schedule changes.'}
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Generating...' : 'Generate Messages'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 shrink-0">
              <span className="text-[13px] text-hz-text-secondary">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                >
                  {copied ? <Check size={13} className="text-[#06C270]" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
                {!holdResult && (
                  <button
                    onClick={handleHold}
                    disabled={holding || messages.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-40 transition-colors"
                  >
                    {holding ? <RefreshCw size={13} className="animate-spin" /> : <PauseCircle size={13} />}
                    {holding ? 'Holding…' : 'Hold for Review'}
                  </button>
                )}
              </div>
            </div>

            {holdResult && (
              <div
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                style={{
                  background: 'rgba(6,194,112,0.10)',
                  border: '1px solid rgba(6,194,112,0.28)',
                }}
              >
                <span className="text-[13px] text-hz-text">
                  <Check size={13} className="inline text-[#06C270] mr-1" />
                  {holdResult.held} message{holdResult.held === 1 ? '' : 's'} held for review
                  {holdResult.neutralized > 0 ? ` · ${holdResult.neutralized} neutralized` : ''}
                </span>
                <Link
                  href="/settings/admin/integration/asm-ssm-transmission"
                  className="text-[12px] font-semibold text-module-accent hover:underline shrink-0"
                >
                  Open 7.1.5.1 →
                </Link>
              </div>
            )}

            {holdError && (
              <div
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                style={{
                  background: 'rgba(230,53,53,0.08)',
                  border: '1px solid rgba(230,53,53,0.28)',
                }}
              >
                <span className="text-[13px] text-[#E63535]">{holdError}</span>
                <button onClick={() => setHoldError(null)} className="text-[12px] text-hz-text-tertiary">
                  Dismiss
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1">
              {messages.length === 0 ? (
                <p className="text-[14px] text-hz-text-tertiary py-8 text-center">
                  No differences found — schedules are identical.
                </p>
              ) : (
                messages.map((m, i) => {
                  const color = ACTION_COLORS[m.actionCode] ?? ACTION_COLORS.TIM
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-hz-border/50 hover:bg-hz-border/10 transition-colors"
                    >
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: color.bg, color: color.text }}
                      >
                        {m.actionCode}
                      </span>
                      <span className="text-[13px] font-medium shrink-0">{m.flightNumber}</span>
                      <span className="text-[13px] text-hz-text-secondary shrink-0">
                        {m.depStation}→{m.arrStation}
                      </span>
                      <span className="text-[12px] text-hz-text-tertiary flex-1 truncate">{m.summary}</span>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
