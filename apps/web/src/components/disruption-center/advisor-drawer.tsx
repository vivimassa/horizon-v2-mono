'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, Sparkles, X } from 'lucide-react'
import {
  api,
  type DisruptionAdviceResponse,
  type DisruptionAdviceSuggestion,
  type DisruptionIssueRef,
} from '@skyhub/api'
import { MODULE_REGISTRY } from '@skyhub/constants'
import { useTheme } from '@/components/theme-provider'
import { useDisruptionStore } from '@/stores/use-disruption-store'
import { CATEGORY_LABEL, SEVERITY_COLOR } from './severity-utils'

const ADVISOR_ACCENT = '#a855f7'

interface Props {
  issue: DisruptionIssueRef
}

/**
 * Right-column advisor panel that replaces the detail panel while
 * active. Fetches recovery suggestions from the ML service (or canned
 * fallback if the service is offline) and lets the user comment or
 * deep-link into the suggested module.
 */
export function AdvisorDrawer({ issue }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const setAdvisorOpen = useDisruptionStore((s) => s.setAdvisorOpen)

  const [data, setData] = useState<DisruptionAdviceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api
      .adviseDisruption(issue._id)
      .then((res) => {
        if (!alive) return
        setData(res)
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Failed to load advice')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [issue._id])

  const panelBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(168,85,247,0.22)' : 'rgba(168,85,247,0.18)'
  const severityColor = SEVERITY_COLOR[issue.severity]

  const openModule = (code?: string) => {
    if (!code) return
    const mod = MODULE_REGISTRY.find((m) => m.code === code)
    if (!mod?.route) return
    const params = new URLSearchParams({ disruptionId: issue._id })
    router.push(`${mod.route}?${params.toString()}`)
  }

  const applyAsComment = async (index: number, suggestion: DisruptionAdviceSuggestion) => {
    setApplying(index)
    try {
      await api.commentDisruption(issue._id, `[AI advisor] ${suggestion.title}. ${suggestion.detail}`)
    } catch {
      /* silent — comment is best-effort */
    } finally {
      setApplying(null)
    }
  }

  return (
    <aside
      className="shrink-0 h-full flex flex-col overflow-hidden"
      style={{ width: 420, borderLeft: `1px solid ${panelBorder}` }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: `1px solid ${panelBorder}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28,
              height: 28,
              background: `${ADVISOR_ACCENT}22`,
              border: `1px solid ${cardBorder}`,
            }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: ADVISOR_ACCENT }} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-hz-text">AI Advisor</div>
            <div className="text-[13px] text-hz-text-secondary truncate">
              <span style={{ color: severityColor, fontWeight: 600 }}>{CATEGORY_LABEL[issue.category]}</span>
              {issue.flightNumber ? ` · ${issue.flightNumber}` : ''}
              {issue.forDate ? ` · ${issue.forDate}` : ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAdvisorOpen(false)}
          aria-label="Close advisor"
          className="p-1 rounded-lg transition-opacity hover:opacity-80"
        >
          <X className="h-4 w-4 text-hz-text-tertiary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div
          className="rounded-xl px-4 py-3 mb-4"
          style={{
            background: `${ADVISOR_ACCENT}14`,
            border: `1px solid ${cardBorder}`,
          }}
        >
          <div className="text-[13px] font-semibold mb-1" style={{ color: ADVISOR_ACCENT }}>
            {data?.source === 'ml' ? 'Live model suggestion' : 'Heuristic suggestion'}
          </div>
          <div className="text-[13px] text-hz-text-secondary">
            {data?.source === 'ml'
              ? 'Recovery suggestions from the tenant-trained ML service.'
              : 'ML service not yet wired — showing category-keyed heuristics. Once your operator has enough resolved incidents these will be replaced with live predictions.'}
          </div>
        </div>

        {loading && (
          <div className="h-24 flex items-center justify-center gap-2 text-[13px] text-hz-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking about this one…
          </div>
        )}

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: 'rgba(255,59,59,0.08)',
              border: '1px solid rgba(255,59,59,0.28)',
              color: '#FF3B3B',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && data && data.suggestions.length === 0 && (
          <div className="h-24 flex items-center justify-center text-[13px] text-hz-text-tertiary">
            No suggestions available for this category yet.
          </div>
        )}

        {!loading && !error && data && data.suggestions.length > 0 && (
          <ul className="flex flex-col gap-3">
            {data.suggestions.map((s, i) => {
              const confidence = typeof s.confidence === 'number' ? Math.round(s.confidence * 100) : null
              return (
                <li
                  key={i}
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{ background: cardBg, border: `1px solid ${panelBorder}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[14px] font-semibold text-hz-text leading-snug">{s.title}</div>
                    {confidence !== null && (
                      <span
                        className="text-[13px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: `${ADVISOR_ACCENT}18`,
                          color: ADVISOR_ACCENT,
                        }}
                      >
                        {confidence}% confidence
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-hz-text-secondary leading-relaxed">{s.detail}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyAsComment(i, s)}
                      disabled={applying === i}
                      className="flex-1 h-8 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                      style={{
                        background: ADVISOR_ACCENT,
                        color: '#fff',
                        opacity: applying === i ? 0.6 : 1,
                      }}
                    >
                      {applying === i ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Logging…
                        </>
                      ) : (
                        'Log as note'
                      )}
                    </button>
                    {s.moduleCode && (
                      <button
                        type="button"
                        onClick={() => openModule(s.moduleCode)}
                        className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        style={{
                          color: ADVISOR_ACCENT,
                          border: `1px solid ${cardBorder}`,
                          background: 'transparent',
                        }}
                      >
                        Open module <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
