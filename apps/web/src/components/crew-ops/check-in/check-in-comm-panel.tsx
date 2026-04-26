'use client'

import { X } from 'lucide-react'
import type { CrewAssignmentRef, CrewMemberListItemRef, CrewPositionRef, PairingRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { CommContactsTab } from './comm-contacts-tab'
import { CommMessagesTab } from './comm-messages-tab'
import { CommLogsTab } from './comm-logs-tab'

interface Props {
  pairing: PairingRef | undefined
  assignments: CrewAssignmentRef[]
  crewById: Map<string, CrewMemberListItemRef>
  positionsById: Map<string, CrewPositionRef>
}

const TITLES: Record<'contacts' | 'messages' | 'logs', string> = {
  contacts: 'Contacts',
  messages: 'Messages',
  logs: 'Logs',
}

/**
 * 4.1.7.1 Communication panel — third column to the right of Pairing Detail.
 *
 *   • Contacts — crew bio + native tel:/sms:/mailto: actions
 *   • Messages — compose + thread (queued for crew app push pickup)
 *   • Logs     — combined audit feed of comms + check-in events
 */
export function CrewCheckInCommPanel({ pairing, assignments, crewById, positionsById }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const mode = useCrewCheckInStore((s) => s.commPanelMode)
  const setMode = useCrewCheckInStore((s) => s.setCommPanelMode)

  if (!mode) return null

  return (
    <div
      className="shrink-0 flex flex-col rounded-2xl overflow-hidden"
      style={{
        width: '20%',
        minWidth: 320,
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 2px 12px rgba(96,97,112,0.06)',
      }}
    >
      <div className="h-9 px-3 flex items-center gap-3 border-b border-hz-border">
        <span
          className="w-1 h-4 rounded-full"
          style={{ background: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
        />
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{TITLES[mode]}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setMode(null)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-hz-background-hover"
          aria-label="Close communication panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {!pairing ? (
          <div className="h-full flex items-center justify-center text-[13px] text-hz-text-tertiary px-6 text-center">
            Select a pairing on the left to use Communication
          </div>
        ) : mode === 'contacts' ? (
          <CommContactsTab
            pairing={pairing}
            assignments={assignments}
            crewById={crewById}
            positionsById={positionsById}
          />
        ) : mode === 'messages' ? (
          <CommMessagesTab pairing={pairing} assignments={assignments} crewById={crewById} />
        ) : (
          <CommLogsTab pairing={pairing} assignments={assignments} crewById={crewById} />
        )}
      </div>
    </div>
  )
}
