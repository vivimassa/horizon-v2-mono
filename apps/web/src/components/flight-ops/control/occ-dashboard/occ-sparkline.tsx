'use client'

interface OccSparklineProps {
  data: number[]
  /** Stroke + gradient fill color. Defaults to CSS var `--occ-accent`. */
  color?: string
  filled?: boolean
  className?: string
  width?: number
  height?: number
}

export function OccSparkline({ data, color, filled = true, className, width = 200, height = 32 }: OccSparklineProps) {
  if (data.length < 2) return <svg className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden />
  const stroke = color ?? 'var(--occ-accent)'
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const pts = data.map(
    (v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 6)).toFixed(1)}`,
  )
  const linePath = 'M ' + pts.join(' L ')
  const gradId = `occ-sp-${Math.abs(hashCode(pts.join('|'))).toString(36)}`
  const fillPath = filled ? `${linePath} L ${((data.length - 1) * step).toFixed(1)} ${height} L 0 ${height} Z` : null
  const lastIdx = data.length - 1
  const lastX = lastIdx * step
  const lastY = height - 2 - ((data[lastIdx] - min) / range) * (height - 6)
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {filled && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {fillPath && <path d={fillPath} fill={`url(#${gradId})`} />}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
    </svg>
  )
}

function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}
