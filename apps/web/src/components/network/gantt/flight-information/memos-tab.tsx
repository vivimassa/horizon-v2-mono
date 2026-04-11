'use client'

import { useState } from 'react'
import { StickyNote, Plus, Star, Trash2, PenLine, Check, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Dropdown } from '@/components/ui/dropdown'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

const CATEGORIES = [
  { value: 'general', label: 'General', color: '#3B82F6' },
  { value: 'catering', label: 'Catering', color: '#F59E0B' },
  { value: 'engineering', label: 'Engineering', color: '#EF4444' },
  { value: 'crew', label: 'Crew', color: '#14B8A6' },
  { value: 'fuel', label: 'Fuel', color: '#F97316' },
  { value: 'delay', label: 'Delay', color: '#6B7280' },
  { value: 'captain_log', label: "Captain's Log", color: '#8B5CF6' },
  { value: 'dispatch', label: 'Dispatch', color: '#06B6D4' },
  { value: 'ground', label: 'Ground', color: '#D97706' },
  { value: 'security', label: 'Security', color: '#DC2626' },
] as const

function getCatColor(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? '#6B7280'
}

function fmtTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd} ${mon} ${hh}:${mm}z`
}

interface MemosTabProps {
  data: FlightDetail
  onUpdate: (updater: (d: FlightDetail) => void) => void
}

export function MemosTab({ data, onUpdate }: MemosTabProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const [showAdd, setShowAdd] = useState(data.memos.length === 0)
  const [newCat, setNewCat] = useState('general')
  const [newContent, setNewContent] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')

  const sorted = [...data.memos].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })

  function addMemo() {
    if (!newContent.trim()) return
    onUpdate((d) => {
      d.memos.push({
        id: crypto.randomUUID(),
        category: newCat,
        content: newContent.trim(),
        author: '',
        pinned: false,
        createdAt: new Date().toISOString(),
      })
    })
    setNewContent('')
    setShowAdd(false)
  }

  function removeMemo(id: string) {
    onUpdate((d) => {
      d.memos = d.memos.filter((m) => m.id !== id)
    })
  }

  function togglePin(id: string) {
    onUpdate((d) => {
      const m = d.memos.find((m) => m.id === id)
      if (m) m.pinned = !m.pinned
    })
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditContent(sorted[idx].content)
  }

  function saveEdit(id: string) {
    onUpdate((d) => {
      const m = d.memos.find((m) => m.id === id)
      if (m) m.content = editContent.trim()
    })
    setEditingIdx(null)
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
          Memos
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-xl text-[13px] font-medium h-8 px-3"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: accent }}
        >
          <Plus size={14} /> Add Memo
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div
          className="rounded-xl p-4 mb-4 space-y-3"
          style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        >
          <Dropdown
            size="sm"
            value={newCat}
            onChange={setNewCat}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label, color: c.color }))}
            className="w-[180px]"
            maxVisible={4}
          />
          <textarea
            rows={3}
            placeholder="Write a memo..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            autoFocus
            className="w-full rounded-lg p-3 text-[13px] outline-none resize-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
              border: `1px solid ${inputBorder}`,
              color: textPrimary,
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={addMemo}
              disabled={!newContent.trim()}
              className="h-8 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-30"
              style={{ background: '#06C270' }}
            >
              <Check size={14} className="inline mr-1" />
              Save
            </button>
            <button
              onClick={() => {
                setShowAdd(false)
                setNewContent('')
              }}
              className="h-8 px-4 rounded-lg text-[13px] font-medium"
              style={{ color: muted, border: `1px solid ${inputBorder}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Memo list */}
      {sorted.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-10 opacity-50">
          <StickyNote size={28} style={{ color: muted }} className="mb-3" />
          <span className="text-[13px] font-medium" style={{ color: muted }}>
            No memos
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((memo, i) => {
            const color = getCatColor(memo.category)
            const isEditing = editingIdx === i

            return (
              <div
                key={memo.id}
                className="rounded-xl px-4 py-2.5 flex items-start gap-3 group"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderLeft: `3px solid ${color}`,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                {/* Pin */}
                <button onClick={() => togglePin(memo.id)} className="mt-0.5 shrink-0">
                  <Star
                    size={14}
                    style={{ color: memo.pinned ? accent : `${muted}40`, fill: memo.pinned ? accent : 'none' }}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  {/* Category + timestamp */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[13px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: `${color}15`, color }}
                    >
                      {CATEGORIES.find((c) => c.value === memo.category)?.label ?? memo.category}
                    </span>
                    {memo.author && (
                      <span className="text-[13px] shrink-0" style={{ color: muted }}>
                        {memo.author}
                      </span>
                    )}
                    <span className="text-[13px] font-mono shrink-0" style={{ color: `${muted}60` }}>
                      {fmtTime(memo.createdAt)}
                    </span>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autoFocus
                        className="flex-1 h-8 px-2 rounded-lg text-[13px] outline-none"
                        style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
                      />
                      <button
                        onClick={() => saveEdit(memo.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                        style={{ background: '#06C270' }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ color: muted, border: `1px solid ${inputBorder}` }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[13px]" style={{ color: textPrimary }}>
                      {memo.content}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!isEditing && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
                    <button onClick={() => startEdit(i)} className="p-1">
                      <PenLine size={13} style={{ color: muted }} />
                    </button>
                    <button onClick={() => removeMemo(memo.id)} className="p-1">
                      <Trash2 size={13} style={{ color: '#E63535' }} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
