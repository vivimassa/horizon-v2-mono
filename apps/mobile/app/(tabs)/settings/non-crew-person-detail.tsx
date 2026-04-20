import { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, Pressable, Alert, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { api, getApiBaseUrl, type NonCrewPersonRef } from '@skyhub/api'
import { formatDate, parseDate, datePlaceholder } from '@skyhub/logic'
import { Contact, Upload, Trash2, Mail, PlaneTakeoff, IdCard } from 'lucide-react-native'
import { DetailScreenHeader, TabBar, FieldRow, Text, type TabBarItem } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorStore } from '../../../src/stores/use-operator-store'
import { tokenStorage } from '../../../src/lib/token-storage'

type TabKey = 'identity' | 'contact' | 'jumpseat'

const TABS: TabBarItem[] = [
  { key: 'identity', label: 'Identity', icon: IdCard },
  { key: 'contact', label: 'Contact', icon: Mail },
  { key: 'jumpseat', label: 'Jumpseat', icon: PlaneTakeoff },
]

const GENDER_OPTS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'X', label: 'Unspecified' },
]

const PRIORITY_OPTS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

type Draft = Partial<NonCrewPersonRef> & Record<string, any>

function parseApiError(err: any, fallback = 'Operation failed'): string {
  const msg: string = err?.message ?? fallback
  try {
    const m = msg.match(/API (\d+): (.+)/)
    if (m) {
      const parsed = JSON.parse(m[2])
      return parsed.error || parsed.details?.join(', ') || msg
    }
  } catch {
    /* swallow */
  }
  return msg
}

