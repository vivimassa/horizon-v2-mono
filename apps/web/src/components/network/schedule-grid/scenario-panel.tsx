'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, type ScenarioRef } from '@skyhub/api'
import { GitBranch, Plus, Copy, Trash2, X, Check, Upload, MoreHorizontal, AlertTriangle } from 'lucide-react'
import { getOperatorId } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'

interface ScenarioPanelProps {
  seasonCode?: string
  activeScenarioId: string | null
  /** Called with the scenario _id and display name (null for Production). */
  onSelectScenario: (id: string | null, name: string | null) => void
  onClose: () => void
  /** Open with create form pre-expanded and copy flights on */
  autoCreate?: boolean
}

export function ScenarioPanel({
  seasonCode = '',
  activeScenarioId,
  onSelectScenario,
  onClose,
  autoCreate,
}: ScenarioPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [scenarios, setScenarios] = useState<ScenarioRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(autoCreate ?? false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [copyFlights, setCopyFlights] = useState(autoCreate ?? true)
  const [creating, setCreating] = useState(false)
  const [copyStatuses, setCopyStatuses] = useState<Set<string>>(new Set(['draft', 'active']))
  const [publishing, setPublishing] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [publishConfirm, setPublishConfirm] = useState<{ id: string; name: string } | null>(null)
  const [diffPreview, setDiffPreview] = useState<{
    added: number
    modified: number
    deleted: number
    unchanged: number
  } | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [publishResult, setPublishResult] = useState<string | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeConfirmText, setWipeConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)
  const [wipeResult, setWipeResult] = useState<string | null>(null)

  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const shadow = isDark ? '0 12px 48px rgba(0,0,0,0.5)' : '0 12px 48px rgba(96,97,112,0.18)'

  const fetchScenarios = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getScenarios({ operatorId: getOperatorId(), seasonCode })
      setScenarios(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [seasonCode])

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const name = createName.trim()
      let newId: string | null = null
      if (copyFlights && activeScenarioId) {
        // Clone from current scenario
        const cloned = await api.cloneScenario(activeScenarioId, name, 'admin')
        newId = cloned.id
      } else {
        // Create scenario
        const scenario = await api.createScenario({
          operatorId: getOperatorId(),
          seasonCode,
          name,
          description: createDesc.trim() || null,
          createdBy: 'admin',
        })
        newId = scenario._id
        // Copy production flights if requested
        if (copyFlights) {
          const statuses = [...copyStatuses]
          await api.copyProductionIntoScenario(scenario._id, statuses)
        }
      }
      setCreateName('')
      setCreateDesc('')
      setShowCreate(false)
      await fetchScenarios()
      // Auto-switch to the newly created scenario and close the panel so
      // subsequent edits land on the scenario, not on Production.
      if (newId) {
        onSelectScenario(newId, name)
        onClose()
      }
    } finally {
      setCreating(false)
    }
  }, [createName, createDesc, copyFlights, activeScenarioId, seasonCode, fetchScenarios, onSelectScenario, onClose])

  const handlePublishClick = useCallback(async (id: string, name: string) => {
    setPublishConfirm({ id, name })
    setLoadingDiff(true)
    setDiffPreview(null)
    setPublishResult(null)
    try {
      const diff = await api.getScenarioDiffPreview(id)
      setDiffPreview(diff)
    } catch {
      setDiffPreview({ added: 0, modified: 0, deleted: 0, unchanged: 0 })
    } finally {
      setLoadingDiff(false)
    }
  }, [])

  const handlePublishConfirm = useCallback(async () => {
    if (!publishConfirm) return
    setPublishing(publishConfirm.id)
    try {
      const result = await api.publishMergeScenario(publishConfirm.id, 'admin')
      setPublishResult(`Merged: ${result.added} added, ${result.modified} modified, ${result.deleted} deleted`)
      setTimeout(() => {
        setPublishConfirm(null)
        setPublishResult(null)
        fetchScenarios()
      }, 1500)
    } catch (e) {
      setPublishResult(`Failed: ${(e as Error).message}`)
    } finally {
      setPublishing(null)
    }
  }, [publishConfirm, fetchScenarios])

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteScenario(id)
      if (activeScenarioId === id) onSelectScenario(null, null)
      fetchScenarios()
      setMenuOpen(null)
    },
    [activeScenarioId, onSelectScenario, fetchScenarios],
  )

  const handleWipeAll = useCallback(async () => {
    setWiping(true)
    setWipeResult(null)
    try {
      const res = await api.deleteAllScenarios()
      setWipeResult(`Wiped ${res.scenariosDeleted} scenario(s) and ${res.flightsDeleted} scenario flight(s).`)
      onSelectScenario(null, null)
      setTimeout(() => {
        setWipeOpen(false)
        setWipeConfirmText('')
        setWipeResult(null)
        fetchScenarios()
      }, 1500)
    } catch (e) {
      setWipeResult(`Failed: ${(e as Error).message}`)
    } finally {
      setWiping(false)
    }
  }, [fetchScenarios, onSelectScenario])

  const handleClone = useCallback(
    async (id: string, name: string) => {
      await api.cloneScenario(id, `${name} (copy)`, 'admin')
      fetchScenarios()
      setMenuOpen(null)
    },
    [fetchScenarios],
  )

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    draft: { color: '#E67A00', bg: 'rgba(230,122,0,0.10)', label: 'Draft' },
    review: { color: '#0063F7', bg: 'rgba(0,99,247,0.10)', label: 'Review' },
    published: { color: '#06C270', bg: 'rgba(6,194,112,0.10)', label: 'Published' },
    archived: { color: '#8F90A6', bg: 'rgba(143,144,166,0.10)', label: 'Archived' },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] min-h-[500px] flex flex-col overflow-hidden"
        style={{
          backgroundColor: bg,
          border: `1px solid ${border}`,
          boxShadow: shadow,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.08)' }}
            >
              <GitBranch size={16} className="text-module-accent" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-hz-text">Scenarios</h2>
              <p className="text-[12px] text-hz-text-tertiary">Schedule planning variants</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {scenarios.length > 0 && (
              <button
                onClick={() => {
                  setWipeOpen(true)
                  setWipeConfirmText('')
                  setWipeResult(null)
                }}
                className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12px] font-medium transition-colors"
                style={{
                  color: '#E63535',
                  border: `1px solid ${isDark ? 'rgba(230,53,53,0.30)' : 'rgba(230,53,53,0.25)'}`,
                  backgroundColor: isDark ? 'rgba(230,53,53,0.08)' : 'rgba(230,53,53,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(230,53,53,0.14)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(230,53,53,0.08)' : 'rgba(230,53,53,0.04)'
                }}
                title="Delete every scenario (all operators)"
              >
                <Trash2 size={13} /> Delete All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hoverBg
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <X size={15} className="text-hz-text-tertiary" />
            </button>
          </div>
        </div>

        {/* Production row */}
        <div className="px-6 pb-3 shrink-0">
          <button
            onClick={() => {
              onSelectScenario(null, null)
              onClose()
            }}
            className="w-full text-left px-4 py-3 rounded-xl transition-all"
            style={{
              border: `1.5px solid ${activeScenarioId === null ? 'var(--color-module-accent)' : border}`,
              backgroundColor:
                activeScenarioId === null ? (isDark ? 'rgba(62,123,250,0.08)' : 'rgba(30,64,175,0.04)') : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (activeScenarioId !== null) e.currentTarget.style.backgroundColor = hoverBg
            }}
            onMouseLeave={(e) => {
              if (activeScenarioId !== null) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeScenarioId === null && <Check size={14} className="text-module-accent" />}
                <span className="text-[14px] font-semibold text-hz-text">Production</span>
              </div>
              <span
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: activeScenarioId === null ? 'rgba(62,123,250,0.10)' : 'rgba(6,194,112,0.10)',
                  color: activeScenarioId === null ? '#3E7BFA' : '#06C270',
                }}
              >
                {activeScenarioId === null ? 'Selected' : 'Live'}
              </span>
            </div>
            <p className="text-[12px] text-hz-text-tertiary mt-0.5">Active published schedule</p>
          </button>
        </div>

        {/* Scenario list */}
        <div className="flex-1 overflow-y-auto px-6 space-y-2 min-h-0">
          {loading ? (
            <p className="text-[13px] text-hz-text-tertiary animate-pulse py-8 text-center">Loading scenarios...</p>
          ) : scenarios.length === 0 ? (
            <div className="py-8 text-center">
              <GitBranch size={24} className="mx-auto text-hz-text-tertiary/30 mb-2" />
              <p className="text-[13px] text-hz-text-tertiary">No scenarios yet</p>
              <p className="text-[12px] text-hz-text-tertiary/60 mt-0.5">Create one to explore schedule alternatives</p>
            </div>
          ) : (
            scenarios.map((s) => {
              const st = statusConfig[s.status] ?? statusConfig.draft
              const isActive = activeScenarioId === s._id
              return (
                <div
                  key={s._id}
                  className="px-4 py-3 rounded-xl transition-all relative"
                  style={{
                    border: `1.5px solid ${isActive ? 'var(--color-module-accent)' : border}`,
                    backgroundColor: isActive
                      ? isDark
                        ? 'rgba(62,123,250,0.08)'
                        : 'rgba(30,64,175,0.04)'
                      : 'transparent',
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenuOpen(menuOpen === s._id ? null : s._id)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        onSelectScenario(s._id, s.name)
                        onClose()
                      }}
                      className="text-left flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        {isActive && <Check size={14} className="text-module-accent shrink-0" />}
                        <span className="text-[14px] font-medium text-hz-text truncate">{s.name}</span>
                      </div>
                      <p className="text-[12px] text-hz-text-tertiary mt-0.5">
                        {s.createdAt
                          ? `Created ${new Date(s.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
                          : 'Schedule variant'}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <span
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(62,123,250,0.10)', color: '#3E7BFA' }}
                        >
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                  {s.description && (
                    <p className="text-[12px] text-hz-text-tertiary mt-1 ml-6 line-clamp-2">{s.description}</p>
                  )}

                  {/* Action menu */}
                  {menuOpen === s._id && (
                    <div
                      className="absolute right-4 top-full mt-1 z-10 rounded-xl py-1.5 min-w-[140px]"
                      style={{ backgroundColor: bg, border: `1px solid ${border}`, boxShadow: shadow }}
                    >
                      <button
                        onClick={() => handleClone(s._id, s.name)}
                        className="w-full text-left px-3 py-1.5 text-[13px] text-hz-text flex items-center gap-2 transition-colors"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = hoverBg
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <Copy size={13} className="text-hz-text-tertiary" /> Duplicate
                      </button>
                      {s.status === 'draft' && (
                        <button
                          onClick={() => {
                            handlePublishClick(s._id, s.name)
                            setMenuOpen(null)
                          }}
                          disabled={publishing === s._id}
                          className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 transition-colors"
                          style={{ color: '#06C270' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = hoverBg
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <Upload size={13} /> {publishing === s._id ? 'Publishing...' : 'Publish'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s._id)}
                        className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 transition-colors"
                        style={{ color: '#E63535' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(230,53,53,0.08)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Create form */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: `1px solid ${border}` }}>
          {showCreate ? (
            <div className="space-y-3">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Scenario name"
                className="w-full h-10 px-3 rounded-lg text-[13px] outline-none text-hz-text"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${border}`,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-module-accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(30,64,175,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = border
                  e.currentTarget.style.boxShadow = 'none'
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setShowCreate(false)
                }}
              />
              <input
                type="text"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full h-10 px-3 rounded-lg text-[13px] outline-none text-hz-text"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${border}`,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-module-accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(30,64,175,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = border
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copyFlights}
                  onChange={(e) => setCopyFlights(e.target.checked)}
                  className="accent-module-accent w-3.5 h-3.5"
                />
                <span className="text-[13px] font-medium text-hz-text-secondary">
                  Copy current flights into scenario
                </span>
              </label>
              {copyFlights && (
                <div className="flex items-center gap-3 ml-6">
                  <span className="text-[12px] text-hz-text-tertiary">Include:</span>
                  {(['draft', 'active', 'suspended', 'cancelled'] as const).map((s) => {
                    const colors: Record<string, string> = {
                      draft: '#E67A00',
                      active: '#06C270',
                      suspended: '#8F90A6',
                      cancelled: '#E63535',
                    }
                    return (
                      <label key={s} className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={copyStatuses.has(s)}
                          onChange={(e) => {
                            const next = new Set(copyStatuses)
                            if (e.target.checked) next.add(s)
                            else next.delete(s)
                            setCopyStatuses(next)
                          }}
                          className="accent-module-accent w-3 h-3"
                        />
                        <span className="text-[12px] font-medium capitalize" style={{ color: colors[s] }}>
                          {s}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!createName.trim() || creating}
                  className="flex-1 h-10 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-40 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Scenario'}
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setCreateName('')
                    setCreateDesc('')
                  }}
                  className="h-10 px-4 rounded-lg text-[13px] font-medium text-hz-text-secondary transition-colors"
                  style={{ border: `1px solid ${border}` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-1.5 w-full h-10 rounded-lg text-[13px] font-medium transition-colors"
              style={{ border: `1.5px dashed ${border}`, color: isDark ? '#8F90A6' : '#555770' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-module-accent)'
                e.currentTarget.style.color = 'var(--color-module-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border
                e.currentTarget.style.color = isDark ? '#8F90A6' : '#555770'
              }}
            >
              <Plus size={14} /> New Scenario
            </button>
          )}
        </div>
      </div>

      {/* Publish confirmation overlay */}
      {publishConfirm && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl"
          style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm mx-6 rounded-xl p-5 space-y-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}
          >
            <div>
              <h3 className="text-[15px] font-bold text-hz-text">Publish &quot;{publishConfirm.name}&quot;?</h3>
              <p className="text-[12px] text-hz-text-tertiary mt-1">
                This will merge changes into the production schedule.
              </p>
            </div>

            {loadingDiff ? (
              <p className="text-[13px] text-hz-text-tertiary animate-pulse">Computing diff...</p>
            ) : (
              diffPreview && (
                <div
                  className="rounded-lg p-3 space-y-1"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${border}`,
                  }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-hz-text-tertiary mb-2">
                    Changes vs Production
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-hz-text-secondary">New flights</span>
                    <span className="font-bold" style={{ color: '#06C270' }}>
                      {diffPreview.added}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-hz-text-secondary">Modified</span>
                    <span className="font-bold" style={{ color: '#3E7BFA' }}>
                      {diffPreview.modified}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-hz-text-secondary">Deleted</span>
                    <span className="font-bold" style={{ color: '#E63535' }}>
                      {diffPreview.deleted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-hz-text-secondary">Unchanged</span>
                    <span className="font-bold text-hz-text">{diffPreview.unchanged}</span>
                  </div>
                </div>
              )
            )}

            {publishResult && (
              <p
                className="text-[12px] font-medium text-center"
                style={{ color: publishResult.startsWith('Failed') ? '#E63535' : '#06C270' }}
              >
                {publishResult}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handlePublishConfirm}
                disabled={!!publishing || loadingDiff}
                className="flex-1 h-10 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
                style={{ background: '#06C270' }}
              >
                {publishing ? 'Merging...' : 'Publish & Merge'}
              </button>
              <button
                onClick={() => {
                  setPublishConfirm(null)
                  setDiffPreview(null)
                  setPublishResult(null)
                }}
                className="h-10 px-4 rounded-lg text-[13px] font-medium text-hz-text-secondary transition-colors"
                style={{ border: `1px solid ${border}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe-all confirmation overlay */}
      {wipeOpen && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl"
          style={{ background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm mx-6 rounded-xl p-5 space-y-4"
            style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(230,53,53,0.12)' }}
              >
                <AlertTriangle size={16} style={{ color: '#E63535' }} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-hz-text">Delete all scenarios?</h3>
                <p className="text-[12px] text-hz-text-tertiary mt-1">
                  This permanently removes every scenario across all operators, along with their scoped flights.
                  Production flights are not affected.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-hz-text-secondary">
                Type{' '}
                <span className="font-bold" style={{ color: '#E63535' }}>
                  DELETE ALL
                </span>{' '}
                to confirm
              </label>
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder="DELETE ALL"
                autoFocus
                className="w-full h-10 px-3 rounded-lg text-[13px] outline-none text-hz-text"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${border}`,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#E63535'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(230,53,53,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = border
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {wipeResult && (
              <p
                className="text-[12px] font-medium text-center"
                style={{ color: wipeResult.startsWith('Failed') ? '#E63535' : '#06C270' }}
              >
                {wipeResult}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setWipeOpen(false)
                  setWipeConfirmText('')
                  setWipeResult(null)
                }}
                className="h-10 px-4 rounded-lg text-[13px] font-medium text-hz-text-secondary transition-colors"
                style={{ border: `1px solid ${border}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                No, Cancel
              </button>
              <button
                onClick={handleWipeAll}
                disabled={wipeConfirmText !== 'DELETE ALL' || wiping}
                className="flex-1 h-10 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
                style={{ background: '#E63535' }}
              >
                {wiping ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
