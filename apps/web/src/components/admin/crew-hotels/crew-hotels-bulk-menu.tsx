'use client'

import { useState, useRef } from 'react'
import { api, type CrewHotelBulkResult } from '@skyhub/api'
import { Upload, Download, FileSpreadsheet, X } from 'lucide-react'

interface Props {
  onComplete: () => void
}

export function CrewHotelsBulkMenu({ onComplete }: Props) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<null | { type: 'details' | 'effective-dates' }>(null)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30"
      >
        <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} />
        Bulk
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-64 rounded-lg border border-hz-border bg-hz-card shadow-lg z-20 py-1 text-[13px]">
          <MenuItem
            label="Download Hotel Details Template"
            icon={Download}
            onClick={() => {
              window.open(api.crewHotelTemplateUrl('details'), '_blank')
              setOpen(false)
            }}
          />
          <MenuItem
            label="Download Effective Dates Template"
            icon={Download}
            onClick={() => {
              window.open(api.crewHotelTemplateUrl('effective-dates'), '_blank')
              setOpen(false)
            }}
          />
          <div className="my-1 h-px bg-hz-border" />
          <MenuItem
            label="Upload Hotel Details"
            icon={Upload}
            onClick={() => {
              setModal({ type: 'details' })
              setOpen(false)
            }}
          />
          <MenuItem
            label="Upload Hotel Effective Dates"
            icon={Upload}
            onClick={() => {
              setModal({ type: 'effective-dates' })
              setOpen(false)
            }}
          />
        </div>
      )}
      {modal && (
        <UploadModal
          type={modal.type}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null)
            onComplete()
          }}
        />
      )}
    </div>
  )
}

function MenuItem({ label, icon: Icon, onClick }: { label: string; icon: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hz-border/20">
      <Icon className="h-3.5 w-3.5 text-hz-text-secondary" />
      {label}
    </button>
  )
}

function UploadModal({
  type,
  onClose,
  onSuccess,
}: {
  type: 'details' | 'effective-dates'
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CrewHotelBulkResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const title = type === 'details' ? 'Upload Hotel Details' : 'Upload Hotel Effective Dates'

  const parseXlsxToCsv = async (f: File): Promise<File> => {
    const XLSX = await import('xlsx')
    const buf = await f.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    return new File([csv], f.name.replace(/\.xlsx?$/i, '.csv'), { type: 'text/csv' })
  }

  const handleFile = async (f: File) => {
    setError('')
    setPreview(null)
    let toUpload = f
    if (/\.xlsx?$/i.test(f.name)) {
      try {
        toUpload = await parseXlsxToCsv(f)
      } catch (e) {
        setError('Failed to parse XLSX file')
        return
      }
    }
    setFile(toUpload)
    setUploading(true)
    try {
      const result = await api.uploadCrewHotelBulk(type, toUpload, true)
      setPreview(result)
    } catch (e: any) {
      setError(e.message || 'Validation failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCommit = async () => {
    if (!file) return
    setCommitting(true)
    setError('')
    try {
      await api.uploadCrewHotelBulk(type, file, false)
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-hz-bg border border-hz-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-hz-border">
          <span className="text-[15px] font-semibold">{title}</span>
          <button onClick={onClose} className="text-hz-text-secondary hover:text-hz-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!file && (
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-hz-border rounded-xl py-12 flex flex-col items-center justify-center cursor-pointer hover:border-module-accent"
            >
              <Upload className="h-8 w-8 text-hz-text-secondary mb-2" />
              <div className="text-[13px] font-medium">Click to select a file</div>
              <div className="text-[13px] text-hz-text-secondary mt-1">.csv or .xlsx</div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {uploading && <div className="text-[13px] text-hz-text-secondary">Validating…</div>}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <Stat label="Total Rows" value={preview.totalRows} />
                <Stat label="Will Create" value={preview.created} tone="success" />
                <Stat label="Will Update" value={preview.updated} tone="info" />
                <Stat
                  label="Errors"
                  value={preview.errors.length}
                  tone={preview.errors.length > 0 ? 'danger' : 'default'}
                />
              </div>

              {preview.errors.length > 0 && (
                <div>
                  <div className="text-[13px] font-medium mb-2">Errors</div>
                  <div className="border border-hz-border rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-[13px]">
                      <thead className="bg-hz-card text-hz-text-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Row</th>
                          <th className="px-3 py-2 text-left font-medium">Field</th>
                          <th className="px-3 py-2 text-left font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.errors.map((e: { row: number; field?: string; reason: string }, i: number) => (
                          <tr key={i} className="border-t border-hz-border">
                            <td className="px-3 py-1.5">{e.row}</td>
                            <td className="px-3 py-1.5">{e.field ?? '—'}</td>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className="text-[13px] text-red-500">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-hz-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30"
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={!preview || committing || (preview && preview.created + preview.updated === 0)}
            className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50"
          >
            {committing ? 'Uploading…' : 'Confirm & Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'info' | 'danger'
}) {
  const toneClass = {
    default: 'text-hz-text',
    success: 'text-green-600 dark:text-green-400',
    info: 'text-blue-600 dark:text-blue-400',
    danger: 'text-red-600 dark:text-red-400',
  }[tone]
  return (
    <div className="border border-hz-border rounded-lg px-3 py-2">
      <div className="text-[13px] text-hz-text-secondary">{label}</div>
      <div className={`text-[15px] font-bold ${toneClass}`}>{value}</div>
    </div>
  )
}
