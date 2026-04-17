'use client'

/**
 * 7.1.5.1 Consumers section.
 *
 * List of delivery targets with CRUD. Add Consumer button opens the form
 * modal; each row supports Edit, Rotate Key (pull_api only), and Delete.
 */

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, Mail, MoreHorizontal, Pencil, Plus, RefreshCw, Server, Trash2 } from 'lucide-react'
import type { AsmSsmConsumerRef } from '@skyhub/api'
import { api } from '@skyhub/api'
import type { Palette as PaletteType } from '@skyhub/ui/theme'
import { ConsumerFormModal } from './consumer-form-modal'

interface Props {
  operatorId: string
  accent: string
  isDark: boolean
  palette: PaletteType
  onError: (msg: string | null) => void
}

const MODE_META: Record<AsmSsmConsumerRef['deliveryMode'], { label: string; Icon: typeof KeyRound }> = {
  pull_api: { label: 'Pull API', Icon: KeyRound },
  sftp: { label: 'SFTP', Icon: Server },
  smtp: { label: 'SMTP', Icon: Mail },
}

export function ConsumersSection({ operatorId, accent, isDark, onError }: Props) {
  const [consumers, setConsumers] = useState<AsmSsmConsumerRef[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AsmSsmConsumerRef | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [rotatedKey, setRotatedKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getAsmSsmConsumers(operatorId, true)
      setConsumers(res.consumers)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load consumers')
    } finally {
      setLoading(false)
    }
  }, [operatorId, onError])

  useEffect(() => {
    void load()
  }, [load])

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (c: AsmSsmConsumerRef) => {
    setEditing(c)
    setModalOpen(true)
    setMenuOpenId(null)
  }
  const handleDelete = async (c: AsmSsmConsumerRef) => {
    if (!confirm(`Disable consumer "${c.name}"? This pauses delivery without removing history.`)) return
    try {
      await api.deleteAsmSsmConsumer(c._id)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setMenuOpenId(null)
    }
  }
  const handleRotate = async (c: AsmSsmConsumerRef) => {
    setMenuOpenId(null)
    setRotatingId(c._id)
    try {
      const res = await api.rotateAsmSsmConsumerKey(c._id)
      setRotatedKey(res.apiKey)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Rotate failed')
    } finally {
      setRotatingId(null)
    }
  }

  const cardBg = isDark ? 'rgba(25,25,33,0.85)' : '#FFFFFF'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="max-w-3xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-medium text-hz-text">
            {consumers.length} consumer{consumers.length !== 1 ? 's' : ''}
          </div>
          <div className="text-[13px] text-hz-text-secondary">
            Inactive rows are greyed out. Delete = deactivate (soft).
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="h-10 px-4 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2"
          style={{ background: accent }}
        >
          <Plus size={14} /> Add consumer
        </button>
      </div>

      {/* Fresh-key banner after rotation */}
      {rotatedKey && (
        <div
          className="mb-4 px-4 py-3 rounded-xl border"
          style={{ borderColor: 'rgba(6,194,112,0.28)', background: 'rgba(6,194,112,0.06)' }}
        >
          <div className="text-[13px] font-medium text-hz-text mb-1">New API key issued</div>
          <div className="text-[13px] font-mono px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.12)' }}>
            {rotatedKey}
          </div>
          <div className="flex items-center justify-between gap-3 mt-2">
            <span className="text-[13px] text-hz-text-secondary">
              Copy this value now — it will not be shown again.
            </span>
            <button
              type="button"
              onClick={() => setRotatedKey(null)}
              className="text-[13px] text-hz-text-tertiary hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-hz-text-secondary" />
        </div>
      ) : consumers.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: cardBg, border: `1px dashed ${cardBorder}` }}>
          <div className="text-[14px] font-medium text-hz-text mb-1">No consumers yet</div>
          <div className="text-[13px] text-hz-text-secondary">
            Add a consumer to start delivering released ASM/SSM traffic.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {consumers.map((c) => {
            const { label, Icon } = MODE_META[c.deliveryMode]
            const detail =
              c.deliveryMode === 'pull_api'
                ? c.pullApi?.hasKey
                  ? `Key installed · ${c.pullApi.ipAllowlist?.length ?? 0} IPs allowlisted`
                  : 'No key installed'
                : c.deliveryMode === 'sftp'
                  ? `${c.sftp?.user ?? ''}@${c.sftp?.host ?? '—'}:${c.sftp?.port ?? 22}${c.sftp?.targetPath ?? '/'}`
                  : `${c.smtp?.to ?? '—'}${(c.smtp?.cc?.length ?? 0) > 0 ? ` · +${c.smtp?.cc?.length} cc` : ''}`
            return (
              <div
                key={c._id}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  opacity: c.active ? 1 : 0.55,
                  boxShadow: '0 1px 3px rgba(96,97,112,0.06)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(96,97,112,0.08)' }}
                >
                  <Icon size={16} style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-hz-text truncate">{c.name}</span>
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(96,97,112,0.08)', color: accent }}
                    >
                      {label}
                    </span>
                    {!c.active && <span className="text-[13px] font-medium text-hz-text-tertiary">Inactive</span>}
                  </div>
                  <div className="text-[13px] text-hz-text-secondary truncate">{detail}</div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {c.deliveryMode === 'pull_api' && (
                    <button
                      type="button"
                      onClick={() => void handleRotate(c)}
                      disabled={rotatingId === c._id}
                      className="h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 text-hz-text-secondary hover:bg-hz-border/30 disabled:opacity-40"
                      title="Rotate API key"
                    >
                      {rotatingId === c._id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Rotate
                    </button>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(menuOpenId === c._id ? null : c._id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-border/30"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menuOpenId === c._id && (
                      <div
                        className="absolute right-0 top-full mt-1 rounded-lg py-1 z-10 min-w-[160px]"
                        style={{
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-hz-border/30"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(c)}
                          className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-hz-border/30"
                          style={{ color: '#E63535' }}
                        >
                          <Trash2 size={13} /> Disable
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <ConsumerFormModal
          operatorId={operatorId}
          existing={editing}
          accent={accent}
          isDark={isDark}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
