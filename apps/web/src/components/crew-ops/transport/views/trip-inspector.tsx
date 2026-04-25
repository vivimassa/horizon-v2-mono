'use client'

import { useMemo, useState } from 'react'
import { X, Truck, LogIn, CheckSquare, Send, AlertTriangle } from 'lucide-react'
import { api } from '@skyhub/api'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { StatusChip, fmtMoney, fmtTime, tripTypeLabel } from '../status-meta'
import type { TransportTrip } from '../types'

type InspectorTab = 'overview' | 'pax' | 'cost' | 'audit'

const TAB_LABELS: Record<InspectorTab, string> = {
  overview: 'Overview',
  pax: 'Pax',
  cost: 'Cost',
  audit: 'Audit',
}

export function TripInspector() {
  const trips = useCrewTransportStore((s) => s.trips)
  const selectedId = useCrewTransportStore((s) => s.selectedTripId)
  const setSelectedId = useCrewTransportStore((s) => s.setSelectedTripId)
  const upsertTrip = useCrewTransportStore((s) => s.upsertTrip)
  const [tab, setTab] = useState<InspectorTab>('overview')

  const trip = useMemo(() => trips.find((t) => t.id === selectedId) ?? null, [trips, selectedId])

  if (!trip) return null

  const handleAction = async (action: 'dispatch' | 'pickup' | 'complete' | 'noShow') => {
    try {
      let updated
      if (action === 'dispatch') {
        // Quick dispatch — uses driver/plate already on the trip; users can
        // override via the Detail tab edit form (Phase later).
        updated = await api.dispatchCrewTransportTrip(trip.id, {
          driverName: trip.driverName ?? undefined,
          driverPhone: trip.driverPhone ?? undefined,
          vehiclePlate: trip.vehiclePlate ?? undefined,
        })
      } else if (action === 'pickup') updated = await api.pickupCrewTransportTrip(trip.id)
      else if (action === 'complete') updated = await api.completeCrewTransportTrip(trip.id)
      else updated = await api.noShowCrewTransportTrip(trip.id)

      // Optimistic local update — fall back to refetch via polling if shape differs.
      upsertTrip({
        ...trip,
        status: updated.status,
        dispatchedAtUtcMs: updated.dispatchedAtUtcMs,
        pickedUpAtUtcMs: updated.pickedUpAtUtcMs,
        completedAtUtcMs: updated.completedAtUtcMs,
        driverName: updated.driverName,
        driverPhone: updated.driverPhone,
        vehiclePlate: updated.vehiclePlate,
      })
    } catch (err) {
      console.warn(`[transport] action ${action} failed`, err)
    }
  }

  return (
    <aside className="w-[360px] shrink-0 ml-3 flex flex-col rounded-2xl overflow-hidden bg-hz-card border border-hz-border">
      <header className="px-4 py-3 border-b border-hz-border flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-module-accent" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-hz-text truncate">
            {trip.pairingCode || tripTypeLabel(trip.tripType)}
          </div>
          <div className="text-[13px] text-hz-text-secondary">
            {tripTypeLabel(trip.tripType)} · {trip.airportIcao}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-hz-border/30 text-hz-text-secondary"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <nav className="px-2 py-2 border-b border-hz-border flex gap-1">
        {(Object.keys(TAB_LABELS) as InspectorTab[]).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
              tab === k ? 'bg-module-accent/12 text-module-accent' : 'text-hz-text-secondary hover:bg-hz-border/30'
            }`}
          >
            {TAB_LABELS[k]}
          </button>
        ))}
      </nav>

      <section className="flex-1 overflow-y-auto px-4 py-3 text-[13px]">
        {tab === 'overview' && <OverviewTab trip={trip} />}
        {tab === 'pax' && <PaxTab trip={trip} />}
        {tab === 'cost' && <CostTab trip={trip} />}
        {tab === 'audit' && <AuditTab trip={trip} />}
      </section>

      <footer className="border-t border-hz-border px-3 py-3 flex flex-wrap gap-2">
        <ActionBtn
          icon={Send}
          label="Dispatch"
          onClick={() => handleAction('dispatch')}
          disabled={trip.status === 'dispatched' || trip.status === 'crew-pickedup' || trip.status === 'completed'}
        />
        <ActionBtn
          icon={LogIn}
          label="Picked up"
          onClick={() => handleAction('pickup')}
          disabled={trip.status === 'crew-pickedup' || trip.status === 'completed'}
        />
        <ActionBtn
          icon={CheckSquare}
          label="Done"
          onClick={() => handleAction('complete')}
          disabled={trip.status === 'completed'}
        />
        <ActionBtn
          icon={Truck}
          label="No-show"
          tone="danger"
          onClick={() => handleAction('noShow')}
          disabled={trip.status === 'completed' || trip.status === 'no-show'}
        />
      </footer>
    </aside>
  )
}

function OverviewTab({ trip }: { trip: TransportTrip }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[13px] uppercase tracking-wider text-hz-text-tertiary mb-1">Status</div>
        <StatusChip status={trip.status} />
      </div>
      <Field label="Scheduled">
        {fmtTime(trip.scheduledTimeUtcMs)} · {new Date(trip.scheduledTimeUtcMs).toISOString().slice(0, 10)}
      </Field>
      <Field label="From">
        {trip.fromLabel}
        {trip.fromAddress ? ` · ${trip.fromAddress}` : ''}
      </Field>
      <Field label="To">
        {trip.toLabel}
        {trip.toAddress ? ` · ${trip.toAddress}` : ''}
      </Field>
      {trip.legFlightNumber && <Field label="Flight">{trip.legFlightNumber}</Field>}
      <Field label="Vendor">
        {trip.vendor?.name ?? <span className="text-hz-text-tertiary">— no vendor matched —</span>}
      </Field>
      {trip.vendor?.vehicleTierName && (
        <Field label="Vehicle">
          {trip.vendor.vehicleTierName} · {trip.vendor.paxCapacity ?? '?'} pax
        </Field>
      )}
      {trip.driverName && (
        <Field label="Driver">
          {trip.driverName}
          {trip.driverPhone ? ` · ${trip.driverPhone}` : ''}
        </Field>
      )}
      {trip.vehiclePlate && <Field label="Plate">{trip.vehiclePlate}</Field>}
      {trip.confirmationNumber && <Field label="Confirmation #">{trip.confirmationNumber}</Field>}
      {trip.notes && <Field label="Notes">{trip.notes}</Field>}
      {trip.disruptionFlags.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#FF8800]/10 text-[#FF8800]">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{trip.disruptionFlags.join(', ')}</span>
        </div>
      )}
    </div>
  )
}

function PaxTab({ trip }: { trip: TransportTrip }) {
  if (trip.paxStops.length === 0) {
    return <div className="text-hz-text-secondary">No crew on this trip.</div>
  }
  return (
    <ol className="space-y-2 list-decimal list-inside">
      {trip.paxStops.map((p) => (
        <li key={p.crewId} className="text-hz-text">
          <span className="font-semibold">{p.crewName}</span>
          {p.position && <span className="text-hz-text-secondary"> · {p.position}</span>}
          {p.pickupTimeUtcMs != null && (
            <div className="ml-5 text-hz-text-secondary text-[13px]">
              Pickup {fmtTime(p.pickupTimeUtcMs)}
              {p.pickupAddress ? ` · ${p.pickupAddress}` : ''}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

function CostTab({ trip }: { trip: TransportTrip }) {
  return (
    <div className="space-y-3">
      <Field label="Trip cost">{fmtMoney(trip.cost, trip.costCurrency)}</Field>
      <Field label="Currency">{trip.costCurrency}</Field>
      {trip.vendor && (
        <>
          <Field label="Vendor priority">P{trip.vendor.priority}</Field>
          <Field label="Tier rate">{fmtMoney(trip.vendor.ratePerTrip, trip.vendor.currency)}</Field>
        </>
      )}
    </div>
  )
}

function AuditTab({ trip }: { trip: TransportTrip }) {
  const rows: Array<[string, number | null]> = [
    ['Sent', trip.sentAtUtcMs],
    ['Confirmed', trip.confirmedAtUtcMs],
    ['Dispatched', trip.dispatchedAtUtcMs],
    ['Picked up', trip.pickedUpAtUtcMs],
    ['Completed', trip.completedAtUtcMs],
  ]
  return (
    <div className="space-y-2">
      {rows.map(([label, ms]) => (
        <Field key={label} label={label}>
          {ms != null ? (
            new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + 'Z'
          ) : (
            <span className="text-hz-text-tertiary">—</span>
          )}
        </Field>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] uppercase tracking-wider text-hz-text-tertiary">{label}</div>
      <div className="text-hz-text mt-0.5">{children}</div>
    </div>
  )
}

interface ActionBtnProps {
  icon: typeof Truck
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}

function ActionBtn({ icon: Icon, label, onClick, disabled, tone = 'default' }: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        tone === 'danger'
          ? 'bg-[#FF3B3B]/12 text-[#FF3B3B] hover:bg-[#FF3B3B]/20'
          : 'bg-module-accent/12 text-module-accent hover:bg-module-accent/20'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
