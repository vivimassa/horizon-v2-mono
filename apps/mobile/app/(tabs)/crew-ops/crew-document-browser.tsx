import { useCallback, useEffect, useMemo, useState } from 'react'
import { Text as RNText, View, ScrollView, Pressable, Image, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  api,
  getApiBaseUrl,
  type CrewDocumentFolderWithCountsRef,
  type CrewDocumentRef,
  type CrewDocumentStatusRef,
  type FullCrewProfileRef,
} from '@skyhub/api'
import {
  ChevronLeft,
  ChevronRight,
  Folder as FolderIcon,
  FileText,
  ImageIcon,
  Upload,
  Trash2,
  Eye,
  UserRound,
  BookOpen,
  ShieldCheck,
  GraduationCap,
  User,
  AlertTriangle,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { tokenStorage } from '../../../src/lib/token-storage'

// 4.1.2 Crew Documents — per-crew folder browser.
// Mobile equivalent of apps/web/src/components/crew-ops/crew-documents/folder-view.tsx
// with in-screen breadcrumbs (stack of folder crumbs) rather than a
// separate route per folder — keeps state simple and animations cheap.

type ExpiryStatus = 'valid' | 'warning' | 'expired' | 'unknown'
interface ExpiryInfo {
  status: ExpiryStatus
  expiryDate: string | null
  lastDone: string | null
}

// Slug → (icon, tint). Mirrors apps/web/.../common/document-icons.ts.
const FOLDER_VISUALS: Record<string, { icon: LucideIcon; tint: string }> = {
  CrewPhotos: { icon: UserRound, tint: '#0063F7' },
  Passports: { icon: BookOpen, tint: '#06C270' },
  MedicalCertificates: { icon: ShieldCheck, tint: '#E63535' },
  TrainingDocuments: { icon: GraduationCap, tint: '#FF8800' },
}
const VIRTUAL_VISUAL = { icon: FolderIcon as LucideIcon, tint: '#FF8800' }

function folderVisual(slug: string) {
  return FOLDER_VISUALS[slug] ?? VIRTUAL_VISUAL
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

const STATUS_COLOR: Record<ExpiryStatus, string> = {
  valid: '#06C270',
  warning: '#FF8800',
  expired: '#E63535',
  unknown: '#555770',
}

export default function CrewDocumentBrowser() {
  const router = useRouter()
  const { crewId: crewIdParam } = useLocalSearchParams<{ crewId: string }>()
  const crewId = (crewIdParam ?? '') as string
  const { palette, isDark, accent } = useAppTheme()

  const [profile, setProfile] = useState<FullCrewProfileRef | null>(null)
  const [crewSummary, setCrewSummary] = useState<CrewDocumentStatusRef | null>(null)
  const [crumbs, setCrumbs] = useState<CrewDocumentFolderWithCountsRef[]>([])
  const [folders, setFolders] = useState<CrewDocumentFolderWithCountsRef[]>([])
  const [documents, setDocuments] = useState<CrewDocumentRef[]>([])
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Load profile + summary once. Summary is a single-row pull against the
  // status endpoint — kept for the header pill (coverage, expiry counts).
  useEffect(() => {
    if (!crewId) return
    setLoadingProfile(true)
    Promise.all([
      api.getCrewById(crewId).catch(() => null),
      api.getCrewDocumentStatus().catch(() => [] as CrewDocumentStatusRef[]),
    ])
      .then(([p, all]) => {
        setProfile(p)
        setCrewSummary(all.find((c) => c._id === crewId) ?? null)
      })
      .finally(() => setLoadingProfile(false))
  }, [crewId])

  const currentFolder = crumbs.at(-1) ?? null
  const currentParentId = currentFolder?._id ?? null
  const isVirtualSub = currentFolder?.isVirtual === true
  const showDocuments = currentFolder && (isVirtualSub || currentFolder.subfolderCount === 0)

  // Refetch folders whenever the crumb stack changes.
  const refreshFolders = useCallback(() => {
    if (!crewId) return
    setLoadingFolders(true)
    api
      .getCrewDocumentFolders(crewId, currentParentId)
      .then(setFolders)
      .catch(console.error)
      .finally(() => setLoadingFolders(false))
  }, [crewId, currentParentId])

  const refreshDocs = useCallback(() => {
    if (!crewId || !currentFolder) return
    if (!showDocuments) {
      setDocuments([])
      return
    }
    setLoadingDocs(true)
    const query = isVirtualSub
      ? { expiryCodeId: currentFolder.expiryCodeId ?? currentFolder._id }
      : { folderId: currentFolder._id }
    api
      .getCrewDocuments(crewId, query)
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoadingDocs(false))
  }, [crewId, currentFolder, isVirtualSub, showDocuments])

  useEffect(() => {
    refreshFolders()
  }, [refreshFolders])

  useEffect(() => {
    refreshDocs()
  }, [refreshDocs])

  const expiryMap = useMemo(() => {
    const map = new Map<string, ExpiryInfo>()
    for (const e of profile?.expiryDates ?? []) {
      if (!e.expiryCodeId) continue
      const prev = map.get(e.expiryCodeId)
      const candidate: ExpiryInfo = {
        status: e.status as ExpiryStatus,
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
  }, [profile])

  const openFolder = useCallback((f: CrewDocumentFolderWithCountsRef) => {
    setCrumbs((prev) => [...prev, f])
  }, [])

  const jumpTo = useCallback((index: number) => {
    // index = -1 → back to roots; otherwise truncate after that level.
    setCrumbs((prev) => (index < 0 ? [] : prev.slice(0, index + 1)))
  }, [])

  // For virtual sub-folders, uploads actually target the parent real folder's
  // _id with the expiryCodeId attached — same semantics the web uses.
  const uploadTargetFolderId = isVirtualSub
    ? (crumbs.at(-2)?._id ?? currentFolder?._id ?? '')
    : (currentFolder?._id ?? '')
  const uploadTargetExpiryCode: string | null = isVirtualSub
    ? (currentFolder?.expiryCodeId ?? currentFolder?._id ?? null)
    : null

  const handleUpload = useCallback(async () => {
    if (!currentFolder || !uploadTargetFolderId) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to upload.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024) {
      Alert.alert('File too large', 'Max document size is 20 MB.')
      return
    }

    setUploading(true)
    try {
      const uri = asset.uri
      const filename = uri.split('/').pop() ?? 'document.jpg'
      const ext = /\.(\w+)$/.exec(filename)?.[1]?.toLowerCase() ?? 'jpg'
      const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`
      const form = new FormData()
      form.append('file', { uri, name: filename, type } as any)
      form.append('folderId', uploadTargetFolderId)
      if (uploadTargetExpiryCode) form.append('expiryCodeId', uploadTargetExpiryCode)

      const token = tokenStorage.getAccessToken()
      const res = await fetch(`${getApiBaseUrl()}/crew/${encodeURIComponent(crewId)}/documents`, {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Upload failed (${res.status})`)
      }
      // Refresh folder + doc lists + profile (for expiry info).
      refreshFolders()
      refreshDocs()
      api
        .getCrewById(crewId)
        .then(setProfile)
        .catch(() => null)
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload document')
    } finally {
      setUploading(false)
    }
  }, [currentFolder, uploadTargetFolderId, uploadTargetExpiryCode, crewId, refreshFolders, refreshDocs])

  const handleDelete = useCallback(
    (doc: CrewDocumentRef) => {
      Alert.alert('Delete document', `Permanently remove ${doc.fileName}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(doc._id)
            try {
              await api.deleteCrewDocument(crewId, doc._id)
              refreshDocs()
              refreshFolders()
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message ?? 'Could not delete document')
            } finally {
              setDeleting(null)
            }
          },
        },
      ])
    },
    [crewId, refreshDocs, refreshFolders],
  )

  const handlePreview = useCallback((doc: CrewDocumentRef) => {
    const url = `${getApiBaseUrl()}${doc.fileUrl}`
    Linking.openURL(url).catch(() => {
      Alert.alert('Cannot open', 'Unable to launch an external viewer for this file.')
    })
  }, [])

  const member = profile?.member ?? null
  const fullName = member ? [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ') : ''
  const metaLine = member
    ? [member.employeeId, member.position, profile?.baseLabel ?? member.base].filter(Boolean).join(' · ')
    : ''
  const photoUrlAbsolute = member?.photoUrl ? `${getApiBaseUrl()}${member.photoUrl}` : null

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View
        className="px-4 pt-2 pb-3 flex-row items-center"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 44,
            height: 44,
            marginRight: 12,
            overflow: 'hidden',
            backgroundColor: accentTint(accent, isDark ? 0.18 : 0.1),
          }}
        >
          {photoUrlAbsolute ? (
            <Image source={{ uri: photoUrlAbsolute }} style={{ width: '100%', height: '100%' }} />
          ) : fullName ? (
            <RNText style={{ fontSize: 15, fontWeight: '700', color: accent }}>
              {`${member?.firstName?.[0] ?? ''}${member?.lastName?.[0] ?? ''}`.toUpperCase() || '??'}
            </RNText>
          ) : (
            <User size={20} color={palette.textTertiary} strokeWidth={1.8} />
          )}
        </View>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <RNText numberOfLines={1} style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>
            {loadingProfile ? 'Loading…' : fullName || 'Crew member'}
          </RNText>
          <RNText numberOfLines={1} style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
            {metaLine || 'Crew documents'}
          </RNText>
        </View>
      </View>

      {/* Coverage hero — only when we have the summary */}
      {crewSummary ? <CoverageHero crew={crewSummary} palette={palette} isDark={isDark} /> : null}

      {/* Breadcrumbs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border, flexGrow: 0 }}
      >
        <CrumbChip
          label="All folders"
          active={crumbs.length === 0}
          onPress={() => jumpTo(-1)}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
        {crumbs.map((c, i) => {
          const active = i === crumbs.length - 1
          return (
            <View key={c._id} className="flex-row items-center" style={{ gap: 4 }}>
              <ChevronRight size={12} color={palette.textTertiary} strokeWidth={2} />
              <CrumbChip
                label={c.name}
                active={active}
                onPress={() => jumpTo(i)}
                palette={palette}
                isDark={isDark}
                accent={accent}
              />
            </View>
          )
        })}
      </ScrollView>

      {/* Body */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Folder grid */}
        {loadingFolders ? (
          <ActivityIndicator color={accent} style={{ paddingVertical: 18 }} />
        ) : folders.length > 0 ? (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {folders.map((f) => {
              const exp = f.expiryCodeId ? expiryMap.get(f.expiryCodeId) : null
              return (
                <FolderTile
                  key={f._id}
                  folder={f}
                  expiry={exp ?? null}
                  onPress={() => openFolder(f)}
                  palette={palette}
                  isDark={isDark}
                />
              )
            })}
          </View>
        ) : null}

        {/* Documents card */}
        {showDocuments && currentFolder ? (
          <View
            className="rounded-xl"
            style={{
              marginTop: folders.length > 0 ? 16 : 0,
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              padding: 14,
            }}
          >
            <View className="flex-row items-center" style={{ marginBottom: 10, gap: 8 }}>
              <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: accent }} />
              <RNText
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: palette.textSecondary,
                }}
              >
                Documents ({documents.length})
              </RNText>
              <Pressable
                onPress={handleUpload}
                disabled={uploading}
                className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
                style={{ backgroundColor: accent, gap: 6, opacity: uploading ? 0.5 : 1 }}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Upload size={13} color="#fff" strokeWidth={2} />
                )}
                <RNText style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </RNText>
              </Pressable>
            </View>

            {loadingDocs ? (
              <ActivityIndicator color={accent} style={{ paddingVertical: 12 }} />
            ) : documents.length === 0 ? (
              <View
                className="rounded-lg items-center"
                style={{
                  paddingVertical: 20,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
                }}
              >
                <RNText style={{ fontSize: 13, color: palette.textTertiary, textAlign: 'center' }}>
                  No files yet. Tap Upload to add one.
                </RNText>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {documents.map((d) => {
                  const exp = d.expiryCodeId ? expiryMap.get(d.expiryCodeId) : null
                  return (
                    <DocumentRow
                      key={d._id}
                      doc={d}
                      expiry={exp ?? null}
                      deleting={deleting === d._id}
                      onPreview={() => handlePreview(d)}
                      onDelete={() => handleDelete(d)}
                      palette={palette}
                      isDark={isDark}
                      accent={accent}
                    />
                  )
                })}
              </View>
            )}

            <RNText style={{ fontSize: 12, color: palette.textTertiary, marginTop: 10, lineHeight: 16 }}>
              Images only on mobile — JPG / PNG / WebP / HEIC. Max 20 MB. Upload PDFs from the web app.
            </RNText>
          </View>
        ) : null}

        {folders.length === 0 && !showDocuments && !loadingFolders ? (
          <View
            className="rounded-xl items-center"
            style={{
              padding: 24,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <FolderIcon size={32} color={palette.textTertiary} strokeWidth={1.5} />
            <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center' }}>
              This folder is empty.
            </RNText>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

/* ──────────── Coverage hero strip ──────────── */

function CoverageHero({
  crew,
  palette,
  isDark,
}: {
  crew: CrewDocumentStatusRef
  palette: PaletteType
  isDark: boolean
}) {
  const pct = Math.max(0, Math.min(100, crew.coverage))
  const tone = pct >= 100 ? '#06C270' : pct >= 50 ? '#FF8800' : '#E63535'
  const bits: Array<{ label: string; ok: boolean }> = [
    { label: 'Photo', ok: crew.hasPhoto },
    { label: 'Passport', ok: crew.hasPassport },
    { label: 'Medical', ok: crew.hasMedical },
    { label: 'Training', ok: crew.hasTraining },
  ]
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        gap: 10,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          }}
        >
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: tone }} />
        </View>
        <RNText style={{ fontSize: 14, fontWeight: '700', color: tone, fontFamily: 'monospace' }}>{pct}%</RNText>
      </View>

      <View className="flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {bits.map((b) => (
          <View
            key={b.label}
            className="flex-row items-center rounded-full px-2.5 py-0.5"
            style={{
              backgroundColor: b.ok ? 'rgba(6,194,112,0.1)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              gap: 4,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: b.ok ? '#06C270' : palette.textTertiary,
              }}
            />
            <RNText
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: b.ok ? '#06C270' : palette.textTertiary,
              }}
            >
              {b.label}
            </RNText>
          </View>
        ))}
        {crew.expiredTrainingCount > 0 ? (
          <View
            className="flex-row items-center rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: 'rgba(230,53,53,0.12)', gap: 4 }}
          >
            <AlertTriangle size={10} color="#E63535" strokeWidth={2} />
            <RNText style={{ fontSize: 12, fontWeight: '700', color: '#E63535' }}>
              {crew.expiredTrainingCount} expired
            </RNText>
          </View>
        ) : null}
        {crew.warningTrainingCount > 0 ? (
          <View
            className="flex-row items-center rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: 'rgba(255,136,0,0.12)', gap: 4 }}
          >
            <AlertTriangle size={10} color="#FF8800" strokeWidth={2} />
            <RNText style={{ fontSize: 12, fontWeight: '700', color: '#FF8800' }}>
              {crew.warningTrainingCount} expiring
            </RNText>
          </View>
        ) : null}
      </View>
    </View>
  )
}

/* ──────────── Crumb chip ──────────── */

function CrumbChip({
  label,
  active,
  onPress,
  palette,
  isDark,
  accent,
}: {
  label: string
  active: boolean
  onPress: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg px-3 py-1.5 active:opacity-70"
      style={{
        backgroundColor: active ? accentTint(accent, isDark ? 0.18 : 0.1) : 'transparent',
      }}
    >
      <RNText
        style={{
          fontSize: 13,
          fontWeight: active ? '700' : '500',
          color: active ? accent : palette.textSecondary,
        }}
        numberOfLines={1}
      >
        {label}
      </RNText>
    </Pressable>
  )
}

/* ──────────── Folder tile ──────────── */

function FolderTile({
  folder,
  expiry,
  onPress,
  palette,
  isDark,
}: {
  folder: CrewDocumentFolderWithCountsRef
  expiry: ExpiryInfo | null
  onPress: () => void
  palette: PaletteType
  isDark: boolean
}) {
  const visual = folderVisual(folder.slug ?? '')
  const Icon = visual.icon
  const chipColor = expiry ? STATUS_COLOR[expiry.status] : null
  const totalCount = folder.documentCount + folder.subfolderCount

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl active:opacity-80"
      style={{
        width: '48%',
        padding: 14,
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        gap: 10,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View
          className="items-center justify-center rounded-xl"
          style={{
            width: 38,
            height: 38,
            backgroundColor: accentTint(visual.tint, isDark ? 0.2 : 0.12),
          }}
        >
          <Icon size={18} color={visual.tint} strokeWidth={1.8} />
        </View>
        {chipColor ? (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${chipColor}22` }}>
            <RNText
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: chipColor,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {expiry?.status}
            </RNText>
          </View>
        ) : null}
      </View>
      <View>
        <RNText style={{ fontSize: 14, fontWeight: '600', color: palette.text }} numberOfLines={2}>
          {folder.name}
        </RNText>
        <RNText style={{ fontSize: 12, color: palette.textTertiary, marginTop: 2 }}>
          {folder.isVirtual
            ? `${folder.documentCount} ${folder.documentCount === 1 ? 'file' : 'files'}`
            : folder.subfolderCount > 0
              ? `${folder.subfolderCount} subfolder${folder.subfolderCount === 1 ? '' : 's'}`
              : `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`}
          {expiry?.expiryDate ? ` · exp ${expiry.expiryDate.slice(5)}` : ''}
        </RNText>
      </View>
    </Pressable>
  )
}

