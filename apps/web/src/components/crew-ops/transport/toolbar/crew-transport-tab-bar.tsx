'use client'

import { Sparkles, CalendarDays, Mail, Inbox, BookCheck, History, type LucideIcon } from 'lucide-react'
import { useCrewTransportStore, type GroundTab, type FlightTab } from '@/stores/use-crew-transport-store'

interface TabSpec<K extends string> {
  key: K
  label: string
  hint: string
  icon: LucideIcon
}

const GROUND_TABS: TabSpec<GroundTab>[] = [
  { key: 'planning', label: 'Planning', hint: 'Trip projection', icon: Sparkles },
  { key: 'dayToDay', label: 'Day to Day', hint: '1–7 day operations', icon: CalendarDays },
  { key: 'communication', label: 'Communication', hint: 'Vendor dispatch emails', icon: Mail },
]

const FLIGHT_TABS: TabSpec<FlightTab>[] = [
  { key: 'open', label: 'Open', hint: 'Deadhead legs without a booking', icon: Inbox },
  { key: 'booked', label: 'Booked', hint: 'Active flight bookings', icon: BookCheck },
  { key: 'history', label: 'History', hint: 'Cancelled or completed', icon: History },
]

export function CrewTransportTabBar() {
  const segment = useCrewTransportStore((s) => s.segment)
  const groundTab = useCrewTransportStore((s) => s.groundTab)
  const flightTab = useCrewTransportStore((s) => s.flightTab)
  const setGroundTab = useCrewTransportStore((s) => s.setGroundTab)
  const setFlightTab = useCrewTransportStore((s) => s.setFlightTab)

  const tabs = segment === 'ground' ? GROUND_TABS : FLIGHT_TABS
  const active = segment === 'ground' ? groundTab : flightTab
  const setActive = (k: string) => {
    if (segment === 'ground') setGroundTab(k as GroundTab)
    else setFlightTab(k as FlightTab)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-hz-border">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.key
        return (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActive(tab.key)}
            title={tab.hint}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              isActive ? 'bg-module-accent/12 text-module-accent' : 'text-hz-text-secondary hover:bg-hz-border/30'
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
