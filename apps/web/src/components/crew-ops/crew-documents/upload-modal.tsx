'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { useCrewDocumentUpload } from './common/use-upload'

interface Props {
  open: boolean
  onClose: () => void
  onUploaded: () => Promise<unknown> | void
  crewId: string
  folderId: string
  folderName: string
  /** When set, this folder is a virtual sub-folder (expiry code); the modal
   *  then offers optional Last Done / Expiry Date fields that sync into
   *  CrewExpiryDate. */
  expiryCodeId?: string | null
}

export function UploadModal({ open, onClose, onUploaded, crewId, folderId, folderName, expiryCodeId }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const fileRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error, reset } = useCrewDocumentUpload()

  const today = new Date().toISOString().slice(0, 10)
  const [file, setFile] = useState<File | null>(null)
  const [lastDone, setLastDone] = useState<string>(today)
  const [expiryDate, setExpiryDate] = useState<string>('')
  const [description, setDescription] = useState<string>('')

  if (!open) return null

  const handleSubmit = async () => {
    if (!file) return
    await upload({
      crewId,
      file,
      folderId,
      expiryCodeId: expiryCodeId ?? null,
      description: description || null,
      lastDone: expiryCodeId && lastDone ? lastDone : null,
      expiryDate: expiryCodeId && expiryDate ? expiryDate : null,
    })
    await onUploaded()
    setFile(null)
    setLastDone(today)
    setExpiryDate('')
    setDescription('')
    reset()
    onClose()
  }

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-[min(520px,90vw)] max-h-[85vh] overflow-y-auto"
        style={{
          background: isDark ? '#191921' : '#FFFFFF',
          border: `1px solid ${border}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-2">
            <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
            <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
              Upload to {folderName}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100" aria-label="Close">
            <X size={18} style={{ color: palette.textSecondary }} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* File picker */}
          <div>
            <label
              className="text-[13px] uppercase tracking-wider font-medium mb-1.5 block"
              style={{ color: palette.textSecondary }}
            >
              File
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border border-dashed p-6 flex flex-col items-center gap-2 transition-colors"
              style={{
                borderColor: file ? accent : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                background: file ? `${accent}11` : 'transparent',
                color: palette.textSecondary,
              }}
            >
              <Upload size={18} style={{ color: accent }} />
              <p className="text-[13px] font-medium">{file ? file.name : 'Click to choose a file'}</p>
              <p className="text-[13px]" style={{ color: palette.textTertiary }}>
                JPG / PNG / WebP / PDF / Word / Excel — max 20 MB
              </p>
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setFile(f)
                e.target.value = ''
              }}
            />
          </div>

          {/* Optional description */}
          <div>
            <label
              className="text-[13px] uppercase tracking-wider font-medium mb-1.5 block"
              style={{ color: palette.textSecondary }}
            >
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-[13px] outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${border}`,
                color: palette.text,
              }}
            />
          </div>

          {/* Expiry-linked fields */}
          {expiryCodeId && (
            <div
              className="rounded-lg p-3"
              style={{
                background: `${accent}10`,
                border: `1px solid ${accent}33`,
              }}
            >
              <p className="text-[13px] font-semibold mb-2" style={{ color: accent }}>
                Link to expiry record
              </p>
              <p className="text-[13px] mb-3" style={{ color: palette.textTertiary }}>
                Filling these updates this crew member&apos;s recency for the selected code. Leave blank to just store
                the file without touching the expiry row.
              </p>
              <div className="grid gap-3 grid-cols-2">
                <DateField
                  label="Last Done"
                  value={lastDone}
                  onChange={setLastDone}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                />
                <DateField
                  label="Expiry Date (override)"
                  value={expiryDate}
                  onChange={setExpiryDate}
                  palette={palette}
                  isDark={isDark}
                  accent={accent}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-[13px]" style={{ color: '#E63535' }}>
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: border }}>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 rounded-lg text-[13px] font-medium"
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: palette.textSecondary,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!file || uploading}
            className="h-10 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: accent, color: 'white' }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload
          </button>
        </footer>
      </div>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
  palette,
  isDark,
  accent,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  palette: Palette
  isDark: boolean
  accent: string
}) {
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  return (
    <div>
      <label
        className="text-[13px] uppercase tracking-wider font-medium mb-1.5 block"
        style={{ color: palette.textSecondary }}
      >
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 h-10 px-3 rounded-lg text-[13px] outline-none"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${border}`,
          color: palette.text,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = accent
          e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}33`
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = border
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}
