'use client'

import { useCallback, useState } from 'react'
import { getApiBaseUrl, type CrewDocumentUploadResult } from '@skyhub/api'
import { authedFetch } from '@/lib/authed-fetch'

interface UploadArgs {
  crewId: string
  file: File
  folderId: string
  expiryCodeId?: string | null
  description?: string | null
  lastDone?: string | null
  expiryDate?: string | null
}

/**
 * Hook for multipart file upload against `POST /crew/:crewId/documents`.
 * Uses `authedFetch` (auto-attaches JWT + refresh-on-401) and hits the
 * runtime API base URL from `@skyhub/api` — so the same code path works
 * in local dev and production without any host hardcoding.
 */
export function useCrewDocumentUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (args: UploadArgs): Promise<CrewDocumentUploadResult> => {
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', args.file)
      form.append('folderId', args.folderId)
      if (args.expiryCodeId) form.append('expiryCodeId', args.expiryCodeId)
      if (args.description) form.append('description', args.description)
      if (args.lastDone) form.append('lastDone', args.lastDone)
      if (args.expiryDate) form.append('expiryDate', args.expiryDate)

      const res = await authedFetch(`${getApiBaseUrl()}/crew/${encodeURIComponent(args.crewId)}/documents`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const json = (await res.json()) as CrewDocumentUploadResult
      setProgress(100)
      return json
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      throw e
    } finally {
      setUploading(false)
    }
  }, [])

  return { upload, uploading, progress, error, reset: () => setError(null) }
}
