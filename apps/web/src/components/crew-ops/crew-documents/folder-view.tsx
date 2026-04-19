'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Folder as FolderIcon } from 'lucide-react'
import {
  useCrewDocumentFolders,
  useCrewDocuments,
  useCrewProfile,
  useInvalidateCrewDocuments,
  type CrewDocumentFolderWithCountsRef,
  type CrewDocumentStatusRef,
} from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { FolderCard } from './folder-card'
import { DocumentList } from './document-list'
import { UploadModal } from './upload-modal'

interface Props {
  crewId: string | null
  selectedCrew: CrewDocumentStatusRef | null
  hasRunQuery: boolean
}

interface CrumbEntry {
  folder: CrewDocumentFolderWithCountsRef
}

export type ExpiryStatus = 'valid' | 'warning' | 'expired' | 'unknown'

export interface ExpiryInfo {
  status: ExpiryStatus
  expiryDate: string | null
  lastDone: string | null
}

export function FolderView({ crewId, selectedCrew, hasRunQuery }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const [crumbs, setCrumbs] = useState<CrumbEntry[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)

  const activeCrewId = crewId ?? ''
  const currentFolder = crumbs.at(-1)?.folder ?? null
  const currentParentId = currentFolder?._id ?? null

  const foldersQuery = useCrewDocumentFolders(activeCrewId || null, currentParentId)
  const folders = foldersQuery.data ?? []

  const isVirtualSub = currentFolder && 'isVirtual' in currentFolder && currentFolder.isVirtual
  const showDocuments = currentFolder && (isVirtualSub || currentFolder.subfolderCount === 0)
  const docsQuery = useCrewDocuments(
    activeCrewId || null,
    showDocuments
      ? isVirtualSub
        ? { expiryCodeId: currentFolder.expiryCodeId ?? currentFolder._id }
        : { folderId: currentFolder._id }
      : undefined,
  )

  // Read-only expiry map for the selected crew — single source of truth is
  // the Crew Profile endpoint's `expiryDates` array (Qualifications & Expiries
  // tab). We index by expiryCodeId so FolderCard / DocumentList can show
  // the valid / warning / expired status without edit UX.
  const profileQuery = useCrewProfile(activeCrewId || null)
  const expiryMap = useMemo(() => {
    const map = new Map<string, ExpiryInfo>()
    for (const e of profileQuery.data?.expiryDates ?? []) {
      if (!e.expiryCodeId) continue
      // If multiple aircraftType rows exist for the same code, keep the
      // earliest (worst) expiry — that's the one the user needs to see.
      const prev = map.get(e.expiryCodeId)
      const candidate: ExpiryInfo = {
        status: e.status,
        expiryDate: e.expiryDate ?? null,
        lastDone: e.lastDone ?? null,
      }
      if (!prev) {
        map.set(e.expiryCodeId, candidate)
      } else if ((candidate.expiryDate ?? '9999-99-99') < (prev.expiryDate ?? '9999-99-99')) {
        map.set(e.expiryCodeId, candidate)
      }
    }
    return map
  }, [profileQuery.data])

  const invalidate = useInvalidateCrewDocuments()

  const openFolder = (f: CrewDocumentFolderWithCountsRef) => {
    setCrumbs((prev) => [...prev, { folder: f }])
  }
  const jumpTo = (index: number) => {
    setCrumbs((prev) => prev.slice(0, index + 1))
  }

  if (!crewId || !selectedCrew) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: `${accent}1a` }}
        >
          <FolderIcon size={28} style={{ color: accent }} />
        </div>
        <h3 className="text-[15px] font-bold mb-1" style={{ color: palette.text }}>
          Crew Documents & Training Records
        </h3>
        <p className="text-[13px] max-w-[460px]" style={{ color: palette.textTertiary }}>
          {hasRunQuery
            ? 'Select a crew member from the list on the right to view their documents.'
            : 'Set your selection criteria on the left and click Go to load the crew list, then pick a crew to view their documents.'}{' '}
          Training Documents sub-folders come from the active Crew Expiry Codes (5.4.3), so anything uploaded to e.g.{' '}
          <em>CRM Training</em> also updates the crew&apos;s recency record.
        </p>
      </div>
    )
  }

  const fullName = [selectedCrew.firstName, selectedCrew.middleName, selectedCrew.lastName].filter(Boolean).join(' ')

  const uploadTargetFolderId = isVirtualSub
    ? (crumbs.at(-2)?.folder._id ?? currentFolder?._id ?? '')
    : (currentFolder?._id ?? '')
  const uploadTargetExpiryCode = isVirtualSub ? (currentFolder?.expiryCodeId ?? currentFolder?._id) : null
  const uploadTargetName = currentFolder?.name ?? ''

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-4 pb-3 border-b" style={{ borderColor: border }}>
        <h1 className="text-[20px] font-semibold" style={{ color: palette.text }}>
          {fullName}
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: palette.textTertiary }}>
          {selectedCrew.employeeId}
          {selectedCrew.position ? ` · ${selectedCrew.position}` : ''}
          {selectedCrew.baseLabel ? ` · ${selectedCrew.baseLabel}` : ''} · Coverage {selectedCrew.coverage}%
          {selectedCrew.expiredTrainingCount > 0 && (
            <span style={{ color: '#E63535' }}> · {selectedCrew.expiredTrainingCount} expired</span>
          )}
          {selectedCrew.warningTrainingCount > 0 && (
            <span style={{ color: '#FF8800' }}> · {selectedCrew.warningTrainingCount} expiring</span>
          )}
        </p>
        <nav className="flex items-center gap-1.5 mt-3 flex-wrap">
          <button
            type="button"
            onClick={() => setCrumbs([])}
            className="text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ color: crumbs.length === 0 ? palette.text : accent }}
          >
            Crew Documents
          </button>
          {crumbs.map((c, i) => (
            <span key={c.folder._id} className="flex items-center gap-1.5">
              <ChevronRight size={12} style={{ color: palette.textTertiary }} />
              <button
                type="button"
                onClick={() => jumpTo(i)}
                className="text-[13px] font-medium transition-opacity hover:opacity-80"
                style={{ color: i === crumbs.length - 1 ? palette.text : accent }}
              >
                {c.folder.name}
              </button>
            </span>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {foldersQuery.isLoading ? (
          <p className="text-[13px]" style={{ color: palette.textTertiary }}>
            Loading folders…
          </p>
        ) : folders.length > 0 ? (
          <div
            className={`grid gap-3 ${
              crumbs.length === 0 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'
            }`}
          >
            {folders.map((f) => {
              const exp = f.expiryCodeId ? expiryMap.get(f.expiryCodeId) : null
              return (
                <FolderCard
                  key={f._id}
                  folder={f}
                  isSubfolder={crumbs.length > 0}
                  expiry={exp ?? null}
                  onClick={() => openFolder(f)}
                />
              )
            })}
          </div>
        ) : null}

        {showDocuments && currentFolder && (
          <div
            className="rounded-xl p-5"
            style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${border}`,
              boxShadow: isDark ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(96,97,112,0.06)',
            }}
          >
            <DocumentList
              crewId={activeCrewId}
              documents={docsQuery.data ?? []}
              loading={docsQuery.isLoading}
              expiryMap={expiryMap}
              onUploadClick={() => setUploadOpen(true)}
              onDeleted={async () => {
                await invalidate.invalidateForCrew(activeCrewId)
              }}
            />
          </div>
        )}
      </div>

      {currentFolder && uploadTargetFolderId && (
        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUploaded={async () => {
            await invalidate.invalidateForCrew(activeCrewId)
          }}
          crewId={activeCrewId}
          folderId={uploadTargetFolderId}
          folderName={uploadTargetName}
          expiryCodeId={uploadTargetExpiryCode}
        />
      )}
    </div>
  )
}
