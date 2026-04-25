'use client'

import { useState } from 'react'
import { CrewHotelsShell } from '@/components/admin/crew-hotels/crew-hotels-shell'
import { CrewTransportVendorsShell } from '@/components/admin/crew-transport-vendors/crew-transport-vendors-shell'

type Mode = 'hotels' | 'vendors'

export default function CrewHotelsPage() {
  const [mode, setMode] = useState<Mode>('hotels')

  return (
    <div className="h-full flex flex-col">
      {/* Segment toggle — keeps both lists in one admin page per user request */}
      <div className="px-5 pt-4 pb-2 shrink-0 flex items-center gap-1">
        <SegmentButton active={mode === 'hotels'} onClick={() => setMode('hotels')}>
          Hotels
        </SegmentButton>
        <SegmentButton active={mode === 'vendors'} onClick={() => setMode('vendors')}>
          Transport Vendors
        </SegmentButton>
      </div>

      <div className="flex-1 min-h-0">{mode === 'hotels' ? <CrewHotelsShell /> : <CrewTransportVendorsShell />}</div>
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-module-accent text-white shadow-[0_1px_3px_rgba(96,97,112,0.10)]'
          : 'text-hz-text-secondary hover:bg-hz-border/30'
      }`}
    >
      {children}
    </button>
  )
}
