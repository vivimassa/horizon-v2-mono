'use client'

import { Plane, AlertTriangle, Clock, PlaneLanding, Package, Users, DoorOpen } from 'lucide-react'
import type { StationFlight } from './types'
import { STATUS_CONFIG } from './types'

interface FlightHeaderProps {
  flight: StationFlight
  accent: string
  accentDark: string
  isDark: boolean
}

// Mock airport name lookup — in production this comes from master data
const AIRPORT_NAMES: Record<string, string> = {
  SGN: 'Tan Son Nhat Intl Airport',
  HAN: 'Noi Bai Intl Airport',
  DAD: 'Da Nang Intl Airport',
  PQC: 'Phu Quoc Intl Airport',
  CXR: 'Cam Ranh Intl Airport',
  HPH: 'Cat Bi Intl Airport',
  VII: 'Vinh Intl Airport',
  UIH: 'Phu Cat Airport',
  DLI: 'Lien Khuong Airport',
}

export function FlightHeader({ flight, accent, accentDark, isDark }: FlightHeaderProps) {
  const sc = STATUS_CONFIG[flight.status]
  const cargoPct = flight.cargo.capacity > 0 ? Math.round((flight.cargo.loaded / flight.cargo.capacity) * 100) : 0

  const textPrimary = isDark ? '#f5f5f5' : '#111'
  const textMuted = isDark ? '#777' : '#888'
  const pillBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)'
  const pillBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const metrics = [
    { label: 'STD', value: flight.std, icon: Clock, alert: false },
    { label: 'STA', value: flight.sta, icon: PlaneLanding, alert: false },
    { label: 'PAX', value: `${flight.pax.onboard}/${flight.pax.booked}`, icon: Users, alert: false },
    { label: 'CARGO', value: `${cargoPct}%`, icon: Package, alert: false },
    { label: 'GATE', value: flight.gate === '\u2014' ? '\u2014' : flight.gate, icon: DoorOpen, alert: false },
    { label: 'DOOR', value: flight.door || '\u2014', icon: Clock, alert: false },
  ]

  return (
    <div
      className="relative overflow-hidden group"
      style={{
        padding: '14px 20px 10px',
        borderRadius: '14px 14px 0 0',
        background: `linear-gradient(135deg, ${accent}22 0%, ${accent}12 100%)`,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${accent}20`,
      }}
    >
      {/* ── Watermark: flight ID ghost text ── */}
      <div
        className="absolute pointer-events-none select-none transition-opacity duration-300"
        style={{
          bottom: -8,
          right: 16,
          zIndex: 0,
          opacity: isDark ? 0.06 : 0.04,
        }}
      >
        <span
          style={{
            fontSize: 80,
            fontFamily: "'SF Mono','Roboto Mono',ui-monospace,monospace",
            fontWeight: 900,
            letterSpacing: -3,
            color: textPrimary,
          }}
        >
          {flight.id}
        </span>
      </div>

      {/* ── Row 1: Flight identity + status ── */}
      <div className="relative flex items-start justify-between mb-3" style={{ zIndex: 1 }}>
        <div>
          <div className="flex items-center gap-2">
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: -0.5,
                color: accentDark,
                fontFamily: "'SF Mono','Roboto Mono',ui-monospace,monospace",
              }}
            >
              {flight.id}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: textMuted, fontFamily: 'monospace' }}>
              {flight.reg} &middot; {flight.type}
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1"
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 20,
            background: isDark ? `${sc.dot}18` : sc.bg,
            color: isDark ? sc.dot : sc.text,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: sc.dot }} />
          {sc.label}
        </span>
      </div>

      {/* ── Row 2: Giant airport codes + route line ── */}
      <div className="relative flex items-center justify-between w-full mb-3" style={{ zIndex: 1 }}>
        {/* Departure */}
        <div className="flex flex-col items-start">
          <div className="flex items-baseline gap-1.5">
            <span
              style={{
                fontSize: 36,
                fontFamily: "'SF Mono','Roboto Mono',ui-monospace,monospace",
                fontWeight: 600,
                letterSpacing: -2,
                color: textPrimary,
                lineHeight: 1,
              }}
            >
              {flight.dep}
            </span>
            <span
              style={{
                fontSize: 13,
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
                fontFamily: 'monospace',
              }}
            >
              UTC+7
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              color: textMuted,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginTop: 2,
            }}
          >
            {AIRPORT_NAMES[flight.dep] || flight.dep}
          </span>
        </div>

        {/* Route line + plane circle */}
        <div className="flex-1 relative flex items-center justify-center" style={{ margin: '0 16px' }}>
          <div className="relative w-full flex items-center" style={{ height: 32 }}>
            <div
              className="absolute inset-x-0"
              style={{
                top: '50%',
                height: 1.5,
                borderTop: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              }}
            />
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <Plane
                size={18}
                strokeWidth={0}
                style={{
                  transform: 'rotate(45deg)',
                  color: isDark ? '#999' : '#666',
                  fill: isDark ? '#999' : '#666',
                }}
              />
            </div>
          </div>
        </div>

        {/* Arrival */}
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-1.5">
            <span
              style={{
                fontSize: 13,
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
                fontFamily: 'monospace',
              }}
            >
              UTC+7
            </span>
            <span
              style={{
                fontSize: 36,
                fontFamily: "'SF Mono','Roboto Mono',ui-monospace,monospace",
                fontWeight: 600,
                letterSpacing: -2,
                color: textPrimary,
                lineHeight: 1,
              }}
            >
              {flight.arr}
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              color: textMuted,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginTop: 2,
            }}
          >
            {AIRPORT_NAMES[flight.arr] || flight.arr}
          </span>
        </div>
      </div>

      {/* ── Row 3: Metrics ribbon (stat pills with icons) ── */}
      <div className="relative flex gap-1.5" style={{ zIndex: 1 }}>
        {metrics.map((m) => {
          const Icon = m.icon
          const isDelay = m.alert
          return (
            <div
              key={m.label}
              className="flex-1 flex items-center gap-2 transition-colors duration-150"
              style={{
                padding: '6px 8px',
                borderRadius: 14,
                background: isDelay ? (isDark ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.06)') : pillBg,
                border: `1px solid ${isDelay ? 'rgba(220,38,38,0.15)' : pillBorder}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isDelay ? 'rgba(220,38,38,0.12)' : `${accent}15`,
                }}
              >
                <Icon size={14} strokeWidth={2} style={{ color: isDelay ? '#dc2626' : accent }} />
              </div>
              <div className="flex flex-col">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: -0.3,
                    lineHeight: 1,
                    color: isDelay ? '#dc2626' : textMuted,
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontFamily: "'SF Mono','Roboto Mono',ui-monospace,monospace",
                    fontWeight: 700,
                    lineHeight: 1,
                    marginTop: 3,
                    color: isDelay ? '#dc2626' : textPrimary,
                  }}
                >
                  {m.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Delay banner ── */}
      {flight.delays.length > 0 && (
        <div
          className="relative flex items-center gap-1.5"
          style={{
            zIndex: 1,
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 8,
            background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.12)',
            fontSize: 13,
            color: '#dc2626',
          }}
        >
          <AlertTriangle size={14} strokeWidth={2} />
          Delay Code {flight.delays[0].code} &middot; {flight.delays[0].reason} (+{flight.delays[0].mins}m)
        </div>
      )}
    </div>
  )
}
