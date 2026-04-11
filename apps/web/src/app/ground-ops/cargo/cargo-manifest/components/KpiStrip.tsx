interface KpiStripProps {
  totalWeight: number
  totalCapacity: number
  cgMac: number
  dockCount: number
  accent: string
}

export function KpiStrip({ totalWeight, totalCapacity, cgMac, dockCount, accent }: KpiStripProps) {
  const utilPct = totalCapacity > 0 ? Math.round((totalWeight / totalCapacity) * 100) : 0

  const items = [
    { label: 'Load', value: `${utilPct}%`, highlight: true },
    { label: 'Weight', value: `${totalWeight.toLocaleString()} kg` },
    { label: 'CG', value: `${cgMac}%` },
    { label: 'Dock', value: String(dockCount) },
  ]

  return (
    <div
      className="mx-3.5 flex items-center gap-4 rounded-full px-4 py-1.5"
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {i > 0 && <div className="w-px h-3 mr-1" style={{ background: 'rgba(0,0,0,0.08)' }} />}
          <span className="text-[13px] font-bold" style={{ color: item.highlight ? accent : '#1f2937' }}>
            {item.value}
          </span>
          <span className="text-[9px] font-semibold uppercase" style={{ color: '#9ca3af', letterSpacing: '0.3px' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
