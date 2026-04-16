'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DisruptionActivityRef, DisruptionIssueRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

type StepKey = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'

interface Step {
  key: StepKey
  label: string
  /** Activity actionType(s) that mark *entry* into this step. */
  triggers: DisruptionActivityRef['actionType'][]
}

const STEPS: Step[] = [
  { key: 'open', label: 'Open', triggers: ['created'] },
  { key: 'assigned', label: 'Assigned', triggers: ['assigned'] },
  { key: 'in_progress', label: 'In progress', triggers: ['started'] },
  { key: 'resolved', label: 'Resolved', triggers: ['resolved'] },
  { key: 'closed', label: 'Closed', triggers: ['closed'] },
]

const STATUS_TO_INDEX: Record<DisruptionIssueRef['status'], number> = {
  open: 0,
  assigned: 1,
  in_progress: 2,
  resolved: 3,
  closed: 4,
}

const COMPLETED_COLOR = '#06C270'
const CURRENT_COLOR = '#FF8800'
const FUTURE_COLOR = '#8F90A6'

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toUTCString().replace('GMT', 'UTC')
}

function pickActivity(
  activity: DisruptionActivityRef[],
  triggers: DisruptionActivityRef['actionType'][],
): DisruptionActivityRef | null {
  for (let i = activity.length - 1; i >= 0; i -= 1) {
    if (triggers.includes(activity[i].actionType)) return activity[i]
  }
  return null
}

interface Props {
  issue: DisruptionIssueRef
  activity: DisruptionActivityRef[]
}

/**
 * 3-step workflow wheel: previous (faint green) → current (orange glow) →
 * next (grey). Reads timestamps and actor names from the activity log
 * when available; falls back to issue fields and "—" for unknown.
 */
