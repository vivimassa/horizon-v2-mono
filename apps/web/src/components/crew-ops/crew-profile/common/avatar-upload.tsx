'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2, UserRound } from 'lucide-react'
import { authedFetch } from '@/lib/authed-fetch'
import { getApiBaseUrl } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from './draft-helpers'

interface Props {
  crewId: string | null
  photoUrl: string | null
  firstName: string
  lastName: string
  status: 'active' | 'inactive' | 'suspended' | 'terminated'
  disabled?: boolean
  onChange: (newUrl: string | null) => void
}

function initials(first: string, last: string): string {
  const a = (first || '').trim().charAt(0)
  const b = (last || '').trim().charAt(0)
  return (a + b).toUpperCase() || '??'
}

function statusDotColor(status: Props['status']): string {
  if (status === 'active') return '#06C270' // XD success
  if (status === 'suspended') return '#FF8800' // XD warning
  if (status === 'terminated') return '#E63535' // XD error
  return '#555770' // XD neutral (offline badge color)
}

export function CrewAvatarUpload({ crewId, photoUrl, firstName, lastName, status, disabled, onChange }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fullUrl = photoUrl ? `${getApiBaseUrl()}${photoUrl}` : null

  const handleFile = async (file: File) => {
    if (!crewId) {
      setError('Save the crew member first, then upload a photo.')
      return
    }
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
      const res = await authedFetch(`${getApiBaseUrl()}/crew/${crewId}/avatar`, { method: 'POST', body: form })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const data = (await res.json()) as { photoUrl: string }
      onChange(data.photoUrl)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!crewId) {
      onChange(null)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const res = await authedFetch(`${getApiBaseUrl()}/crew/${crewId}/avatar`, { method: 'DELETE' })
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
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden shrink-0"
          style={{
            background: fullUrl ? undefined : `${crewAccent(isDark)}22`,
            border: `1px solid ${border}`,
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.35)' : '0 4px 12px rgba(96,97,112,0.15)',
          }}
        >
          {fullUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fullUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : firstName || lastName ? (
            <span className="text-[28px] font-semibold" style={{ color: crewAccent(isDark) }}>
              {initials(firstName, lastName)}
            </span>
          ) : (
            <UserRound size={34} style={{ color: palette.textTertiary }} />
          )}
        </div>
        <div
          className="absolute bottom-1 right-1 w-3 h-3 rounded-full"
          style={{
            background: statusDotColor(status),
            boxShadow: `0 0 0 2px ${isDark ? '#191921' : '#FFFFFF'}`,
          }}
          title={status}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="h-8 px-2.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity disabled:opacity-40"
            style={{ background: crewAccent(isDark), color: 'white' }}
          >
            <Upload size={12} />
            {uploading ? 'Uploading…' : fullUrl ? 'Replace' : 'Upload'}
          </button>
          {fullUrl && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={handleRemove}
              className="h-8 px-2.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-opacity disabled:opacity-40"
              style={{ background: 'transparent', border: `1px solid ${border}`, color: palette.textSecondary }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {error && (
          <p className="text-[13px] max-w-[180px] text-center" style={{ color: '#E63535' }}>
            {error}
          </p>
        )}
        {!crewId && !error && (
          <p className="text-[13px] text-center max-w-[180px]" style={{ color: palette.textTertiary }}>
            Save the new crew first, then upload a photo.
          </p>
        )}
      </div>
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
  )
}
