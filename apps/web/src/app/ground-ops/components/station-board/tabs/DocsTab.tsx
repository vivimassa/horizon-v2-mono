'use client'

import { Download, FileText, FileBarChart, AlertTriangle, Users, Package, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DOC_STATUS_CONFIG } from '../types'
import { DOCUMENTS } from '../data/mock-data'

interface DocsTabProps {
  accent: string
  isDark: boolean
  glass: { panel: string; panelBorder: string }
}

const DOC_ICONS: Record<string, LucideIcon> = {
  FileBarChart,
  FileText,
  AlertTriangle,
  Users,
  Package,
  ShieldCheck,
}

export function DocsTab({ accent, isDark, glass }: DocsTabProps) {
  return (
    <div className="flex flex-col gap-1.5" style={{ padding: 16 }}>
      {DOCUMENTS.map((d) => {
        const ds = DOC_STATUS_CONFIG[d.status]
        const Icon = DOC_ICONS[d.iconName] || FileText
        return (
          <div
            key={d.key}
            className="flex items-center gap-2.5 cursor-pointer transition-all duration-150"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: glass.panel,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${glass.panelBorder}`,
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <Icon size={15} strokeWidth={1.8} style={{ color: isDark ? '#aaa' : '#555' }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f5f5f5' : '#111' }}>{d.label}</div>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 8,
                background: isDark ? `${ds.text}18` : ds.bg,
                color: ds.text,
              }}
            >
              {ds.label}
            </span>
          </div>
        )
      })}
      <button
        className="flex items-center justify-center gap-1.5 cursor-pointer"
        style={{
          marginTop: 6,
          padding: '10px 0',
          borderRadius: 10,
          border: 'none',
          background: accent,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: `0 2px 8px ${accent}4d`,
        }}
      >
        <Download size={13} strokeWidth={2} />
        Download All as ZIP
      </button>
    </div>
  )
}
