'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, Activity, Wrench } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { api } from '@skyhub/api'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'

export function PlanningContextMenu() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const contextMenu = useMaintenancePlanningStore((s) => s.contextMenu)
  const setContextMenu = useMaintenancePlanningStore((s) => s.setContextMenu)
  const openForm = useMaintenancePlanningStore((s) => s.openForm)
  const openForecastPopover = useMaintenancePlanningStore((s) => s.openForecastPopover)
  const commitPeriod = useMaintenancePlanningStore((s) => s.commitPeriod)

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setContextMenu(null)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [contextMenu, setContextMenu])

  if (!contextMenu) return null

  const bg = isDark ? '#1C1C28' : '#FFFFFF'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const text = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const x = Math.min(contextMenu.x, window.innerWidth - 240)
  const y = Math.min(contextMenu.y, window.innerHeight - 200)

  const ev = contextMenu.event

  const handleCreate = () => {
    openForm({
      mode: 'create',
      aircraftId: contextMenu.aircraftId,
      registration: contextMenu.registration,
      date: contextMenu.date,
    })
    setContextMenu(null)
  }

  const handleEdit = () => {
    if (!ev) return
    openForm({ mode: 'edit', aircraftId: contextMenu.aircraftId, registration: contextMenu.registration, event: ev })
    setContextMenu(null)
  }

  const handleDelete = async () => {
    if (!ev) return
    await api.deleteMaintenanceEvent(ev.id)
    setContextMenu(null)
    await commitPeriod()
  }

  const handleForecastAnalysis = () => {
    if (!ev) return
    openForecastPopover(ev, contextMenu.x, contextMenu.y)
    setContextMenu(null)
  }

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-xl min-w-[220px] overflow-hidden"
      style={{
        top: y,
        left: x,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(96,97,112,0.16)',
      }}
    >
      {/* Header */}
      {contextMenu.type === 'event' && ev && (
        <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="text-[13px] font-semibold" style={{ color: text }}>
            {contextMenu.registration} · {ev.checkName}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: muted }}>
            {ev.status === 'proposed' ? 'Auto-proposed by forecast engine' : `${ev.status} · ${ev.source}`}
          </div>
        </div>
      )}
      {contextMenu.type === 'aircraft' && (
        <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="text-[13px] font-semibold" style={{ color: text }}>
            {contextMenu.registration}
          </div>
        </div>
      )}

      {/* Menu items */}
      <div className="py-1">
        {contextMenu.type === 'aircraft' && (
          <MenuItem
            icon={<Plus size={14} />}
            label="Create Maintenance Event"
            onClick={handleCreate}
            text={text}
            hoverBg={hoverBg}
          />
        )}

        {contextMenu.type === 'event' && ev && (
          <>
            <MenuItem
              icon={<Pencil size={14} />}
              label="Edit Event"
              onClick={handleEdit}
              text={text}
              hoverBg={hoverBg}
            />
            <MenuItem
              icon={<Trash2 size={14} />}
              label="Remove Event"
              onClick={handleDelete}
              text={text}
              hoverBg={hoverBg}
              danger
            />
            <div className="my-1" style={{ borderTop: `1px solid ${divider}` }} />
            <MenuItem
              icon={<Activity size={14} />}
              label="Forecast Analysis"
              onClick={handleForecastAnalysis}
              text={text}
              hoverBg={hoverBg}
              accent
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  text,
  hoverBg,
  danger,
  accent,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  text: string
  hoverBg: string
  danger?: boolean
  accent?: boolean
}) {
  const color = danger ? '#FF3B3B' : accent ? 'var(--module-accent, #1e40af)' : text
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium transition-colors text-left"
      style={{ color }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = ''
      }}
    >
      {icon}
      {label}
    </button>
  )
}
