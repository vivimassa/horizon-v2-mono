'use client'

import { useRef, useState, type DragEvent } from 'react'
import { FileUp, FileText, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface FileFieldProps {
  /** Currently-selected file (controlled). Pass null for empty. */
  value: File | null
  onChange: (file: File | null) => void
  /** Comma-separated list of accepted extensions/MIME types. e.g. ".txt,.ssim,.dat" */
  accept?: string
  /** Short prompt shown when no file is selected. */
  placeholder?: string
  /** Optional secondary-line hint (e.g. "Drop a Chapter-7 SSIM file"). */
  hint?: string
}

/**
 * Drag-and-drop file picker matching the glass aesthetic of the filter
 * panel kit. Shows a filename + size preview when a file is selected,
 * with an X to clear. Native `<input type="file">` remains the fallback
 * — clicking the tile triggers it for accessibility + mobile support.
 */
export function FileField({
  value,
  onChange,
  accept,
  placeholder = 'Drop a file or click to browse',
  hint,
}: FileFieldProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const surfaceBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)'
  const surfaceBgHover = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.85)'
  const borderBase = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'
  const borderActive = 'var(--module-accent, #1e40af)'
  const text = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)'
  const textMuted = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(15,23,42,0.55)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.40)'

  const borderColor = dragOver || value ? borderActive : borderBase

  function handleFile(file: File | null) {
    onChange(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="w-full rounded-xl transition-all duration-150 cursor-pointer"
        style={{
          background: dragOver ? surfaceBgHover : surfaceBg,
          border: `1.5px dashed ${borderColor}`,
          padding: value ? '10px 12px' : '16px 12px',
        }}
        onMouseEnter={(e) => {
          if (!value) e.currentTarget.style.borderColor = borderActive
        }}
        onMouseLeave={(e) => {
          if (!value && !dragOver) e.currentTarget.style.borderColor = borderBase
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        {value ? (
          <div className="flex items-center gap-2.5">
            <div
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--module-accent, #1e40af) 14%, transparent)' }}
            >
              <FileText size={15} strokeWidth={1.8} className="text-module-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: text }}>
                {value.name}
              </div>
              <div className="text-[11px]" style={{ color: textTertiary }}>
                {(value.size / 1024).toFixed(0)} KB
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
              style={{ color: textMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="Clear selected file"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1.5">
            <FileUp size={20} strokeWidth={1.6} style={{ color: textMuted }} />
            <div className="text-[13px] font-medium text-center" style={{ color: text }}>
              {placeholder}
            </div>
            {hint && (
              <div className="text-[11px] text-center" style={{ color: textTertiary }}>
                {hint}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
