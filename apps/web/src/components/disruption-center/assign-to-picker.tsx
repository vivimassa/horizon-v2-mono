'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, UserCircle, X } from 'lucide-react'
import { api, type DisruptionIssueRef, type UserListItem } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

interface Props {
  issue: DisruptionIssueRef
  operatorId: string
  onClose: () => void
  onConfirm: (userId: string) => void
}

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Administrator',
  manager: 'Manager',
  operator: 'Operator',
  viewer: 'Viewer',
}

export function AssignToPicker({ issue, operatorId, onClose, onConfirm }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .listUsers({ operatorId, active: true })
      .then((list) => {
        if (!alive) return
        const assignable = list.filter((u) => u.role !== 'viewer')
        setUsers(assignable)
      })
      .catch(() => {
        if (!alive) return
        setUsers([])
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [operatorId])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase()
      return name.includes(q) || u.email.toLowerCase().includes(q) || u.department.toLowerCase().includes(q)
    })
  }, [users, query])

  const panelBg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const rowHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const rowSelected = isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.08)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9998, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Assign disruption to user"
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.40)',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${panelBorder}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[3px] h-[14px] rounded-full bg-module-accent" />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-hz-text truncate">Assign to…</div>
              <div className="text-[13px] text-hz-text-secondary truncate">
                {issue.flightNumber ?? 'Unknown'} · {issue.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-hz-text-tertiary" />
          </button>
        </div>

        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${panelBorder}` }}>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: inputBg, border: `1px solid ${panelBorder}` }}
          >
            <Search className="h-4 w-4 text-hz-text-tertiary" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, department"
              className="flex-1 bg-transparent outline-none text-[13px] text-hz-text"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-24 flex items-center justify-center text-[13px] text-hz-text-tertiary">
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-[13px] text-hz-text-tertiary">
              No matching users
            </div>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((u) => {
                const isSelected = selected === u._id
                const name = `${u.firstName} ${u.lastName}`.trim() || u.email
                return (
                  <li key={u._id}>
                    <button
                      type="button"
                      onClick={() => setSelected(u._id)}
                      onDoubleClick={() => onConfirm(u._id)}
                      className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors"
                      style={{
                        borderBottom: `1px solid ${rowBorder}`,
                        background: isSelected ? rowSelected : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = rowHover
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={name}
                          className="h-8 w-8 rounded-full object-cover"
                          style={{ border: `1px solid ${rowBorder}` }}
                        />
                      ) : (
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center"
                          style={{ background: rowSelected }}
                        >
                          <UserCircle className="h-4 w-4 text-module-accent" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-hz-text truncate">{name}</div>
                        <div className="text-[13px] text-hz-text-secondary truncate">
                          {[ROLE_LABEL[u.role] ?? u.role, u.department].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: `1px solid ${panelBorder}` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-8 rounded-lg text-[13px] font-semibold text-hz-text-secondary transition-opacity hover:opacity-80"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className="px-4 h-8 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{
              background: 'var(--module-accent, #F59E0B)',
              color: '#fff',
              opacity: selected ? 1 : 0.5,
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
