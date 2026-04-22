'use client'

import { XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { AssignmentViolation } from '@/lib/crew-schedule/violations'

/**
 * Modal shown when an assignment hits one or more hard-block violations
 * (e.g. crew not qualified on the pairing's aircraft type). Single OK
 * button — there is no override path. No API call fires.
 */
interface Props {
  violations: AssignmentViolation[]
  onClose: () => void
}

export function AssignmentBlockedDialog({ violations, onClose }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Focus the CTA so Enter / Space dismiss without mouse travel.
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden w-full max-w-md shadow-xl"
        style={{
          background: isDark ? '#191921' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 pt-5 pb-4 flex gap-3 items-start"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(230,53,53,0.15)' }}
          >
            <XCircle size={20} color="#E63535" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold tracking-wide uppercase" style={{ color: '#E63535' }}>
              Illegal assignment
            </div>
            <div className="text-[15px] font-semibold mt-0.5" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
              {violations.length === 1 ? violations[0].title : `${violations.length} violations`}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {violations.map((v) => (
            <div
              key={v.kind}
              className="p-3 rounded-lg"
              style={{
                background: isDark ? 'rgba(230,53,53,0.08)' : 'rgba(230,53,53,0.06)',
                border: `1px solid ${isDark ? 'rgba(230,53,53,0.22)' : 'rgba(230,53,53,0.26)'}`,
              }}
            >
              {violations.length > 1 && (
                <div className="text-[13px] font-semibold mb-1" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
                  {v.title}
                </div>
              )}
              <div className="text-[13px] leading-relaxed" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
                {v.message}
              </div>
            </div>
          ))}
          <div className="text-[13px] leading-relaxed pt-1" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
            This cannot be overridden. Update the crew member's qualifications or pick a different crew.
          </div>
        </div>

        <div
          className="px-5 py-4 flex justify-end"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <button
            ref={okRef}
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
            style={{ background: '#E63535' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
