import { Package, Zap, Mail } from 'lucide-react'
import type { CargoItem } from '@/types/cargo'

interface ManifestItemProps {
  item: CargoItem
  accent: string
  isDark: boolean
}

export function ManifestItem({ item, accent, isDark }: ManifestItemProps) {
  const priorityConfig = {
    rush: {
      label: 'Rush',
      bg: '#fef3c7',
      text: '#92400e',
      darkBg: 'rgba(245,158,11,0.15)',
      darkText: '#fbbf24',
      icon: Zap,
    },
    mail: {
      label: 'Mail',
      bg: '#dbeafe',
      text: '#1e40af',
      darkBg: 'rgba(30,64,175,0.15)',
      darkText: '#60a5fa',
      icon: Mail,
    },
    normal: null,
  }

  const priority = item.priority ? priorityConfig[item.priority] : null

  return (
    <div
      className="flex items-center gap-2.5 rounded-lg transition-colors duration-100"
      style={{
        padding: '8px 10px',
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${accent}15` }}
      >
        <Package size={14} strokeWidth={1.8} style={{ color: accent }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: isDark ? '#f5f5f5' : '#1f2937' }}>
            {item.id}
          </span>
          {priority && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
              style={{
                background: isDark ? priority.darkBg : priority.bg,
                color: isDark ? priority.darkText : priority.text,
              }}
            >
              {priority.label}
            </span>
          )}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: isDark ? '#71717a' : '#9ca3af' }}>
          {item.weight} kg &middot; {item.type}
        </div>
      </div>
    </div>
  )
}
