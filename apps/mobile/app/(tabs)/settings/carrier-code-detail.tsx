import { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, Pressable, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CarrierCodeRef } from '@skyhub/api'
import {
  DetailScreenHeader,
  TabBar,
  FieldRow,
  SectionHeader,
  Text,
  Badge,
  domainIcons,
  type TabBarItem,
  type FieldRowOption,
} from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const Building2 = domainIcons.airport

const CATEGORY_OPTIONS: FieldRowOption[] = [
  { label: 'Air', value: 'Air' },
  { label: 'Ground', value: 'Ground' },
  { label: 'Other', value: 'Other' },
]

const TABS: TabBarItem[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'contact', label: 'Contact' },
  { key: 'times', label: 'Report & Debrief' },
]

type TabKey = 'basic' | 'contact' | 'times'

export default function CarrierCodeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [carrier, setCarrier] = useState<CarrierCodeRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<TabKey>('basic')
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    setLogoFailed(false)
    api
      .getCarrierCodes(operatorId)
      .then((list) => setCarrier(list.find((c) => c._id === id) ?? null))
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (carrier as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!carrier || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateCarrierCode(carrier._id, draft)
      setCarrier(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [carrier, draft])

  const handleDelete = useCallback(() => {
    if (!carrier) return
    Alert.alert('Delete Carrier', `Delete ${carrier.iataCode} — ${carrier.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCarrierCode(carrier._id)
            router.back()
          } catch (err: any) {
            Alert.alert('Cannot Delete', err.message || 'Failed')
          }
        },
      },
    ])
  }, [carrier, router])

  if (loading || (!carrier && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text variant="body" muted>
            {loading ? 'Loading...' : 'Not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !carrier) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <DetailScreenHeader title="Carrier" onBack={() => router.back()} />
        <View className="flex-1 justify-center items-center px-8">
          <Text variant="body" muted style={{ textAlign: 'center' }}>
            {error ?? 'Not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <DetailScreenHeader
          icon={Building2}
          title={carrier.name}
          subtitle={`${carrier.iataCode}${carrier.icaoCode ? ' / ' + carrier.icaoCode : ''}`}
          subtitleSlot={
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Badge label={carrier.category} variant="accent" />
            </View>
          }
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
          status={{
            label: carrier.isActive ? 'Active' : 'Inactive',
            tone: carrier.isActive ? 'success' : 'danger',
          }}
        />
      </View>

      <View
        className="flex-row items-center px-4 py-3"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <View
          className="items-center justify-center rounded-xl overflow-hidden mr-4"
          style={{ width: 80, height: 50, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: '#fff' }}
        >
          {carrier.iataCode && !logoFailed ? (
            <Image
              source={{ uri: `https://pics.avs.io/200/80/${carrier.iataCode}.png` }}
              style={{ width: 70, height: 40 }}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Building2 size={20} color={palette.textTertiary} strokeWidth={1.5} />
          )}
        </View>
        <View className="flex-1">
          <Text variant="sectionHeading">{carrier.name}</Text>
          <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
            <Text variant="body" color={accent} style={{ fontWeight: '700', fontFamily: 'monospace' }}>
              {carrier.iataCode}
            </Text>
            {carrier.icaoCode && (
              <Text variant="secondary" muted style={{ fontFamily: 'monospace' }}>
                {carrier.icaoCode}
              </Text>
            )}
            {carrier.defaultCurrency && (
              <Text variant="secondary" muted style={{ fontFamily: 'monospace' }}>
                {carrier.defaultCurrency}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
        <TabBar tabs={TABS} activeTab={tab} onTabChange={(k) => setTab(k as TabKey)} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'basic' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="IATA Code"
              value={carrier.iataCode}
              editing={editing}
              editValue={get('iataCode')}
              onChangeValue={(v) => handleFieldChange('iataCode', v)}
              mono
              maxLength={2}
              half={isTablet}
            />
            <FieldRow
              label="ICAO Code"
              value={carrier.icaoCode}
              editing={editing}
              editValue={get('icaoCode')}
              onChangeValue={(v) => handleFieldChange('icaoCode', v)}
              mono
              maxLength={3}
              half={isTablet}
            />
            <FieldRow
              label="Name"
              value={carrier.name}
              editing={editing}
              editValue={get('name')}
              onChangeValue={(v) => handleFieldChange('name', v)}
              half={isTablet}
            />
            <FieldRow
              label="Category"
              value={carrier.category}
              editing={editing}
              editValue={get('category')}
              onChangeValue={(v) => handleFieldChange('category', v)}
              type="select"
              options={CATEGORY_OPTIONS}
              half={isTablet}
            />
            <FieldRow
              label="Vendor Number"
              value={carrier.vendorNumber}
              editing={editing}
              editValue={get('vendorNumber')}
              onChangeValue={(v) => handleFieldChange('vendorNumber', v)}
              half={isTablet}
            />
            <FieldRow
              label="Default Currency"
              value={carrier.defaultCurrency}
              editing={editing}
              editValue={get('defaultCurrency')}
              onChangeValue={(v) => handleFieldChange('defaultCurrency', v)}
              mono
              half={isTablet}
            />
            {editing && (
              <FieldRow
                label="Active"
                value={carrier.isActive}
                editing
                editValue={get('isActive')}
                onChangeValue={(v) => handleFieldChange('isActive', v)}
                type="toggle"
                half={isTablet}
              />
            )}
          </View>
        )}

        {tab === 'contact' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Contact Name"
              value={carrier.contactName}
              editing={editing}
              editValue={get('contactName')}
              onChangeValue={(v) => handleFieldChange('contactName', v)}
              half={isTablet}
            />
            <FieldRow
              label="Position"
              value={carrier.contactPosition}
              editing={editing}
              editValue={get('contactPosition')}
              onChangeValue={(v) => handleFieldChange('contactPosition', v)}
              half={isTablet}
            />
            <FieldRow
              label="Phone"
              value={carrier.phone}
              editing={editing}
              editValue={get('phone')}
              onChangeValue={(v) => handleFieldChange('phone', v)}
              half={isTablet}
            />
            <FieldRow
              label="Email"
              value={carrier.email}
              editing={editing}
              editValue={get('email')}
              onChangeValue={(v) => handleFieldChange('email', v)}
              half={isTablet}
            />
            <FieldRow
              label="SITA"
              value={carrier.sita}
              editing={editing}
              editValue={get('sita')}
              onChangeValue={(v) => handleFieldChange('sita', v)}
              mono
              half={isTablet}
            />
            <FieldRow
              label="Website"
              value={carrier.website}
              editing={editing}
              editValue={get('website')}
              onChangeValue={(v) => handleFieldChange('website', v)}
              half={isTablet}
            />
          </View>
        )}

        {tab === 'times' && (
          <>
            <SectionHeader title="Cockpit Crew" />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <FieldRow
                label="Report Time"
                value={carrier.cockpitTimes?.reportMinutes}
                editing={editing}
                editValue={get('cockpitTimes')?.reportMinutes ?? carrier.cockpitTimes?.reportMinutes}
                onChangeValue={(v) =>
                  handleFieldChange('cockpitTimes', {
                    ...(get('cockpitTimes') ?? carrier.cockpitTimes ?? {}),
                    reportMinutes: v,
                  })
                }
                type="time-hhmm"
                half={isTablet}
              />
              <FieldRow
                label="Debrief Time"
                value={carrier.cockpitTimes?.debriefMinutes}
                editing={editing}
                editValue={get('cockpitTimes')?.debriefMinutes ?? carrier.cockpitTimes?.debriefMinutes}
                onChangeValue={(v) =>
                  handleFieldChange('cockpitTimes', {
                    ...(get('cockpitTimes') ?? carrier.cockpitTimes ?? {}),
                    debriefMinutes: v,
                  })
                }
                type="time-hhmm"
                half={isTablet}
              />
            </View>

            <SectionHeader title="Cabin Crew" />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <FieldRow
                label="Report Time"
                value={carrier.cabinTimes?.reportMinutes}
                editing={editing}
                editValue={get('cabinTimes')?.reportMinutes ?? carrier.cabinTimes?.reportMinutes}
                onChangeValue={(v) =>
                  handleFieldChange('cabinTimes', {
                    ...(get('cabinTimes') ?? carrier.cabinTimes ?? {}),
                    reportMinutes: v,
                  })
                }
                type="time-hhmm"
                half={isTablet}
              />
              <FieldRow
                label="Debrief Time"
                value={carrier.cabinTimes?.debriefMinutes}
                editing={editing}
                editValue={get('cabinTimes')?.debriefMinutes ?? carrier.cabinTimes?.debriefMinutes}
                onChangeValue={(v) =>
                  handleFieldChange('cabinTimes', {
                    ...(get('cabinTimes') ?? carrier.cabinTimes ?? {}),
                    debriefMinutes: v,
                  })
                }
                type="time-hhmm"
                half={isTablet}
              />
            </View>

            <SectionHeader title="Capacity" />
            <FieldRow
              label="Passengers"
              value={carrier.capacity}
              editing={editing}
              editValue={get('capacity')}
              onChangeValue={(v) => handleFieldChange('capacity', v)}
              type="number"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