export default function NonCrewPersonDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const dateFormat = useOperatorStore((s) => s.dateFormat)
  const datePH = datePlaceholder(dateFormat)

  const [person, setPerson] = useState<NonCrewPersonRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('identity')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>({})

  useEffect(() => {
    if (!id) return
    api
      .getNonCrewPerson(id)
      .then(setPerson)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  // `draft` stores dot-path keys like `fullName.first` or `passport.number`.
  // `get` reads the current value (draft overlay > server).
  const get = useCallback(
    (path: string): any => {
      if (path in draft) return draft[path]
      if (!person) return undefined
      const parts = path.split('.')
      let obj: any = person
      for (const p of parts) {
        if (obj == null) return undefined
        obj = obj[p]
      }
      return obj
    },
    [draft, person],
  )

  const set = useCallback((path: string, value: any) => {
    setDraft((prev) => ({ ...prev, [path]: value }))
  }, [])

  const buildPatch = useCallback((): Partial<NonCrewPersonRef> | null => {
    if (!person || Object.keys(draft).length === 0) return null
    // Date fields come out of the form in operator display format; the API
    // requires ISO YYYY-MM-DD, so normalise here once right before save.
    const DATE_PATHS = new Set(['dateOfBirth', 'passport.expiryDate'])
    const patch: any = {}
    const ensure = (parts: string[]) => {
      let cursor = patch
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]
        if (cursor[key] == null) {
          const sourceSeed = (person as any)[key]
          cursor[key] = sourceSeed && typeof sourceSeed === 'object' ? { ...sourceSeed } : {}
        }
        cursor = cursor[key]
      }
    }
    for (const [path, rawValue] of Object.entries(draft)) {
      const parts = path.split('.')
      ensure(parts)
      let cursor: any = patch
      for (let i = 0; i < parts.length - 1; i++) cursor = cursor[parts[i]]
      const value = DATE_PATHS.has(path) && typeof rawValue === 'string' ? parseDate(rawValue, dateFormat) : rawValue
      cursor[parts[parts.length - 1]] = value
    }
    if (patch.nationality) patch.nationality = String(patch.nationality).toUpperCase()
    if (patch.passport?.countryOfIssue)
      patch.passport.countryOfIssue = String(patch.passport.countryOfIssue).toUpperCase()
    return patch
  }, [draft, person, dateFormat])

  const handleSave = useCallback(async () => {
    if (!person) return
    const patch = buildPatch()
    if (!patch) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateNonCrewPerson(person._id, patch as any)
      setPerson(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', parseApiError(err))
    } finally {
      setSaving(false)
    }
  }, [person, buildPatch])

  const handleDelete = useCallback(() => {
    if (!person) return
    const name = `${person.fullName.first} ${person.fullName.last}`.trim()
    Alert.alert(
      'Delete Non-Crew Person',
      `${name} will be permanently removed. Historical flight records stay intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteNonCrewPerson(person._id)
              router.back()
            } catch (err: any) {
              Alert.alert('Cannot Delete', parseApiError(err))
            }
          },
        },
      ],
    )
  }, [person, router])

  if (loading || !person) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text variant="body" muted>
            {loading ? 'Loading…' : 'Person not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const status = person.terminated
    ? ({ label: 'Terminated', tone: 'danger' } as const)
    : person.doNotList
      ? ({ label: 'Not listed', tone: 'warning' } as const)
      : ({ label: 'Active', tone: 'success' } as const)

  const subtitle = [person.company, person.department].filter(Boolean).join(' · ') || 'Non-crew personnel'

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <DetailScreenHeader
          icon={Contact}
          title={`${person.fullName.last}, ${person.fullName.first}`}
          subtitle={subtitle}
          onBack={() => router.back()}
          editing={editing}
          onEdit={() => {
            setDraft({})
            setEditing(true)
          }}
          onSave={handleSave}
          onCancel={() => {
            setEditing(false)
            setDraft({})
          }}
          onDelete={handleDelete}
          saving={saving}
          status={status}
        />
      </View>

      {/* Avatar section — matches the web AvatarUpload block */}
      <AvatarRow
        personId={person._id}
        avatarUrl={person.avatarUrl}
        onChange={(avatarUrl) => setPerson((prev) => (prev ? { ...prev, avatarUrl } : prev))}
        disabled={saving}
      />

      <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} stretch />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'identity' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="First Name"
              value={person.fullName.first}
              editing={editing}
              editValue={get('fullName.first')}
              onChangeValue={(v) => set('fullName.first', v)}
              half={isTablet}
            />
            <FieldRow
              label="Middle Name"
              value={person.fullName.middle}
              editing={editing}
              editValue={get('fullName.middle')}
              onChangeValue={(v) => set('fullName.middle', v === '' ? null : v)}
              half={isTablet}
            />
            <FieldRow
              label="Last Name"
              value={person.fullName.last}
              editing={editing}
              editValue={get('fullName.last')}
              onChangeValue={(v) => set('fullName.last', v)}
              half={isTablet}
            />
            <FieldRow
              label="Date of Birth"
              value={formatDate(person.dateOfBirth, dateFormat)}
              editing={editing}
              editValue={
                'dateOfBirth' in draft ? (draft.dateOfBirth as string) : formatDate(person.dateOfBirth, dateFormat)
              }
              onChangeValue={(v) => set('dateOfBirth', String(v ?? ''))}
              mono
              placeholder={datePH}
              half={isTablet}
            />
            <FieldRow
              label="Gender"
              value={person.gender}
              editing={editing}
              editValue={get('gender')}
              onChangeValue={(v) => set('gender', v)}
              type="select"
              options={GENDER_OPTS}
              half={isTablet}
            />
            <FieldRow
              label="Nationality (ISO-3)"
              value={person.nationality}
              editing={editing}
              editValue={get('nationality')}
              onChangeValue={(v) => set('nationality', String(v ?? '').toUpperCase())}
              mono
              maxLength={3}
              half={isTablet}
            />
            <FieldRow
              label="Passport Number"
              value={person.passport.number}
              editing={editing}
              editValue={get('passport.number')}
              onChangeValue={(v) => set('passport.number', v)}
              mono
              half={isTablet}
            />
            <FieldRow
              label="Passport Issuing Country"
              value={person.passport.countryOfIssue}
              editing={editing}
              editValue={get('passport.countryOfIssue')}
              onChangeValue={(v) => set('passport.countryOfIssue', String(v ?? '').toUpperCase())}
              mono
              maxLength={3}
              half={isTablet}
            />
            <FieldRow
              label="Passport Expiry"
              value={formatDate(person.passport.expiryDate, dateFormat)}
              editing={editing}
              editValue={
                'passport.expiryDate' in draft
                  ? (draft['passport.expiryDate'] as string)
                  : formatDate(person.passport.expiryDate, dateFormat)
              }
              onChangeValue={(v) => set('passport.expiryDate', String(v ?? ''))}
              mono
              placeholder={datePH}
              half={isTablet}
            />
          </View>
        )}

        {activeTab === 'contact' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Email"
              value={person.contact.email}
              editing={editing}
              editValue={get('contact.email')}
              onChangeValue={(v) => set('contact.email', v === '' ? null : v)}
              half={isTablet}
            />
            <FieldRow
              label="Phone"
              value={person.contact.phone}
              editing={editing}
              editValue={get('contact.phone')}
              onChangeValue={(v) => set('contact.phone', v === '' ? null : v)}
              half={isTablet}
            />
            <FieldRow
              label="Company"
              value={person.company}
              editing={editing}
              editValue={get('company')}
              onChangeValue={(v) => set('company', v === '' ? null : v)}
              half={isTablet}
            />
            <FieldRow
              label="Department"
              value={person.department}
              editing={editing}
              editValue={get('department')}
              onChangeValue={(v) => set('department', v === '' ? null : v)}
              half={isTablet}
            />
          </View>
        )}

        {activeTab === 'jumpseat' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Jumpseat Priority"
              value={person.jumpseatPriority}
              editing={editing}
              editValue={get('jumpseatPriority')}
              onChangeValue={(v) => set('jumpseatPriority', v)}
              type="select"
              options={PRIORITY_OPTS}
              half={isTablet}
            />
            <FieldRow
              label="Do Not List"
              value={person.doNotList}
              editing={editing}
              editValue={get('doNotList')}
              onChangeValue={(v) => set('doNotList', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="Terminated"
              value={person.terminated}
              editing={editing}
              editValue={get('terminated')}
              onChangeValue={(v) => set('terminated', v)}
              type="toggle"
              half={isTablet}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Avatar row ──

function AvatarRow({
  personId,
  avatarUrl,
  disabled,
  onChange,
}: {
  personId: string
  avatarUrl: string | null
  disabled: boolean
  onChange: (url: string | null) => void
}) {
  const { palette, isDark, accent } = useAppTheme()
  const [uploading, setUploading] = useState(false)
  const fullUrl = avatarUrl ? `${getApiBaseUrl()}${avatarUrl}` : null

  const pick = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to change the avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Max avatar file size is 2 MB.')
      return
    }
    setUploading(true)
    try {
      const uri = asset.uri
      const filename = uri.split('/').pop() ?? 'avatar.jpg'
      const ext = /\.(\w+)$/.exec(filename)?.[1] ?? 'jpg'
      const type = `image/${ext === 'jpg' ? 'jpeg' : ext}`
      const form = new FormData()
      form.append('file', { uri, name: filename, type } as any)
      const token = tokenStorage.getAccessToken()
      const res = await fetch(`${getApiBaseUrl()}/non-crew-people/${personId}/avatar`, {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Upload failed (${res.status})`)
      }
      const data = (await res.json()) as { avatarUrl: string }
      onChange(data.avatarUrl)
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message ?? 'Could not upload avatar')
    } finally {
      setUploading(false)
    }
  }, [personId, onChange])

  const remove = useCallback(async () => {
    setUploading(true)
    try {
      const token = tokenStorage.getAccessToken()
      const res = await fetch(`${getApiBaseUrl()}/non-crew-people/${personId}/avatar`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      onChange(null)
    } catch (err: any) {
      Alert.alert('Delete Failed', err?.message ?? 'Could not remove avatar')
    } finally {
      setUploading(false)
    }
  }, [personId, onChange])

  return (
    <View
      className="flex-row items-center"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderWidth: 1,
          borderColor: palette.cardBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {fullUrl ? (
          <Image source={{ uri: fullUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Contact size={28} color={palette.textTertiary} strokeWidth={1.6} />
        )}
      </View>

      <View className="flex-1">
        <Text variant="cardTitle">Profile photo</Text>
        <Text variant="caption" muted style={{ marginTop: 2 }}>
          JPG, PNG, or WebP — max 2 MB
        </Text>
        <View className="flex-row" style={{ gap: 8, marginTop: 8 }}>
          <Pressable
            onPress={pick}
            disabled={disabled || uploading}
            className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
            style={{
              backgroundColor: accent,
              opacity: disabled || uploading ? 0.5 : 1,
              gap: 6,
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Upload size={13} color="#fff" strokeWidth={2} />
            )}
            <Text variant="cardTitle" color="#fff" style={{ fontWeight: '600' }}>
              {fullUrl ? 'Replace' : 'Upload'}
            </Text>
          </Pressable>
          {fullUrl ? (
            <Pressable
              onPress={remove}
              disabled={disabled || uploading}
              className="flex-row items-center rounded-lg px-3 py-2 active:opacity-70"
              style={{
                borderWidth: 1,
                borderColor: palette.cardBorder,
                opacity: disabled || uploading ? 0.5 : 1,
                gap: 6,
              }}
            >
              <Trash2 size={13} color={palette.textSecondary} strokeWidth={2} />
              <Text variant="cardTitle" color={palette.textSecondary} style={{ fontWeight: '500' }}>
                Remove
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}
