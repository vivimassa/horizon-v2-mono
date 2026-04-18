import type { ReactNode } from 'react'

const MODULE_CODE_RE = /\s·\s(\d+(?:\.\d+)*)$/

export function BandHead({ tag, hint }: { tag: string; hint?: string }) {
  const match = tag.match(MODULE_CODE_RE)
  const title = match && typeof match.index === 'number' ? tag.slice(0, match.index) : tag
  const moduleCode = match ? match[1] : null

  return (
    <div className="flex items-center gap-2.5 mx-0.5 mb-2 mt-1">
      <span
        className="w-[3px] h-[18px] rounded-[2px] shadow-[0_0_8px_var(--occ-accent-tint)]"
        style={{ background: 'var(--occ-accent)' }}
        aria-hidden
      />
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-[var(--occ-text)]">{title}</span>
      {moduleCode && (
        <span className="font-mono text-[10.5px] text-[var(--occ-text-3)] px-1.5 py-[2px] border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded">
          {moduleCode}
        </span>
      )}
      <span className="flex-1 h-px bg-[rgba(17,17,24,0.08)] dark:bg-white/10" />
      {hint && <span className="text-[11.5px] text-[var(--occ-text-3)]">{hint}</span>}
    </div>
  )
}

export type StatTone = 'ok' | 'warn' | 'err' | 'info'

const STAT_TONE_CLASS: Record<StatTone, string> = {
  ok: 'text-[#06C270]',
  warn: 'text-[#FF8800]',
  err: 'text-[#FF3B3B]',
  info: 'text-[#5AA1FF]',
}

export function StatStrip({
  cells,
  tight,
}: {
  cells: { label: string; value: number; tone: StatTone }[]
  tight?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-4 bg-[rgba(17,17,24,0.04)] dark:bg-white/5 rounded-lg py-2 ${
        tight ? 'mb-1' : 'mt-1.5'
      }`}
    >
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`text-center px-1.5 ${
            i < cells.length - 1 ? 'border-r border-[rgba(17,17,24,0.08)] dark:border-white/10' : ''
          }`}
        >
          <div
            className={`text-[17px] font-bold leading-none tabular-nums tracking-[-0.01em] font-mono ${STAT_TONE_CLASS[c.tone]}`}
          >
            {c.value}
          </div>
          <div className="text-[10.5px] tracking-[.08em] uppercase text-[var(--occ-text-3)] mt-[3px] font-semibold">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}

export function OccEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5 gap-2 text-[var(--occ-text-2)]">
      <div className="w-9 h-9 rounded-full bg-[rgba(6,194,112,0.16)] text-[#06C270] grid place-items-center">✓</div>
      <div className="text-[12.5px] font-medium">{message}</div>
    </div>
  )
}

export function Th({ children, align }: { children: ReactNode; align?: 'right' }) {
  return (
    <th
      className={`text-left font-semibold text-[10.5px] uppercase tracking-[.08em] text-[var(--occ-text-3)] pb-1.5 px-1.5 border-b border-[rgba(17,17,24,0.08)] dark:border-white/10 ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align,
  mono,
  className = '',
}: {
  children: ReactNode
  align?: 'right'
  mono?: boolean
  className?: string
}) {
  return (
    <td
      className={`h-[34px] px-1.5 border-b border-dashed border-[rgba(17,17,24,0.08)] dark:border-white/10 ${
        align === 'right' ? 'text-right' : ''
      } ${mono ? 'font-mono text-[11.5px] text-[var(--occ-text-2)]' : ''} ${className}`}
    >
      {children}
    </td>
  )
}

export function Sev({ tone, children }: { tone: 'high' | 'med' | 'low'; children: ReactNode }) {
  const classes =
    tone === 'high'
      ? 'bg-[rgba(255,59,59,0.16)] text-[#FF3B3B]'
      : tone === 'med'
        ? 'bg-[rgba(255,136,0,0.16)] text-[#FF8800]'
        : 'bg-[rgba(6,194,112,0.16)] text-[#06C270]'
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10.5px] font-bold ml-1.5 ${classes}`}
    >
      {children}
    </span>
  )
}

export function CodeChip({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] px-1.5 py-[2px] bg-[rgba(17,17,24,0.05)] dark:bg-white/10 rounded border border-[rgba(17,17,24,0.08)] dark:border-white/10 text-[var(--occ-text-2)]">
      {children}
    </span>
  )
}

export function fmtHm(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`
}

export function formatRelative(iso: string): string {
  const now = Date.now()
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = t - now
  const absMin = Math.abs(Math.round(diff / 60_000))
  if (absMin < 60) return diff >= 0 ? `+${absMin}m` : `−${absMin}m`
  const hrs = Math.round(absMin / 60)
  return diff >= 0 ? `+${hrs}h` : `−${hrs}h`
}
