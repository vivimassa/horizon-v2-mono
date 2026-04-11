'use client'

import { useState, useRef, useEffect } from 'react'
import type { FdtlRuleRef } from '@skyhub/api'
import { RotateCcw, AlertTriangle, Scale } from 'lucide-react'
import { ACCENT } from './fdt-rules-shell'

interface Props {
  rules: FdtlRuleRef[]
  showHeader?: boolean
  onRuleChange: (id: string, value: string) => Promise<void>
  onRuleReset: (id: string) => Promise<void>
}

export function FdtRuleList({ rules, showHeader, onRuleChange, onRuleReset }: Props) {
  // Group by subcategory
  const groups = new Map<string, FdtlRuleRef[]>()
  for (const r of rules) {
    const key = r.subcategory
    const arr = groups.get(key)
    if (arr) arr.push(r)
    else groups.set(key, [r])
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3 mt-2">
          <Scale size={14} style={{ color: ACCENT }} />
          <span className="text-[13px] font-semibold">Rule Parameters</span>
        </div>
      )}

      {[...groups.entries()].map(([sub, items]) => (
        <div key={sub} className="mb-4">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="text-[12px] font-medium uppercase tracking-wider text-hz-text-tertiary">
              {sub.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="space-y-1">
            {items.map((rule) => (
              <RuleRow key={rule._id} rule={rule} onRuleChange={onRuleChange} onRuleReset={onRuleReset} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Rule Row ─── */

function RuleRow({
  rule,
  onRuleChange,
  onRuleReset,
}: {
  rule: FdtlRuleRef
  onRuleChange: (id: string, value: string) => Promise<void>
  onRuleReset: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rule.value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select()
  }, [editing])

  const isModified = !rule.isTemplateDefault
  const isBoolean = rule.value === 'true' || rule.value === 'false'
  const isFormula = !isBoolean && (/[a-z_]{2,}\(/.test(rule.value) || rule.value.includes('_'))

  // Check restrictiveness
  const isLessRestrictive = isModified && rule.templateValue && rule.directionality && checkRestrictiveness(rule)

  const commit = async () => {
    setEditing(false)
    if (draft.trim() !== rule.value) {
      await onRuleChange(rule._id, draft.trim())
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-hz-border/50 hover:border-hz-border transition-colors group">
      {/* Source badge */}
      <span
        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
          rule.source === 'government'
            ? 'bg-[rgba(255,136,0,0.12)] text-[#E67A00] dark:bg-[rgba(253,172,66,0.15)] dark:text-[#FDAC42]'
            : 'bg-[rgba(102,0,204,0.10)] text-[#6600CC] dark:bg-[rgba(172,93,217,0.15)] dark:text-[#AC5DD9]'
        }`}
      >
        {rule.source === 'government' ? 'GOV' : 'CO'}
      </span>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-hz-text">{rule.label}</span>
          {rule.crewType !== 'all' && (
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                rule.crewType === 'cockpit'
                  ? 'bg-[rgba(0,99,247,0.10)] text-[#0063F7] dark:bg-[rgba(91,141,239,0.15)] dark:text-[#5B8DEF]'
                  : 'bg-[rgba(102,0,204,0.10)] text-[#6600CC] dark:bg-[rgba(172,93,217,0.15)] dark:text-[#AC5DD9]'
              }`}
            >
              {rule.crewType === 'cockpit' ? 'FD' : 'CC'}
            </span>
          )}
          {isLessRestrictive && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
        </div>
        {rule.legalReference && <span className="text-[13px] text-hz-text-tertiary">{rule.legalReference}</span>}
      </div>

      {/* Value — toggle for booleans, click-to-edit for others */}
      <div className="text-right shrink-0">
        {isBoolean ? (
          <button
            onClick={() => onRuleChange(rule._id, rule.value === 'true' ? 'false' : 'true')}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
            style={{ backgroundColor: rule.value === 'true' ? '#06C270' : '#8F90A6' }}
            title={rule.value === 'true' ? 'Enabled — click to disable' : 'Disabled — click to enable'}
          >
            <span
              className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: rule.value === 'true' ? 'translateX(22px)' : 'translateX(4px)' }}
            />
          </button>
        ) : editing ? (
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(rule.value)
                setEditing(false)
              }
            }}
            className="w-20 h-7 text-center text-[13px] font-bold font-mono rounded-md border-2 outline-none bg-hz-bg text-hz-text"
            style={{ borderColor: ACCENT }}
          />
        ) : (
          <button
            onClick={() => {
              setDraft(rule.value)
              setEditing(true)
            }}
            className={`text-[14px] font-bold hover:underline ${isFormula ? '' : 'font-mono tabular-nums'}`}
            style={isModified ? { color: ACCENT } : undefined}
            title={isFormula ? `Raw: ${rule.value} — Click to edit` : 'Click to edit'}
          >
            {isFormula ? humanizeValue(rule.value) : rule.value}
          </button>
        )}
        {rule.unit && !editing && !isBoolean && (
          <span className="text-[13px] text-hz-text-tertiary ml-1">{rule.unit}</span>
        )}
      </div>

      {/* Reset button (only when modified, not for booleans) */}
      {isModified && !editing && !isBoolean && (
        <button
          onClick={() => onRuleReset(rule._id)}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-lg hover:bg-amber-500/10 shrink-0"
          title={`Reset to ${rule.templateValue}`}
        >
          <RotateCcw size={12} className="text-amber-600" />
        </button>
      )}

      {/* Modified dot (not for booleans) */}
      {isModified && !editing && !isBoolean && (
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />
      )}
    </div>
  )
}

/* ─── Value Formatter ─── */

function formatValue(value: string): string {
  if (value === 'true') return 'Yes'
  if (value === 'false') return 'No'
  return value
}

/* ─── Display Formatter ─── */

function humanizeValue(value: string): string {
  // max(preceding_duty, 12h) → "Preceding duty or 12h (whichever is greater)"
  const maxMatch = value.match(/^max\((.+?),\s*(.+?)\)$/i)
  if (maxMatch) {
    const a = humanizeToken(maxMatch[1].trim())
    const b = humanizeToken(maxMatch[2].trim())
    return `${a} or ${b}, whichever is greater`
  }

  // min(preceding_duty, 12h) → "Preceding duty or 12h (whichever is less)"
  const minMatch = value.match(/^min\((.+?),\s*(.+?)\)$/i)
  if (minMatch) {
    const a = humanizeToken(minMatch[1].trim())
    const b = humanizeToken(minMatch[2].trim())
    return `${a} or ${b}, whichever is less`
  }

  // Single tokens like "preceding_duty"
  if (value.includes('_')) return humanizeToken(value)

  return value
}

function humanizeToken(token: string): string {
  // "12h" / "10h" → keep as-is
  if (/^\d+h$/i.test(token)) return token
  // "preceding_duty" → "Preceding duty"
  const words = token.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/* ─── Restrictiveness Check ─── */

function checkRestrictiveness(rule: FdtlRuleRef): boolean {
  if (!rule.templateValue || !rule.directionality) return false

  const current = parseFloat(rule.value.replace(':', '.')) || 0
  const template = parseFloat(rule.templateValue.replace(':', '.')) || 0

  if (rule.directionality === 'MAX_LIMIT') {
    // Higher value = less restrictive (more hours allowed)
    return current > template
  }
  if (rule.directionality === 'MIN_LIMIT') {
    // Lower value = less restrictive (less rest required)
    return current < template
  }
  return false
}
