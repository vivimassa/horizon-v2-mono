'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProgressState {
  active: boolean
  percent: number
  label: string
}

interface ProgressAPI {
  /** Start/update progress — call repeatedly as percent changes */
  update: (percent: number, label?: string) => void
  /** Start a smooth auto-advancing progress. Reaches ~90% over estimatedMs, then waits for done(). */
  start: (estimatedMs?: number, label?: string) => void
  /** Update just the label without changing progress */
  label: (label: string) => void
  /** Complete and dismiss after the aircraft reaches the end */
  done: (label?: string) => void
  /** Reset immediately (no animation) */
  reset: () => void
}

// ─── Context ────────────────────────────────────────────────────────────────

const ProgressContext = createContext<ProgressAPI | null>(null)

/** Hook to control the global runway progress bar from any component */
export function useRunwayProgress(): ProgressAPI {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useRunwayProgress must be used within GlobalRunwayProgress')
  return ctx
}

// ─── Smooth Animation Hook ──────────────────────────────────────────────────

function useAnimatedValue(target: number): number {
  const [value, setValue] = useState(0)
  const currentRef = useRef(0)
  const targetRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    targetRef.current = target

    const animate = () => {
      const diff = targetRef.current - currentRef.current
      if (Math.abs(diff) < 0.1) {
        currentRef.current = targetRef.current
        setValue(targetRef.current)
        return
      }
      // Faster lerp for bigger jumps, smoother for small ones
      const speed = Math.abs(diff) > 20 ? 0.12 : 0.06
      currentRef.current += diff * speed
      setValue(currentRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return value
}

// ─── Runway Bar (matches 1.1.3 Gantt exactly) ──────────────────────────────

export function RunwayBar({ percent, label }: { percent: number; label: string }) {
  const p = useAnimatedValue(percent)
  // SVG viewBox: 600 x 40. All markings drawn to scale.
  // Layout (left→right): chevron(0-30) | demarcation(30-34) | displaced threshold arrows(34-55) | threshold bars(55-72) | designation "25"(72-90) | TDZ 500-3000(90-200) | aiming point(200-230) | centerline(230-370) | aiming point(370-400) | TDZ(400-510) | designation "07"(510-528) | threshold bars(528-545) | demarcation(546-550) | chevron(550-580) | overrun(580-600)
  const W = 600, H = 44
  const lightCount = 20

  const mk = (pct: number) => pct < p ? 0.85 : 0.08 // marking opacity based on progress
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mkS = (pct: number) => pct < p ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.08)'

  return (
    <div className="w-full max-w-2xl overflow-visible">
      <div className="relative overflow-visible" style={{ height: 64 }}>
        {/* Runway glow — ambient light beneath */}
        <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 rounded-lg" style={{
          height: 52,
          background: 'radial-gradient(ellipse at center, rgba(255,200,50,0.06) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }} />
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 overflow-hidden rounded-[3px]" style={{
          height: 44,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>

          {/* Dimmed asphalt base */}
          <div className="absolute inset-0 dark:hidden" style={{ background: 'linear-gradient(180deg, #2a2a2c, #1e1e20)', opacity: 0.3 }} />
          <div className="absolute inset-0 hidden dark:block" style={{ background: 'linear-gradient(180deg, #383838, #282828)', opacity: 0.3 }} />

          {/* Revealed asphalt — feathered right edge */}
          <div className="absolute inset-0 overflow-hidden" style={{
            width: `${p}%`,
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}>
            <div className="absolute inset-0 dark:hidden" style={{ background: 'linear-gradient(180deg, #2a2a2c, #1e1e20)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }} />
            <div className="absolute inset-0 hidden dark:block" style={{ background: 'linear-gradient(180deg, #383838, #282828)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }} />
          </div>

          {/* SVG markings layer */}
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {/* ── Edge lines (solid white) ── */}
            <line x1="0" y1="1.5" x2={W} y2="1.5" stroke="white" strokeOpacity={p > 1 ? 0.6 : 0.1} strokeWidth="1" />
            <line x1="0" y1={H - 1.5} x2={W} y2={H - 1.5} stroke="white" strokeOpacity={p > 1 ? 0.6 : 0.1} strokeWidth="1" />

            {/* ── LEFT CHEVRONS (yellow, overrun area 0-28) ── */}
            {[4, 12, 20].map(x => (
              <polyline key={x} points={`${x},${H / 2 + 10} ${x + 8},${H / 2} ${x},${H / 2 - 10}`}
                fill="none" stroke="#d4a017" strokeWidth="1.5" strokeOpacity={mk(x / W * 100)} strokeLinejoin="round" />
            ))}

            {/* ── LEFT DEMARCATION BAR ── */}
            <rect x="30" y="3" width="2" height={H - 6} fill="white" fillOpacity={mk(5)} />

            {/* ── LEFT DISPLACED THRESHOLD ARROWS (centerline arrows) ── */}
            {[38, 46].map(x => (
              <g key={x} opacity={mk(x / W * 100)}>
                <line x1={x} y1={H / 2} x2={x + 5} y2={H / 2} stroke="white" strokeWidth="1" />
                <polyline points={`${x + 3},${H / 2 - 3} ${x + 6},${H / 2} ${x + 3},${H / 2 + 3}`}
                  fill="none" stroke="white" strokeWidth="0.8" />
              </g>
            ))}

            {/* ── LEFT THRESHOLD BARS (piano keys — 8 vertical stripes) ── */}
            {Array.from({ length: 8 }).map((_, i) => {
              const y = 4 + i * ((H - 8) / 8)
              return <rect key={i} x="56" y={y} width="14" height={(H - 8) / 8 - 1} fill="white" fillOpacity={mk(9)} />
            })}

            {/* ── LEFT DESIGNATION "25R" ── */}
            <text x="80" y={H / 2} textAnchor="middle" dominantBaseline="central"
              fill="white" fillOpacity={mk(13)} fontSize="10" fontWeight="900"
              fontFamily="var(--font-mono), monospace" transform={`rotate(90, 80, ${H / 2})`}
            >25R</text>

            {/* ── LEFT TDZ: distance markings 500, 1000, 1500, 2000, 2500, 3000 ── */}
            {[
              { x: 100, pairs: 1 },  // 500ft — 1 stripe each side
              { x: 120, pairs: 2 },  // 1000ft
              { x: 140, pairs: 3 },  // 1500ft
              { x: 158, pairs: 2 },  // 2000ft
              { x: 175, pairs: 1 },  // 2500ft
              { x: 190, pairs: 1 },  // 3000ft
            ].map(({ x, pairs }, gi) => (
              <g key={gi} opacity={mk(x / W * 100)}>
                {Array.from({ length: pairs }).map((_, si) => {
                  const yTop = 5 + si * 3.5
                  const yBot = H - 5 - si * 3.5 - 2
                  return (
                    <g key={si}>
                      <rect x={x} y={yTop} width="8" height="2" fill="white" />
                      <rect x={x} y={yBot} width="8" height="2" fill="white" />
                    </g>
                  )
                })}
              </g>
            ))}

            {/* ── LEFT AIMING POINT (2 thick rectangular bars) ── */}
            <rect x="208" y="5" width="20" height="4" rx="0.5" fill="white" fillOpacity={mk(35)} />
            <rect x="208" y={H - 9} width="20" height="4" rx="0.5" fill="white" fillOpacity={mk(35)} />

            {/* ── CENTERLINE DASHES ── */}
            {Array.from({ length: 18 }).map((_, i) => {
              const x = 240 + i * ((320 - 240 + 40) / 18)
              return <rect key={i} x={x} y={H / 2 - 0.75} width="5" height="1.5" rx="0.5"
                fill="white" fillOpacity={mk(x / W * 100)} />
            })}

            {/* ── RIGHT AIMING POINT ── */}
            <rect x={W - 228} y="5" width="20" height="4" rx="0.5" fill="white" fillOpacity={mk(62)} />
            <rect x={W - 228} y={H - 9} width="20" height="4" rx="0.5" fill="white" fillOpacity={mk(62)} />

            {/* ── RIGHT TDZ (mirrored) ── */}
            {[
              { x: W - 110, pairs: 1 },
              { x: W - 130, pairs: 2 },
              { x: W - 150, pairs: 3 },
              { x: W - 168, pairs: 2 },
              { x: W - 185, pairs: 1 },
              { x: W - 200, pairs: 1 },
            ].map(({ x, pairs }, gi) => (
              <g key={gi} opacity={mk(x / W * 100)}>
                {Array.from({ length: pairs }).map((_, si) => {
                  const yTop = 5 + si * 3.5
                  const yBot = H - 5 - si * 3.5 - 2
                  return (
                    <g key={si}>
                      <rect x={x} y={yTop} width="8" height="2" fill="white" />
                      <rect x={x} y={yBot} width="8" height="2" fill="white" />
                    </g>
                  )
                })}
              </g>
            ))}

            {/* ── RIGHT DESIGNATION "07L" ── */}
            <text x={W - 80} y={H / 2} textAnchor="middle" dominantBaseline="central"
              fill="white" fillOpacity={mk(87)} fontSize="10" fontWeight="900"
              fontFamily="var(--font-mono), monospace" transform={`rotate(-90, ${W - 80}, ${H / 2})`}
            >07L</text>

            {/* ── RIGHT THRESHOLD BARS ── */}
            {Array.from({ length: 8 }).map((_, i) => {
              const y = 4 + i * ((H - 8) / 8)
              return <rect key={i} x={W - 70} y={y} width="14" height={(H - 8) / 8 - 1} fill="white" fillOpacity={mk(92)} />
            })}

            {/* ── RIGHT DEMARCATION BAR ── */}
            <rect x={W - 32} y="3" width="2" height={H - 6} fill="white" fillOpacity={mk(95)} />

            {/* ── RIGHT CHEVRONS ── */}
            {[W - 22, W - 14, W - 6].map(x => (
              <polyline key={x} points={`${x + 8},${H / 2 + 10} ${x},${H / 2} ${x + 8},${H / 2 - 10}`}
                fill="none" stroke="#d4a017" strokeWidth="1.5" strokeOpacity={mk(x / W * 100)} strokeLinejoin="round" />
            ))}
          </svg>

          {/* ── YELLOW EDGE LIGHTS ── */}
          {['top', 'bottom'].map(edge => (
            <div key={edge} className="absolute left-0 right-0 flex justify-between px-[2px]"
              style={{ [edge]: 2 }}>
              {Array.from({ length: lightCount }).map((_, i) => (
                <div key={i} className="rounded-full shrink-0" style={{
                  width: 4, height: 4,
                  animation: 'grp-light-chase 3s ease-in-out infinite',
                  animationDelay: `${(i / lightCount) * 3}s`,
                }} />
              ))}
            </div>
          ))}

          {/* ── CENTERLINE LIGHTS (green → yellow → red) ── */}
          <div className="absolute top-1/2 -translate-y-1/2 left-[10%] right-[10%] flex justify-between">
            {Array.from({ length: 14 }).map((_, i) => {
              const ratio = i / 13
              return (
                <div key={i} className="rounded-full shrink-0" style={{
                  width: 3, height: 3,
                  animation: `grp-cl-${ratio < 0.6 ? 'g' : ratio < 0.8 ? 'y' : 'r'} 1.8s ease-in-out infinite`,
                  animationDelay: `${(i / 14) * 1.8}s`,
                }} />
              )
            })}
          </div>
        </div>

        {/* ── Aircraft — simple, no animations ── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Airbus.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute z-10"
          style={{
            width: 80,
            height: 80,
            top: '50%',
            left: `calc(${p}% + 4px)`,
            transform: 'translateY(-50%)',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      {/* Label + percent */}
      <div className="flex items-center justify-between text-[13px] mt-2">
        <span className="text-hz-text-secondary">{label}</span>
        <span className="font-semibold text-hz-accent tabular-nums">{Math.round(p)}%</span>
      </div>

      <style jsx>{`
        @keyframes grp-fade-in {
          0% { opacity: 0; backdrop-filter: blur(0px); }
          100% { opacity: 1; backdrop-filter: blur(12px) saturate(1.2); }
        }
        @keyframes grp-logo-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
        @keyframes grp-puff {
          0% { opacity: 0.5; transform: translateY(-50%) scale(1); }
          100% { opacity: 0; transform: translateY(-50%) scale(2.5); }
        }
        @keyframes grp-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes grp-cl-g {
          0%, 100% { background-color: rgba(80,210,70,0.08); box-shadow: none; }
          50% { background-color: rgba(80,210,70,0.95); box-shadow: 0 0 6px rgba(80,210,70,0.7); }
        }
        @keyframes grp-cl-y {
          0%, 100% { background-color: rgba(255,200,50,0.08); box-shadow: none; }
          50% { background-color: rgba(255,200,50,0.95); box-shadow: 0 0 6px rgba(255,200,50,0.7); }
        }
        @keyframes grp-cl-r {
          0%, 100% { background-color: rgba(240,50,50,0.08); box-shadow: none; }
          50% { background-color: rgba(240,50,50,0.95); box-shadow: 0 0 6px rgba(240,50,50,0.7); }
        }
        @keyframes grp-light-chase {
          0%, 100% { background-color: rgba(255,200,50,0.06); box-shadow: none; }
          50% { background-color: rgba(255,210,60,1); box-shadow: 0 0 8px rgba(255,210,60,0.9), 0 0 3px rgba(255,210,60,1), 0 0 16px rgba(255,200,50,0.3); }
        }
      `}</style>
    </div>
  )
}

// ─── Provider + Overlay ─────────────────────────────────────────────────────

export function GlobalRunwayProgress({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>({ active: false, percent: 0, label: '' })
  const [phase, setPhase] = useState<'idle' | 'loading' | 'dismissing'>('idle')
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const autoAdvanceRef = useRef<number>(0)
  const startTimeRef = useRef(0)
  const estDurationRef = useRef(0)

  const stopAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) cancelAnimationFrame(autoAdvanceRef.current)
    autoAdvanceRef.current = 0
  }, [])

  const update = useCallback((percent: number, lbl?: string) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    stopAutoAdvance()
    setPhase('loading')
    setState(prev => ({
      active: true,
      percent: Math.max(0, Math.min(100, percent)),
      label: lbl ?? prev.label,
    }))
  }, [stopAutoAdvance])

  const start = useCallback((estimatedMs = 4000, lbl?: string) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    stopAutoAdvance()
    startTimeRef.current = performance.now()
    estDurationRef.current = estimatedMs
    setPhase('loading')
    setState({ active: true, percent: 0, label: lbl ?? 'Loading...' })

    const advance = (now: number) => {
      const elapsed = now - startTimeRef.current
      const t = Math.min(elapsed / estDurationRef.current, 1)
      const eased = 1 - Math.pow(1 - t, 2.5)
      const percent = eased * 90
      setState(prev => prev.active ? { ...prev, percent } : prev)
      if (t < 1) autoAdvanceRef.current = requestAnimationFrame(advance)
    }
    autoAdvanceRef.current = requestAnimationFrame(advance)
  }, [stopAutoAdvance])

  const label = useCallback((newLabel: string) => {
    setState(prev => prev.active ? { ...prev, label: newLabel } : prev)
  }, [])

  const done = useCallback((doneLabel?: string) => {
    stopAutoAdvance()
    setState(prev => ({ ...prev, percent: 100, label: doneLabel ?? 'Complete' }))
    // Brief pause at 100% to show completion, then start dismiss animation
    dismissTimer.current = setTimeout(() => {
      setPhase('dismissing')
      // Total: 1300ms slide
      dismissTimer.current = setTimeout(() => {
        setPhase('idle')
        setState({ active: false, percent: 0, label: '' })
      }, 1400)
    }, 600)
  }, [stopAutoAdvance])

  const reset = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    stopAutoAdvance()
    setPhase('idle')
    setState({ active: false, percent: 0, label: '' })
  }, [stopAutoAdvance])

  const apiRef = useRef<ProgressAPI>({ update, start, label, done, reset })
  apiRef.current = { update, start, label, done, reset }

  // Stable API object — never changes identity, delegates to latest callbacks via ref
  const [stableApi] = useState<ProgressAPI>(() => ({
    update: (...args) => apiRef.current.update(...args),
    start: (...args) => apiRef.current.start(...args),
    label: (...args) => apiRef.current.label(...args),
    done: (...args) => apiRef.current.done(...args),
    reset: () => apiRef.current.reset(),
  }))

  const showOverlay = phase === 'loading' || phase === 'dismissing'

  return (
    <ProgressContext.Provider value={stableApi}>
      {children}
      {/* ── Loading overlay: solid semi-opaque (no backdrop-filter — avoids GPU blur on complex grids) ── */}
      {phase === 'loading' && (
        <div
          className="fixed inset-0 z-[99998] bg-[rgba(240,242,245,0.92)] dark:bg-[rgba(14,14,20,0.92)]"
          style={{ animation: 'grp-fade-in 0.3s ease-out' }}
        />
      )}

      {/* ── Dismissing: 2 horizontal panels (no backdrop-filter, just solid + will-change for GPU) ── */}
      {phase === 'dismissing' && (
        <>
          {/* Left half — soft feathered edge */}
          <div className="fixed top-0 left-0 h-full z-[99998] bg-[#f0f2f5] dark:bg-[#111118]" style={{
            width: 'calc(50% + 40px)',
            maskImage: 'linear-gradient(to right, black calc(100% - 80px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 80px), transparent 100%)',
            willChange: 'transform',
            animation: 'grp-slide-left 1300ms cubic-bezier(0.05, 0, 0.7, 1) forwards',
          }} />
          {/* Right half — soft feathered edge */}
          <div className="fixed top-0 right-0 h-full z-[99998] bg-[#f0f2f5] dark:bg-[#111118]" style={{
            width: 'calc(50% + 40px)',
            maskImage: 'linear-gradient(to left, black calc(100% - 80px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, black calc(100% - 80px), transparent 100%)',
            willChange: 'transform',
            animation: 'grp-slide-right 1300ms cubic-bezier(0.05, 0, 0.7, 1) forwards',
          }} />
        </>
      )}

      {/* ── Content layer (logo + runway) ── */}
      {showOverlay && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none"
          style={phase === 'dismissing' ? {
            animation: 'grp-content-fade 800ms cubic-bezier(0.05, 0, 0.7, 1) forwards',
          } : undefined}
        >
          <div className="flex flex-col items-center w-full max-w-2xl overflow-visible">
            {/* SkyHub watermark */}
            <div className="mb-10" style={{ width: 500, animation: phase === 'loading' ? 'grp-logo-breathe 3s ease-in-out infinite' : undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/skyhub-logo.png"
                alt=""
                aria-hidden="true"
                className="dark:hidden w-full h-auto select-none"
                style={{
                  filter: 'grayscale(1) brightness(0) drop-shadow(0 1px 0 rgba(255,255,255,0.8))',
                  opacity: 0.06,
                  mixBlendMode: 'multiply',
                }}
                draggable={false}
              />
              <div
                className="hidden dark:block w-full"
                style={{
                  aspectRatio: '3 / 1.2',
                  background: '#f5f5f5',
                  opacity: 0.1,
                  maskImage: "url('/skyhub-logo.png')",
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskImage: "url('/skyhub-logo.png')",
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                }}
              />
            </div>
            <RunwayBar percent={state.percent} label={state.label} />
          </div>
        </div>
      )}

      {/* Dismiss keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes grp-slide-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        @keyframes grp-slide-right {
          0% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        @keyframes grp-content-fade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes grp-fade-in {
          0% { opacity: 0; backdrop-filter: blur(0px); }
          100% { opacity: 1; backdrop-filter: blur(12px) saturate(1.2); }
        }
        @keyframes grp-logo-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
      `}} />
    </ProgressContext.Provider>
  )
}
