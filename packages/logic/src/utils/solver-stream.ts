// TODO: Replace @/app/actions/mip-solver — define MIPSolveRequest/MIPSolveResponse locally or import from shared types

// ─── Types ──────────────────────────────────────────────────────────────

/** Minimal MIPSolveRequest shape — replace with actual type from API layer */
export interface MIPSolveRequest {
  [key: string]: unknown
}

/** Minimal MIPSolveResponse shape — replace with actual type from API layer */
export interface MIPSolveResponse {
  [key: string]: unknown
}

export interface SolverProgressEvent {
  event: string
  message?: string
  phase?: string
  // blocks
  blocks?: number
  standalone?: number
  // window
  window?: number
  totalWindows?: number
  flights?: number
  // phase1_done
  assigned?: number
  total?: number
  chainBreaks?: number
  rotations?: number
  // cg_iteration
  iteration?: number
  objective?: number
  newColumns?: number
  poolSize?: number
  // window_done
  overflow?: number
}

export interface SolveMIPStreamOptions {
  payload: MIPSolveRequest
  onProgress: (event: SolverProgressEvent) => void
  onResult: (result: MIPSolveResponse) => void
  onError: (error: string) => void
  signal?: AbortSignal
}

// ─── SSE Stream Reader ──────────────────────────────────────────────────

export async function solveMIPStream({
  payload,
  onProgress,
  onResult,
  onError,
  signal,
}: SolveMIPStreamOptions): Promise<void> {
  let response: Response

  try {
    // TODO: Replace Supabase call — fetch from API
    response = await fetch('/api/solver/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (err: any) {
    if (err?.name === 'AbortError') return
    onError(err?.message || 'Failed to connect to solver')
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    onError(`Solver HTTP ${response.status}: ${text}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    onError('No response stream')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on double newline (SSE frame boundary)
      const frames = buffer.split('\n\n')
      // Last element is incomplete — keep it in buffer
      buffer = frames.pop() || ''

      for (const frame of frames) {
        if (!frame.trim()) continue

        let eventType = 'message'
        let dataStr = ''

        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).trim()
          }
        }

        if (!dataStr) continue

        try {
          const data = JSON.parse(dataStr)

          if (eventType === 'result') {
            onResult(data as MIPSolveResponse)
          } else if (eventType === 'error') {
            onError(data.message || 'Solver error')
          } else {
            onProgress({ event: eventType, ...data } as SolverProgressEvent)
          }
        } catch {
          // Skip malformed JSON frames
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return
    onError(err?.message || 'Stream read error')
  } finally {
    reader.releaseLock()
  }
}