export function WorkflowTimeline({ issue, activity }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const futureDotBg = isDark ? '#13131A' : '#FAFAFC'

  const items = useMemo(() => {
    const currentIdx = STATUS_TO_INDEX[issue.status]
    const startIdx = Math.max(0, Math.min(currentIdx - 1, STEPS.length - 3))
    const endIdx = Math.min(STEPS.length - 1, startIdx + 2)

    return STEPS.slice(startIdx, endIdx + 1).map((step, i) => {
      const absoluteIdx = startIdx + i
      const stage: 'past' | 'current' | 'future' =
        absoluteIdx < currentIdx ? 'past' : absoluteIdx === currentIdx ? 'current' : 'future'

      const log = pickActivity(activity, step.triggers)

      // Build sub-text per step: who did it / when
      let actor: string | null = null
      let timestamp: string | null = null

      if (step.key === 'open') {
        actor = log?.userName ?? 'System'
        timestamp = formatTime(log?.createdAt ?? issue.createdAt)
      } else if (step.key === 'assigned') {
        actor = issue.assignedToName ?? log?.userName ?? null
        timestamp = formatTime(issue.assignedAt ?? log?.createdAt ?? null)
      } else if (step.key === 'in_progress') {
        actor = log?.userName ?? null
        timestamp = formatTime(log?.createdAt ?? null)
      } else if (step.key === 'resolved') {
        actor = log?.userName ?? null
        timestamp = formatTime(issue.resolvedAt ?? log?.createdAt ?? null)
      } else if (step.key === 'closed') {
        actor = log?.userName ?? null
        timestamp = formatTime(issue.closedAt ?? log?.createdAt ?? null)
      }

      return { ...step, stage, actor, timestamp }
    })
  }, [issue, activity])

  // ── Geometry ──
  // 16px rail column on the left holds the dots and the line. All dots
  // are centered at RAIL_CENTER_X. Vertically, every dot center is at
  // DOT_CENTER_Y inside its own row (regardless of dot size).
  const RAIL_WIDTH = 16
  const TEXT_GAP = 12
  const PADDING_LEFT = RAIL_WIDTH + TEXT_GAP
  const RAIL_CENTER_X = RAIL_WIDTH / 2 // 8
  const LINE_WIDTH = 2
  const BIG_DOT = 14
  const SMALL_DOT = 10
  const DOT_CENTER_Y = 4 + BIG_DOT / 2 // 11

  // ── Continuous gradient line ──
  // A single absolutely-positioned <span> spans from the first dot's
  // measured center to the last dot's measured center, with a CSS
  // linear-gradient whose color stops sit precisely under each dot.
  // Because text rows have variable height, we measure DOM positions
  // after layout and re-measure on resize.
  const containerRef = useRef<HTMLOListElement | null>(null)
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([])
  const [linePos, setLinePos] = useState<{ top: number; height: number; stops: number[] } | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const dots = dotRefs.current.filter((d): d is HTMLSpanElement => d !== null)
      if (dots.length < 2) {
        setLinePos(null)
        return
      }
      const containerTop = el.getBoundingClientRect().top
      const ys = dots.map((d) => {
        const r = d.getBoundingClientRect()
        return r.top + r.height / 2 - containerTop
      })
      const top = ys[0]
      const height = ys[ys.length - 1] - top
      if (height <= 0) {
        setLinePos(null)
        return
      }
      const stops = ys.map((y) => ((y - top) / height) * 100)
      setLinePos({ top, height, stops })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items])

  const stopColor = (stage: 'past' | 'current' | 'future'): string => {
    if (stage === 'past') return `${COMPLETED_COLOR}AA`
    if (stage === 'current') return `${CURRENT_COLOR}E6`
    return `${FUTURE_COLOR}55`
  }

  const gradient = linePos
    ? `linear-gradient(to bottom, ${items.map((it, i) => `${stopColor(it.stage)} ${linePos.stops[i]}%`).join(', ')})`
    : undefined

  return (
    <ol ref={containerRef} className="relative flex flex-col">
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes wfTimelinePulse {
            0%, 100% { box-shadow: 0 0 0 3px ${CURRENT_COLOR}14, 0 0 10px ${CURRENT_COLOR}55; }
            50%      { box-shadow: 0 0 0 4px ${CURRENT_COLOR}1f, 0 0 14px ${CURRENT_COLOR}80; }
          }`,
        }}
      />

      {/* One real gradient line, drawn behind every dot. */}
      {linePos && gradient && (
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: RAIL_CENTER_X - LINE_WIDTH / 2,
            top: linePos.top,
            height: linePos.height,
            width: LINE_WIDTH,
            background: gradient,
            borderRadius: 1,
            zIndex: 0,
          }}
        />
      )}

      {items.map((item, i) => {
        const isCurrent = item.stage === 'current'
        const isPast = item.stage === 'past'
        const isFuture = item.stage === 'future'

        const dotColor = isCurrent ? CURRENT_COLOR : isPast ? COMPLETED_COLOR : FUTURE_COLOR
        const dotSize = isCurrent ? BIG_DOT : SMALL_DOT
        const labelOpacity = isCurrent ? 1 : isPast ? 0.55 : 0.85
        const subOpacity = isCurrent ? 0.85 : isPast ? 0.4 : 0.55

        const isLast = i === items.length - 1

        return (
          <li
            key={item.key}
            className="relative"
            style={{
              paddingLeft: PADDING_LEFT,
              paddingBottom: isLast ? 0 : 20,
              minHeight: 28,
            }}
          >
            {/* Dot — sits above the gradient line. */}
            <span
              ref={(el) => {
                dotRefs.current[i] = el
              }}
              aria-hidden
              className="absolute rounded-full"
              style={{
                width: dotSize,
                height: dotSize,
                left: RAIL_CENTER_X - dotSize / 2,
                top: DOT_CENTER_Y - dotSize / 2,
                background: isFuture ? futureDotBg : dotColor,
                border: isFuture ? `2px solid ${FUTURE_COLOR}` : 'none',
                boxShadow: isCurrent ? `0 0 0 3px ${CURRENT_COLOR}14, 0 0 10px ${CURRENT_COLOR}55` : 'none',
                animation: isCurrent ? 'wfTimelinePulse 2.4s ease-in-out infinite' : undefined,
                zIndex: 1,
              }}
            />

            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-hz-text leading-tight" style={{ opacity: labelOpacity }}>
                {item.label}
                {item.actor && <span className="font-normal text-hz-text-secondary"> · {item.actor}</span>}
              </div>
              {item.timestamp && (
                <div className="text-[13px] text-hz-text-tertiary mt-0.5" style={{ opacity: subOpacity }}>
                  {item.timestamp}
                </div>
              )}
              {!item.timestamp && isFuture && (
                <div className="text-[13px] text-hz-text-tertiary mt-0.5" style={{ opacity: subOpacity }}>
                  Pending
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
