'use client'

import { useState } from 'react'
import { Pencil, Plus, Loader2 } from 'lucide-react'
import type { CharterContractRef } from '@skyhub/api'
import { api } from '@skyhub/api'
import {
  getStatusStyle, CONTRACT_TYPE_LABELS,
  STATUS_TRANSITIONS, TRANSITION_VARIANT_COLORS,
} from './charter-types'
import type { ContractType, ContractStatus } from './charter-types'

interface ContractToolbarProps {
  contract: CharterContractRef | null
  onEdit: () => void
  onStatusChange: () => void
  onNewContract: () => void
  isDark: boolean
}

export function ContractToolbar({ contract, onEdit, onStatusChange, onNewContract, isDark }: ContractToolbarProps) {
  const [transitioning, setTransitioning] = useState<string | null>(null)

  const status = contract ? getStatusStyle(contract.status as ContractStatus, isDark) : null
  const transitions = contract ? (STATUS_TRANSITIONS[contract.status as ContractStatus] || []) : []

  async function handleTransition(target: ContractStatus) {
    if (!contract) return
    setTransitioning(target)
    try {
      await api.updateCharterContractStatus(contract._id, target)
      onStatusChange()
    } finally {
      setTransitioning(null)
    }
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4">
      {/* Left: contract info or placeholder */}
      <div className="flex items-center gap-3 min-w-0">
        {contract ? (
          <>
            <span className="text-[15px] font-bold font-mono shrink-0">{contract.contractNumber}</span>
            <span className="text-hz-text-tertiary shrink-0">&bull;</span>
            <span className="text-[14px] font-medium truncate">{contract.clientName}</span>
            {status && (
              <span className="shrink-0 px-2 py-0.5 rounded-md text-[13px] font-semibold capitalize"
                style={{ background: status.background, color: status.color, border: `1px solid ${status.borderColor}` }}>
                {contract.status}
              </span>
            )}
            <span className="text-[13px] text-hz-text-tertiary shrink-0">
              {CONTRACT_TYPE_LABELS[contract.contractType as ContractType]}
            </span>
            {contract.aircraftTypeIcao && (
              <span className="text-[13px] font-mono text-hz-text-tertiary shrink-0">{contract.aircraftTypeIcao}</span>
            )}
          </>
        ) : (
          <span className="text-[14px] text-hz-text-tertiary">No contract selected</span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onNewContract}
          className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity">
          <Plus size={13} />
          New
        </button>
        {contract && (
          <>
            <button onClick={onEdit}
              className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold transition-colors"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              }}>
              <Pencil size={13} />
              Edit
            </button>

            {transitions.map(t => {
              const vc = TRANSITION_VARIANT_COLORS[t.variant]
              return (
                <button key={t.target} onClick={() => handleTransition(t.target)}
                  disabled={transitioning !== null}
                  className="h-8 px-3 flex items-center gap-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
                  style={{
                    background: isDark ? vc.bgDark : vc.bg,
                    color: isDark ? vc.textDark : vc.text,
                  }}>
                  {transitioning === t.target && <Loader2 size={13} className="animate-spin" />}
                  {t.label}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
