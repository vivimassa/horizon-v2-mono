'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Armchair, Plane } from 'lucide-react'
import { api, type CabinClassRef, type LopaConfigRef, type AircraftTypeRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { LopaList } from './lopa-list'
import { CabinClassDetail } from './cabin-class-detail'
import { LopaConfigDetail } from './lopa-config-detail'

type ViewMode = 'cabin-classes' | 'lopa-configs'

export function LopaShell() {
  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeRef[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('cabin-classes')
  const [selectedClass, setSelectedClass] = useState<CabinClassRef | null>(null)
  const [selectedConfig, setSelectedConfig] = useState<LopaConfigRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([api.getCabinClasses(), api.getLopaConfigs(), api.getAircraftTypes()])
      .then(([classes, configs, types]) => {
        setCabinClasses(classes)
        setLopaConfigs(configs)
        setAircraftTypes(types)
        // Re-select current items
        setSelectedClass((prev) => {
          if (prev) {
            const found = classes.find((c) => c._id === prev._id)
            if (found) return found
          }
          return classes.length > 0 ? classes[0] : null
        })
        setSelectedConfig((prev) => {
          if (prev) {
            const found = configs.find((c) => c._id === prev._id)
            if (found) return found
          }
          return configs.length > 0 ? configs[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Cabin class handlers ──
  const handleSaveClass = useCallback(
    async (id: string, data: Partial<CabinClassRef>) => {
      await api.updateCabinClass(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDeleteClass = useCallback(
    async (id: string) => {
      await api.deleteCabinClass(id)
      setSelectedClass(null)
      fetchData()
    },
    [fetchData],
  )

  const handleCreateClass = useCallback(
    async (data: Partial<CabinClassRef>) => {
      const created = await api.createCabinClass(data)
      setShowCreate(false)
      fetchData()
      setTimeout(() => setSelectedClass(created), 300)
    },
    [fetchData],
  )

  // ── LOPA config handlers ──
  const handleSaveConfig = useCallback(
    async (id: string, data: Partial<LopaConfigRef>) => {
      await api.updateLopaConfig(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDeleteConfig = useCallback(
    async (id: string) => {
      await api.deleteLopaConfig(id)
      setSelectedConfig(null)
      fetchData()
    },
    [fetchData],
  )

  const handleCreateConfig = useCallback(
    async (data: Partial<LopaConfigRef>) => {
      const created = await api.createLopaConfig(data)
      setShowCreate(false)
      fetchData()
      setTimeout(() => setSelectedConfig(created), 300)
    },
    [fetchData],
  )

  // ── Filtered data ──
  const filteredClasses = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? cabinClasses.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : cabinClasses
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [cabinClasses, search])

  const { filteredConfigs, configGroups } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filteredConfigs = q
      ? lopaConfigs.filter((c) => c.aircraftType.toLowerCase().includes(q) || c.configName.toLowerCase().includes(q))
      : lopaConfigs

    const map = new Map<string, LopaConfigRef[]>()
    for (const c of filteredConfigs) {
      const arr = map.get(c.aircraftType)
      if (arr) arr.push(c)
      else map.set(c.aircraftType, [c])
    }
    const configGroups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))

    return { filteredConfigs, configGroups }
  }, [lopaConfigs, search])

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    setSearch('')
    setShowCreate(false)
  }, [])

  const handleCreateClick = useCallback(() => {
    setShowCreate(true)
    if (viewMode === 'cabin-classes') setSelectedClass(null)
    else setSelectedConfig(null)
  }, [viewMode])

  const handleSelectClass = useCallback((cc: CabinClassRef) => {
    setSelectedClass(cc)
    setShowCreate(false)
  }, [])

  const handleSelectConfig = useCallback((lc: LopaConfigRef) => {
    setSelectedConfig(lc)
    setShowCreate(false)
  }, [])

  // ── Render ──
  const renderCenter = () => {
    if (viewMode === 'cabin-classes') {
      if (selectedClass) {
        return (
          <CabinClassDetail
            cabinClass={selectedClass}
            lopaConfigs={lopaConfigs}
            onSave={handleSaveClass}
            onDelete={handleDeleteClass}
            onCreate={handleCreateClass}
          />
        )
      }
      if (showCreate) {
        return (
          <CabinClassDetail
            cabinClass={null}
            lopaConfigs={lopaConfigs}
            onCreate={handleCreateClass}
            initialShowCreate={true}
            onCancelCreate={() => setShowCreate(false)}
          />
        )
      }
      if (cabinClasses.length === 0 && !loading) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-module-accent/10">
              <Armchair size={24} className="text-module-accent" />
            </div>
            <p className="text-[14px] font-medium text-hz-text-secondary">No cabin classes yet</p>
            <p className="text-[13px] text-hz-text-tertiary">Click + Add to create one.</p>
          </div>
        )
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-module-accent/10">
            <Armchair size={24} className="text-module-accent" />
          </div>
          <p className="text-[14px] font-medium text-hz-text-secondary">Select a cabin class</p>
          <p className="text-[13px] text-hz-text-tertiary">Choose a class from the list to view details.</p>
        </div>
      )
    }

    // LOPA configs
    if (selectedConfig) {
      return (
        <LopaConfigDetail
          config={selectedConfig}
          cabinClasses={cabinClasses}
          aircraftTypes={aircraftTypes}
          onSave={handleSaveConfig}
          onDelete={handleDeleteConfig}
          onCreate={handleCreateConfig}
        />
      )
    }
    if (showCreate) {
      return (
        <LopaConfigDetail
          config={null}
          cabinClasses={cabinClasses}
          aircraftTypes={aircraftTypes}
          onCreate={handleCreateConfig}
          initialShowCreate={true}
          onCancelCreate={() => setShowCreate(false)}
        />
      )
    }
    if (lopaConfigs.length === 0 && !loading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-module-accent/10">
            <Plane size={24} className="text-module-accent" />
          </div>
          <p className="text-[14px] font-medium text-hz-text-secondary">No LOPA configurations yet</p>
          <p className="text-[13px] text-hz-text-tertiary">Click + Add to create one.</p>
        </div>
      )
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-module-accent/10">
          <Plane size={24} className="text-module-accent" />
        </div>
        <p className="text-[14px] font-medium text-hz-text-secondary">Select a configuration</p>
        <p className="text-[13px] text-hz-text-tertiary">Choose a configuration from the list to view details.</p>
      </div>
    )
  }

  return (
    <MasterDetailLayout
      left={
        <LopaList
          viewMode={viewMode}
          onViewChange={handleViewChange}
          cabinClasses={filteredClasses}
          cabinClassTotal={cabinClasses.length}
          selectedClass={selectedClass}
          onSelectClass={handleSelectClass}
          configGroups={configGroups}
          configTotal={lopaConfigs.length}
          configFilteredCount={filteredConfigs.length}
          selectedConfig={selectedConfig}
          onSelectConfig={handleSelectConfig}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={handleCreateClick}
        />
      }
      center={renderCenter()}
    />
  )
}
