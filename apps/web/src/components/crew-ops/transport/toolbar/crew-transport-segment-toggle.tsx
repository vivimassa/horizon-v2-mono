'use client'

import { Bus, Plane } from 'lucide-react'
import { useCrewTransportStore, type TransportSegment } from '@/stores/use-crew-transport-store'

export function CrewTransportSegmentToggle() {
  const segment = useCrewTransportStore((s) => s.segment)
  const setSegment = useCrewTransportStore((s) => s.setSegment)

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-hz-border">
      <Tab segment="ground" current={segment} onClick={setSegment} icon={Bus} label="Ground" />
      <Tab segment="flight" current={segment} onClick={setSegment} icon={Plane} label="Flight" />
    </div>
  )
}

interface TabProps {
  segment: TransportSegment
  current: TransportSegment
  onClick: (s: TransportSegment) => void
  icon: typeof Bus
  label: string
}

function Tab({ segment, current, onClick, icon: Icon, label }: TabProps) {
  const active = current === segment
  return (
    <button
      type="button"
      onClick={() => onClick(segment)}
      className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-module-accent text-white shadow-[0_1px_3px_rgba(96,97,112,0.10)]'
          : 'text-hz-text-secondary hover:bg-hz-border/30'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      {label}
    </button>
  )
}