/* ──────────── Document row ──────────── */

function DocumentRow({
  doc,
  expiry,
  deleting,
  onPreview,
  onDelete,
  palette,
  isDark,
  accent,
}: {
  doc: CrewDocumentRef
  expiry: ExpiryInfo | null
  deleting: boolean
  onPreview: () => void
  onDelete: () => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const isImage = doc.mimeType?.startsWith('image/') ?? false
  const isPdf = doc.mimeType === 'application/pdf'
  const expColor = expiry ? STATUS_COLOR[expiry.status] : null

  return (
    <View
      className="flex-row items-center rounded-lg"
      style={{
        padding: 10,
        gap: 10,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      <View
        className="items-center justify-center rounded-lg overflow-hidden"
        style={{
          width: 42,
          height: 42,
          backgroundColor: accentTint(accent, isDark ? 0.18 : 0.1),
        }}
      >
        {isImage ? (
          <Image source={{ uri: `${getApiBaseUrl()}${doc.fileUrl}` }} style={{ width: '100%', height: '100%' }} />
        ) : isPdf ? (
          <FileText size={18} color={accent} strokeWidth={1.8} />
        ) : (
          <ImageIcon size={18} color={accent} strokeWidth={1.8} />
        )}
      </View>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <RNText numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
          {doc.fileName}
        </RNText>
        <RNText style={{ fontSize: 12, color: palette.textTertiary, marginTop: 2 }} numberOfLines={1}>
          {formatBytes(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString()}
        </RNText>
        {expiry && expColor ? (
          <View className="flex-row items-center" style={{ marginTop: 4, gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: expColor }} />
            <RNText style={{ fontSize: 11, fontWeight: '700', color: expColor, textTransform: 'uppercase' }}>
              {expiry.status}
              {expiry.expiryDate ? ` · ${expiry.expiryDate}` : ''}
            </RNText>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onPreview}
        className="items-center justify-center rounded-lg active:opacity-70"
        style={{
          width: 36,
          height: 36,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        }}
        accessibilityLabel="Preview"
      >
        <Eye size={14} color={palette.textSecondary} strokeWidth={1.8} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        disabled={deleting}
        className="items-center justify-center rounded-lg active:opacity-70"
        style={{
          width: 36,
          height: 36,
          backgroundColor: 'rgba(230,53,53,0.1)',
          opacity: deleting ? 0.5 : 1,
        }}
        accessibilityLabel="Delete"
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#E63535" />
        ) : (
          <Trash2 size={14} color="#E63535" strokeWidth={1.8} />
        )}
      </Pressable>
    </View>
  )
}
