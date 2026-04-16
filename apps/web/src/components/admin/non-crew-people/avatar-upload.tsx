'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2, Contact } from 'lucide-react'
import { authedFetch } from '@/lib/authed-fetch'
import { getApiBaseUrl } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface AvatarUploadProps {
  personId: string
  avatarUrl: string | null
  disabled?: boolean
  onChange: (newUrl: string | null) => void
}

export function AvatarUpload({ personId, avatarUrl, disabled, onChange }: AvatarUploadProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fullUrl = avatarUrl ? `${getApiBaseUrl()}${avatarUrl}` : null

  const handleFile = async (file: File) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Max file size 2 MB')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await authedFetch(`${getApiBaseUrl()}/non-crew-people/${personId}/avatar`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const data = (await res.json()) as { avatarUrl: string }
      onChange(data.avatarUrl)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setUploading(true)
    setError(null)
    try {
      const res = await authedFetch(`${getApiBaseUrl()}/non-crew-people/${personId}/avatar`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      onChange(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}
      >
        {fullUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fullUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <Contact size={32} style={{ color: palette.textTertiary }} />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity disabled:opacity-40"
            style={{
              background: 'var(--module-accent, #1e40af)',
              color: 'white',
            }}
          >
            <Upload size={13} />
            {uploading ? 'Uploading…' : fullUrl ? 'Replace' : 'Upload'}
          </button>
          {fullUrl && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={handleRemove}
              className="h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-opacity disabled:opacity-40"
              style={{
                background: 'transparent',
                border: `1px solid ${border}`,
                color: palette.textSecondary,
              }}
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
        <p className="text-[11px]" style={{ color: palette.textTertiary }}>
          JPG, PNG, or WebP — max 2 MB
        </p>
        {error && (
          <p className="text-[12px]" style={{ color: '#E63535' }}>
            {error}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
