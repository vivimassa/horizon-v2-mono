import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DisruptionIssue } from '../models/DisruptionIssue.js'

type AdviseCategory =
  | 'TAIL_SWAP'
  | 'DELAY'
  | 'CANCELLATION'
  | 'DIVERSION'
  | 'CONFIG_CHANGE'
  | 'MISSING_OOOI'
  | 'MAINTENANCE_RISK'
  | 'CURFEW_VIOLATION'
  | 'TAT_VIOLATION'

interface AdvisorSuggestion {
  title: string
  detail: string
  moduleCode?: string
  confidence?: number
}

const CANNED: Record<AdviseCategory, AdvisorSuggestion[]> = {
  TAIL_SWAP: [
    {
      title: 'Swap with earliest available tail of same sub-fleet',
      detail:
        'Scan Movement Control for aircraft returning before scheduled departure; prefer same AC sub-type to avoid crew re-qual.',
      moduleCode: '2.1.1',
      confidence: 0.82,
    },
    {
      title: 'Delay pairing onward flight by 30 min',
      detail: 'If no swap candidate, absorb delay on the next rotation segment; verify against CAAV VAR 15 duty-time.',
      moduleCode: '2.1.1',
      confidence: 0.61,
    },
  ],
  DELAY: [
    {
      title: 'Inform downstream stations and reflow turnaround',
      detail: 'Push updated ETA to ground ops; compress turnaround where allowed; revalidate slot compliance.',
      moduleCode: '2.1.1',
      confidence: 0.74,
    },
    {
      title: 'Check crew duty limits for delayed rotation',
      detail: 'Confirm no FDP breach; if at risk, pre-book standby crew.',
      moduleCode: '2.3',
      confidence: 0.66,
    },
  ],
  CANCELLATION: [
    {
      title: 'Rebook passengers on next available sector',
      detail: 'Prioritise connecting pax and premium cabin; coordinate interline if needed.',
      confidence: 0.8,
    },
    {
      title: 'Reposition aircraft for next rotation',
      detail: 'Avoid leaving tail out of station; plan ferry if commercially justified.',
      moduleCode: '2.1.1',
      confidence: 0.55,
    },
  ],
  DIVERSION: [
    {
      title: 'Ground-handle at diversion station',
      detail: 'Confirm handling agent, fuel, and onward routing. Coordinate with destination for replanning.',
      moduleCode: '2.1.1',
      confidence: 0.7,
    },
  ],
  CONFIG_CHANGE: [
    {
      title: 'Reassign tail with matching configuration',
      detail: 'Pax seat-map mismatch impacts cabin/crew briefings. Prefer same LOPA variant.',
      moduleCode: '2.1.1',
      confidence: 0.68,
    },
  ],
  MISSING_OOOI: [
    {
      title: 'Reconcile OOOI from ground ops logs',
      detail: 'Poll ramp/ACARS for latest OUT/OFF/ON/IN; flag station if chronic.',
      confidence: 0.6,
    },
  ],
  MAINTENANCE_RISK: [
    {
      title: 'Re-assign tail in AMOS and propagate to schedule',
      detail: 'Swap to a tail inside maintenance envelope; push change to Aircraft Status Board.',
      moduleCode: '2.1.2.2',
      confidence: 0.78,
    },
    {
      title: 'Advance the check window',
      detail: 'If MX block can be pulled earlier with cost penalty, compare against swap cost.',
      moduleCode: '2.1.2.1',
      confidence: 0.52,
    },
  ],
  CURFEW_VIOLATION: [
    {
      title: 'Retime to avoid curfew or request exemption',
      detail: 'Pull earlier or push to next day; if exemption possible, file with station.',
      moduleCode: '2.1.1',
      confidence: 0.64,
    },
  ],
  TAT_VIOLATION: [
    {
      title: 'Extend turnaround to minimum TAT',
      detail: 'Reflow arrival or departure by the shortfall; rebalance pairing if crew-constrained.',
      moduleCode: '2.1.1',
      confidence: 0.7,
    },
  ],
}

export async function mlRoutes(app: FastifyInstance) {
  // ── POST /ml/advise-disruption — suggest recovery actions for an issue ──
  app.post('/ml/advise-disruption', async (req, reply) => {
    const parsed = z.object({ issueId: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const issue: any = await DisruptionIssue.findById(parsed.data.issueId).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })

    const category = issue.category as AdviseCategory
    const suggestions = CANNED[category] ?? []

    const context = {
      flightNumber: issue.flightNumber ?? null,
      forDate: issue.forDate ?? null,
      depStation: issue.depStation ?? null,
      arrStation: issue.arrStation ?? null,
      tail: issue.tail ?? null,
      category,
      severity: issue.severity,
      score: issue.score ?? null,
      reasons: issue.reasons ?? [],
    }

    const mlUrl = process.env.ML_API_URL
    if (mlUrl) {
      try {
        const res = await fetch(`${mlUrl}/advise-disruption`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(context),
          signal: AbortSignal.timeout(4000),
        })
        if (res.ok) {
          const body = await res.json()
          if (Array.isArray(body?.suggestions) && body.suggestions.length > 0) {
            return { source: 'ml', context, suggestions: body.suggestions as AdvisorSuggestion[] }
          }
        }
      } catch {
        // fall through to canned
      }
    }

    return { source: 'canned', context, suggestions }
  })
}
