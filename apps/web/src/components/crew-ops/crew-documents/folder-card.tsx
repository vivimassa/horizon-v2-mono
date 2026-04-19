'use client'

import type { CrewDocumentFolderWithCountsRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { folderVisual, rgba } from './common/document-icons'
import type { ExpiryInfo } from './folder-view'

interface Props {
  folder: CrewDocumentFolderWithCountsRef
  isSubfolder?: boolean
  /** Read-only expiry status mirrored from `CrewExpiryDate` — only shown
   *  on virtual sub-folders (where `expiryCodeId` is set). */
  expiry?: ExpiryInfo | null
  onClick: () => void
}

const STATUS_COLOR: Record<'valid' | 'warning' | 'expired' | 'unknown', string> = {
  valid: '#06C270',
  warning: '#FF8800',
  expired: '#E63535',
  unknown: '#555770',
}

export function FolderCard({ folder, isSubfolder, expiry, onClick }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const vis = folderVisual(folder.slug)
  const Icon = vis.icon

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const hoverShadow = isDark ? '0 4px 12px rgba(0,0,0,0.35)' : '0 2px 6px rgba(96,97,112,0.10)'

  const dotColor = expiry ? STATUS_COLOR[expiry.status] : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 rounded-xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
        border: `1px solid ${border}`,
        boxShadow: isDark ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(96,97,112,0.06)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = hoverShadow
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isDark ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(96,97,112,0.06)'
      }}
    >
      {dotColor && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{
            background: dotColor,
            boxShadow: `0 0 0 2px ${isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'}`,
          }}
          title={
            expiry?.expiryDate
              ? `${expiry.status.toUpperCase()} — expires ${expiry.expiryDate}`
              : (expiry?.status ?? 'unknown').toUpperCase()
          }
        />
      )}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: rgba(vis.tint, 0.12) }}
      >
        <Icon size={22} style={{ color: vis.tint }} />
      </div>
      <div className="text-center">
        <p
          className={`${isSubfolder ? 'text-[13px]' : 'text-[13px]'} font-semibold leading-tight`}
          style={{ color: palette.text }}
        >
          {folder.name}
        </p>
        <p className="text-[13px] mt-0.5 leading-tight" style={{ color: palette.textTertiary }}>
          {folder.documentCount} {folder.documentCount === 1 ? 'file' : 'files'}
          {!isSubfolder && folder.subfolderCount > 0 ? ` · ${folder.subfolderCount} folders` : ''}
        </p>
        {expiry?.expiryDate && (
          <p className="text-[13px] mt-0.5 leading-tight" style={{ color: dotColor ?? undefined }}>
            {expiry.expiryDate}
          </p>
        )}
      </div>
    </button>
  )
}
