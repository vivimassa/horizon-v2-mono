'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { CrossFamilyConflict } from '@/lib/crew-coverage/validate-cross-family'

interface Props {
  conflict: CrossFamilyConflict
  onClose: () => void
}

/**
 * Blocking dialog shown when a planner attempts to save a pairing whose legs
 * span different aircraft families. Crew type ratings don't overlap across
 * families, so the pairing is legally impossible to crew.
 */
export function CrossFamilyPairingDialog({ conflict, onClose }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'

  const subtitle = `Cross-family pairing not allowed. Flight ${conflict.flightA.flightNumber} (${conflict.flightA.aircraftTypeIcao}) and Flight ${conflict.flightB.flightNumber} (${conflict.flightB.aircraftTypeIcao}) require separate type ratings.`

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{ background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.55)' : '0 24px 60px rgba(15,23,42,0.20)',
        }}
      >
        <div
          className="flex items-start gap-3 px-5 py-4"
          style={{
            background: 'rgba(255,59,59,0.10)',
            borderBottom: `1px solid rgba(255,59,59,0.20)`,
          }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
            style={{ background: 'rgba(255,59,59,0.20)' }}
          >
            <AlertTriangle size={18} strokeWidth={2.2} style={{ color: '#FF3B3B' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold" style={{ color: textPrimary }}>
              Invalid Pairing
            </h3>
            <p className="text-[13px] mt-0.5" style={{ color: textSecondary }}>
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: textMuted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold"
            style={{
              background: '#FF3B3B',
              color: '#ffffff',
              border: `1px solid #FF3B3B`,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
