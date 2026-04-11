'use client'

import { useState, useCallback } from 'react'
import { Pencil, Save, Loader2 } from 'lucide-react'
import type { CharterContractRef } from '@skyhub/api'
import { api } from '@skyhub/api'

interface NotesTabProps {
  contract: CharterContractRef
  onUpdated: () => void
  isDark: boolean
}

export function NotesTab({ contract, onUpdated, isDark }: NotesTabProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clientNotes, setClientNotes] = useState(contract.notes ?? '')
  const [internalNotes, setInternalNotes] = useState(contract.internalNotes ?? '')

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const warningBg = isDark ? 'rgba(253,172,66,0.08)' : 'rgba(255,136,0,0.06)'
  const warningBorder = isDark ? 'rgba(253,172,66,0.15)' : 'rgba(255,136,0,0.12)'
  const labelColor = isDark ? '#8F90A6' : '#555770'

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.updateCharterContract(contract._id, {
        notes: clientNotes || null,
        internalNotes: internalNotes || null,
      })
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }, [contract._id, clientNotes, internalNotes, onUpdated])

  const handleEdit = useCallback(() => {
    setClientNotes(contract.notes ?? '')
    setInternalNotes(contract.internalNotes ?? '')
    setEditing(true)
  }, [contract.notes, contract.internalNotes])

  return (
    <div className="p-5 space-y-4">
      {/* Toggle button */}
      <div className="flex justify-end">
        {editing ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        ) : (
          <button
            onClick={handleEdit}
            className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold transition-colors"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${cardBorder}`,
            }}
          >
            <Pencil size={13} />
            Edit
          </button>
        )}
      </div>

      {/* Client notes */}
      <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: labelColor }}>
          Client Notes
        </div>
        {editing ? (
          <textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            rows={5}
            placeholder="Notes visible to the client..."
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
          />
        ) : (
          <div
            className="text-[13px] whitespace-pre-wrap min-h-[80px]"
            style={{ color: contract.notes ? undefined : labelColor }}
          >
            {contract.notes || 'No client notes'}
          </div>
        )}
      </div>

      {/* Internal notes */}
      <div className="rounded-xl p-4" style={{ background: warningBg, border: `1px solid ${warningBorder}` }}>
        <div
          className="text-[13px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: isDark ? '#FDAC42' : '#E67A00' }}
        >
          Internal Notes (not shared)
        </div>
        {editing ? (
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={5}
            placeholder="Internal notes only..."
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
          />
        ) : (
          <div
            className="text-[13px] whitespace-pre-wrap min-h-[80px]"
            style={{ color: contract.internalNotes ? undefined : labelColor }}
          >
            {contract.internalNotes || 'No internal notes'}
          </div>
        )}
      </div>
    </div>
  )
}
