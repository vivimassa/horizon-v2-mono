'use client'

import { useState, useCallback, useRef } from 'react'
import type { CrewHotelRef, AirportRef } from '@skyhub/api'
import { MapboxView } from '@/components/shared/mapbox-view'
import { CrewHotelDetailsTab } from './crew-hotel-details-tab'
import { CrewHotelContactsTab } from './crew-hotel-contacts-tab'
import { CrewHotelContractsTab } from './crew-hotel-contracts-tab'
import { CrewHotelShuttleTab } from './crew-hotel-shuttle-tab'
import { CrewHotelTransportVendorsTab } from './crew-hotel-transport-vendors-tab'
import { BedDouble, Info, Phone, FileText, Bus, Truck, Plus, X } from 'lucide-react'
import { DetailScreenHeader, TabBar, Text, type TabBarItem } from '@/components/ui'

const TABS: TabBarItem[] = [
  { key: 'details', label: 'Hotel Details', icon: Info },
  { key: 'contacts', label: 'Contact Details', icon: Phone },
  { key: 'contracts', label: 'Contracts', icon: FileText },
  { key: 'shuttle', label: 'Shuttle Bus Info', icon: Bus },
  { key: 'transport', label: 'Transport Vendors', icon: Truck },
]

type TabKey = 'details' | 'contacts' | 'contracts' | 'shuttle' | 'transport'

interface Props {
  hotel: CrewHotelRef
  airports: AirportRef[]
  onSave?: (id: string, data: Partial<CrewHotelRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<CrewHotelRef>) => Promise<void>
  onRefresh?: () => void
}

export function CrewHotelDetail({ hotel, airports, onSave, onDelete, onCreate, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState<Partial<CrewHotelRef>>({})
  const [errorMsg, setErrorMsg] = useState('')

  // Create flow
  const [showCreate, setShowCreate] = useState(false)
  const [newAirportIcao, setNewAirportIcao] = useState('')
  const [newHotelName, setNewHotelName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const hasCoords = hotel.latitude != null && hotel.longitude != null

  const [mapHeight, setMapHeight] = useState(300)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startH: mapHeight }
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = ev.clientY - dragRef.current.startY
        setMapHeight(Math.max(150, Math.min(700, dragRef.current.startH + delta)))
      }
      const onUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [mapHeight],
  )

  const handleEdit = useCallback(() => {
    setDraft({})
    setEditing(true)
    setConfirmDelete(false)
  }, [])

  const handleCancel = useCallback(() => {
    setDraft({})
    setEditing(false)
  }, [])

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev: Partial<CrewHotelRef>) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(hotel._id, draft)
      setEditing(false)
      setDraft({})
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [onSave, hotel._id, draft])

  const handleDelete = useCallback(async () => {
    if (!onDelete) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onDelete(hotel._id)
    } catch (err: any) {
      setErrorMsg(err.message || 'Delete failed')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }, [onDelete, hotel._id])

  const resetCreate = useCallback(() => {
    setShowCreate(false)
    setNewAirportIcao('')
    setNewHotelName('')
    setCreateError('')
  }, [])

  const handleCreate = useCallback(async () => {
    if (!onCreate) return
    if (!newAirportIcao || !newHotelName) {
      setCreateError('Airport and hotel name are required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await onCreate({
        airportIcao: newAirportIcao.toUpperCase(),
        hotelName: newHotelName.trim(),
        priority: 1,
        isActive: true,
      } as Partial<CrewHotelRef>)
      resetCreate()
    } catch (err: any) {
      setCreateError(err.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }, [onCreate, newAirportIcao, newHotelName, resetCreate])

  const airport = airports.find((a) => a.icaoCode === hotel.airportIcao)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-hz-border shrink-0">
        <DetailScreenHeader
          icon={BedDouble}
          title={hotel.hotelName}
          helpCode="5.4.10"
          helpTitle="Crew Hotels"
          helpSubtitle="Layover hotels per airport — contracts, rates, shuttle bus"
          editing={editing}
          onEdit={onSave ? handleEdit : undefined}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={onDelete ? () => (confirmDelete ? handleDelete() : setConfirmDelete(true)) : undefined}
          saving={saving}
          status={{
            label: hotel.isActive ? 'Active' : 'Inactive',
            tone: hotel.isActive ? 'success' : 'danger',
          }}
          subtitleSlot={
            onCreate ? (
              <button
                onClick={() => {
                  resetCreate()
                  setShowCreate(true)
                }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-module-accent text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            ) : undefined
          }
        />

        {confirmDelete && (
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2">
              <Text variant="caption" as="span" className="!text-red-500 !font-medium">
                Delete this hotel?
              </Text>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-2.5 py-1 rounded-lg text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <Text variant="caption" as="span" className="!text-red-700 dark:!text-red-400">
              {errorMsg}
            </Text>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0 ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Add New Hotel</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">
              Cancel
            </button>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">
                Airport ICAO *
              </label>
              <select
                value={newAirportIcao}
                onChange={(e) => setNewAirportIcao(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg text-hz-text"
              >
                <option value="">Select airport…</option>
                {airports.map((a) => (
                  <option key={a._id} value={a.icaoCode}>
                    {a.icaoCode} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[13px] text-hz-text-secondary uppercase tracking-wider font-medium">
                Hotel Name *
              </label>
              <input
                type="text"
                value={newHotelName}
                onChange={(e) => setNewHotelName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent"
          >
            {creating ? 'Creating…' : 'Add Hotel'}
          </button>
          {createError && <p className="text-[13px] text-red-500">{createError}</p>}
        </div>
      )}

      {hasCoords && (
        <div className="shrink-0 border-b border-hz-border relative" style={{ height: mapHeight }}>
          <MapboxView
            latitude={hotel.latitude!}
            longitude={hotel.longitude!}
            label={hotel.hotelName}
            markerColor="#16a34a"
          />
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-white text-slate-900 shadow-md border border-slate-200 dark:bg-slate-900 dark:text-white dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Airport:</span>
              <span className="font-bold">{airport?.iataCode ?? hotel.airportIcao}</span>
            </span>
            {hotel.distanceFromAirportMinutes != null && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-white text-slate-900 shadow-md border border-slate-200 dark:bg-slate-900 dark:text-white dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Dist:</span>
                <span className="font-bold">{hotel.distanceFromAirportMinutes} min</span>
              </span>
            )}
          </div>
          <div
            onMouseDown={onDragStart}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-10 group flex items-center justify-center"
          >
            <div className="w-10 h-1 rounded-full bg-hz-text-secondary/30 group-hover:bg-hz-text-secondary/60 transition-colors" />
          </div>
        </div>
      )}

      <div className="px-4 shrink-0">
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'details' && (
          <CrewHotelDetailsTab hotel={hotel} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
        {activeTab === 'contacts' && (
          <CrewHotelContactsTab hotel={hotel} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
        {activeTab === 'contracts' && <CrewHotelContractsTab hotel={hotel} onRefresh={onRefresh} />}
        {activeTab === 'shuttle' && <CrewHotelShuttleTab hotel={hotel} onRefresh={onRefresh} />}
        {activeTab === 'transport' && <CrewHotelTransportVendorsTab hotel={hotel} airports={airports} />}
      </div>
    </div>
  )
}
