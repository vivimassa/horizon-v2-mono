'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, X, RefreshCw, Copy, Check } from 'lucide-react'
import { getOperatorId } from '@/stores/use-operator-store'
import { api } from '@skyhub/api'

interface MessageDialogProps {
  dateFrom?: string
  dateTo?: string
  targetScenarioId?: string
  onClose: () => void
}

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

export function MessageDialog({ dateFrom, dateTo, targetScenarioId, onClose }: MessageDialogProps) {
  const [messages, setMessages] = useState<ScheduleMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.generateScheduleMessages({
        operatorId: getOperatorId(),
        dateFrom,
        dateTo,
        targetScenarioId,
      })
      setMessages(result.messages)
      setGenerated(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, targetScenarioId])

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
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors">
            <X size={16} className="text-hz-text-secondary" />
          </button>
        </div>

        {!generated ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-[14px] text-hz-text-secondary">
              Generate ASM messages by comparing production schedule with the current view.
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
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[13px] text-hz-text-secondary">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
              >
                {copied ? <Check size={13} className="text-[#06C270]" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy All'}
              </button>
            </div>

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
