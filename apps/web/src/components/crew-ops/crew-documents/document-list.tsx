'use client'

import { Eye, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { api, getApiBaseUrl, type CrewDocumentRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import type { ExpiryInfo } from './folder-view'

interface Props {
  documents: CrewDocumentRef[]
  loading: boolean
  /** Read-only expiry info indexed by expiryCodeId. Drives the per-row
   *  status chip; edits happen in Crew Profile. */
  expiryMap: Map<string, ExpiryInfo>
  onUploadClick: () => void
  onDeleted: () => Promise<unknown> | void
  crewId: string
}

const STATUS_COLOR: Record<'valid' | 'warning' | 'expired' | 'unknown', string> = {
  valid: '#06C270',
  warning: '#FF8800',
  expired: '#E63535',
  unknown: '#555770',
}

export function DocumentList({ documents, loading, expiryMap, onUploadClick, onDeleted, crewId }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document? The file will be permanently removed.')) return
    await api.deleteCrewDocument(crewId, docId)
    await onDeleted()
  }

  const handlePreview = (doc: CrewDocumentRef) => {
    window.open(`${getApiBaseUrl()}${doc.fileUrl}`, '_blank')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: palette.textSecondary }}>
          Documents ({documents.length})
        </h4>
        <button
          type="button"
          onClick={onUploadClick}
          className="h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ background: accent, color: 'white' }}
        >
          <Upload size={13} />
          Upload
        </button>
      </div>

      {loading ? (
        <p className="text-[13px]" style={{ color: palette.textTertiary }}>
          Loading…
        </p>
      ) : documents.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-6 text-center"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
            color: palette.textTertiary,
          }}
        >
          <p className="text-[13px]">No files yet. Click Upload to add one.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => {
            const isImage = d.mimeType?.startsWith('image/') ?? false
            const exp = d.expiryCodeId ? expiryMap.get(d.expiryCodeId) : null
            const expColor = exp ? STATUS_COLOR[exp.status] : null
            return (
              <li
                key={d._id}
                className="flex items-center gap-3 rounded-lg p-3"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${border}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                  style={{ background: `${accent}1a` }}
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${getApiBaseUrl()}${d.fileUrl}`}
                      alt={d.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : d.mimeType === 'application/pdf' ? (
                    <FileText size={16} style={{ color: accent }} />
                  ) : (
                    <ImageIcon size={16} style={{ color: accent }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: palette.text }}>
                    {d.fileName}
                  </p>
                  <p className="text-[13px] truncate" style={{ color: palette.textTertiary }}>
                    {formatBytes(d.fileSize)} · {new Date(d.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                {exp && expColor && (
                  <span
                    className="text-[13px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: `${expColor}22`, color: expColor }}
                    title={
                      exp.expiryDate
                        ? `${exp.status} — expires ${exp.expiryDate}${exp.lastDone ? ` · last done ${exp.lastDone}` : ''}`
                        : exp.status
                    }
                  >
                    {exp.status}
                    {exp.expiryDate ? ` · ${exp.expiryDate.slice(5)}` : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handlePreview(d)}
                  className="h-10 w-10 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100"
                  title="Preview"
                >
                  <Eye size={14} style={{ color: palette.textSecondary }} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(d._id)}
                  className="h-10 w-10 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={14} style={{ color: '#E63535' }} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}
