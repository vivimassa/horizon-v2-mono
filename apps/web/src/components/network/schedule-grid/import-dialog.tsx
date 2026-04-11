'use client'

import { useState, useCallback } from 'react'
import { Upload, X, FileSpreadsheet, AlertCircle, Check, Download } from 'lucide-react'
import { getApiBaseUrl } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { authedFetch } from '@/lib/authed-fetch'
import { getOperatorId } from '@/stores/use-operator-store'

interface ImportDialogProps {
  seasonCode: string
  scenarioId?: string
  onClose: () => void
  onImported: () => void
}

export function ImportDialog({ seasonCode, scenarioId, onClose, onImported }: ImportDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors?: { row: number; message: string }[] } | null>(null)
  const [error, setError] = useState('')

  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  const handleImport = useCallback(async () => {
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const url = `${getApiBaseUrl()}/ssim/import?operatorId=${getOperatorId()}&seasonCode=${seasonCode}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`
      const res = await authedFetch(url, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
      onImported()
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [file, seasonCode, scenarioId, onImported])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4"
        style={{
          backgroundColor: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 12px 48px rgba(0,0,0,0.5)' : '0 12px 48px rgba(96,97,112,0.18)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.08)' }}
            >
              <Upload size={16} className="text-module-accent" />
            </div>
            <h2 className="text-[16px] font-bold text-hz-text">Import Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={15} className="text-hz-text-tertiary" />
          </button>
        </div>

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
              style={{ borderColor: file ? 'var(--color-module-accent)' : border }}
              onClick={() => document.getElementById('ssim-file-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) setFile(f)
              }}
              onMouseEnter={(e) => {
                if (!file) e.currentTarget.style.borderColor = 'var(--color-module-accent)'
              }}
              onMouseLeave={(e) => {
                if (!file) e.currentTarget.style.borderColor = border
              }}
            >
              <input
                id="ssim-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet size={18} className="text-module-accent" />
                  <span className="text-[14px] font-medium text-hz-text">{file.name}</span>
                  <span className="text-[12px] text-hz-text-tertiary">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto text-hz-text-tertiary mb-2" />
                  <p className="text-[14px] font-medium text-hz-text-secondary">
                    Drop .xlsx file here or click to browse
                  </p>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      // Download .xlsx template from server
                      const res = await authedFetch(`${getApiBaseUrl()}/ssim/template?operatorId=${getOperatorId()}`)
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'schedule-import-template.xlsx'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="inline-flex items-center gap-1 mt-2 text-[12px] font-medium text-module-accent hover:underline"
                  >
                    <Download size={11} />
                    Download import template (.xlsx)
                  </button>
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: 'rgba(230,53,53,0.08)', border: `1px solid rgba(230,53,53,0.15)` }}
              >
                <AlertCircle size={14} style={{ color: '#E63535' }} />
                <span className="text-[13px] font-medium" style={{ color: '#E63535' }}>
                  {error}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="h-10 px-5 rounded-lg text-[13px] font-medium text-hz-text-secondary transition-colors"
                style={{ border: `1px solid ${border}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="h-10 px-5 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Success */}
            <div className="flex items-center gap-3 py-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(6,194,112,0.12)' }}
              >
                <Check size={20} style={{ color: '#06C270' }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-hz-text">{result.imported} flights imported</p>
                {result.errors && result.errors.length > 0 && (
                  <p className="text-[13px] text-hz-text-secondary">{result.errors.length} rows skipped</p>
                )}
              </div>
            </div>

            {/* Errors list */}
            {result.errors && result.errors.length > 0 && (
              <div
                className="max-h-32 overflow-y-auto rounded-lg p-2.5 space-y-1"
                style={{
                  border: `1px solid ${border}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}
              >
                {result.errors.map((e, i) => (
                  <p key={i} className="text-[12px] text-hz-text-secondary font-mono">
                    Row {e.row}: {e.message}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full h-10 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
