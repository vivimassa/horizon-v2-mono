import { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, Alert, Platform } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CrewHotelRef } from '@skyhub/api'
import { BedDouble } from 'lucide-react-native'
import { DetailScreenHeader, TabBar, FieldRow, Text, domainIcons, type TabBarItem } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

const InfoIcon = domainIcons.info
const LocationIcon = domainIcons.location
const ClockIcon = domainIcons.clock

type TabKey = 'basic' | 'address' | 'logistics'

const TABS: TabBarItem[] = [
  { key: 'basic', label: 'Basic', icon: InfoIcon },
  { key: 'address', label: 'Address', icon: LocationIcon },
  { key: 'logistics', label: 'Logistics', icon: ClockIcon },
]

export default function CrewHotelDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [hotel, setHotel] = useState<CrewHotelRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<CrewHotelRef>>({})

  useEffect(() => {
    if (!id) return
    api
      .getCrewHotel(id)
      .then(setHotel)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof CrewHotelRef) => (key in draft ? (draft as any)[key] : hotel?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!hotel || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateCrewHotel(hotel._id, draft)
      setHotel(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [hotel, draft])

  const handleDelete = useCallback(() => {
    if (!hotel) return
    Alert.alert(
      'Delete Hotel',
      `Permanently delete ${hotel.hotelName} at ${hotel.airportIcao}?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCrewHotel(hotel._id)
              router.back()
            } catch (err: any) {
              let msg = err.message || 'Delete failed'
              try {
                const match = msg.match(/API \d+: (.+)/)
                if (match) {
                  const parsed = JSON.parse(match[1])
                  msg = parsed.error || msg
                }
              } catch {
                /* use raw */
              }
              Alert.alert('Cannot Delete', msg)
            }
          },
        },
      ],
    )
  }, [hotel, router])

  if (loading || !hotel) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text variant="body" muted>
            {loading ? 'Loading…' : 'Hotel not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <DetailScreenHeader
          icon={BedDouble}
          title={hotel.hotelName}
          subtitle={`${hotel.airportIcao} · Priority ${hotel.priority}`}
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
            label: hotel.isActive ? 'Active' : 'Inactive',
            tone: hotel.isActive ? 'success' : 'danger',
          }}
        />
      </View>

      {hotel.latitude != null && hotel.longitude != null && (
        <View style={{ height: isTablet ? 300 : 250, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: hotel.latitude,
              longitude: hotel.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            mapType="standard"
          >
            <Marker
              coordinate={{ latitude: hotel.latitude, longitude: hotel.longitude }}
              title={hotel.hotelName}
              description={`${hotel.airportIcao} · Priority ${hotel.priority}`}
              pinColor={accent}
            />
          </MapView>

          <View className="absolute top-3 left-3 flex-row" style={{ gap: 6 }}>
            <View
              className="px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.88)',
                ...Platform.select({
                  ios: {
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  },
                  android: { elevation: 3 },
                }),
              }}
            >
              <Text variant="secondary" color="#666">
                ICAO:{' '}
                <Text variant="secondary" color="#111" style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                  {hotel.airportIcao}
                </Text>
              </Text>
            </View>
            <View
              className="px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.88)',
                ...Platform.select({
                  ios: {
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  },
                  android: { elevation: 3 },
                }),
              }}
            >
              <Text variant="secondary" color="#666">
                PRIORITY:{' '}
                <Text variant="secondary" color="#111" style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                  {hotel.priority}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} stretch />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'basic' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Hotel Name"
              value={hotel.hotelName}
              editing={editing}
              editValue={get('hotelName')}
              onChangeValue={(v) => handleFieldChange('hotelName', v)}
              half={isTablet}
            />
            <FieldRow
              label="Airport ICAO"
              value={hotel.airportIcao}
              editing={editing}
              editValue={get('airportIcao')}
              onChangeValue={(v) => handleFieldChange('airportIcao', String(v).toUpperCase())}
              mono
              half={isTablet}
            />
            <FieldRow
              label="Priority"
              value={hotel.priority}
              editing={editing}
              editValue={get('priority')}
              onChangeValue={(v) => handleFieldChange('priority', Number(v) || 1)}
              type="number"
              half={isTablet}
            />
            <FieldRow
              label="Active"
              value={hotel.isActive}
              editing={editing}
              editValue={get('isActive')}
              onChangeValue={(v) => handleFieldChange('isActive', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="Training Hotel"
              value={hotel.isTrainingHotel}
              editing={editing}
              editValue={get('isTrainingHotel')}
              onChangeValue={(v) => handleFieldChange('isTrainingHotel', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="All Inclusive"
              value={hotel.isAllInclusive}
              editing={editing}
              editValue={get('isAllInclusive')}
              onChangeValue={(v) => handleFieldChange('isAllInclusive', v)}
              type="toggle"
              half={isTablet}
            />
          </View>
        )}

        {activeTab === 'address' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Address Line 1"
              value={hotel.addressLine1}
              editing={editing}
              editValue={get('addressLine1')}
              onChangeValue={(v) => handleFieldChange('addressLine1', v)}
            />
            <FieldRow
              label="Address Line 2"
              value={hotel.addressLine2}
              editing={editing}
              editValue={get('addressLine2')}
              onChangeValue={(v) => handleFieldChange('addressLine2', v)}
            />
            <FieldRow
              label="Address Line 3"
              value={hotel.addressLine3}
              editing={editing}
              editValue={get('addressLine3')}
              onChangeValue={(v) => handleFieldChange('addressLine3', v)}
            />
            <FieldRow
              label="Latitude"
              value={hotel.latitude?.toFixed(6)}
              editing={editing}
              editValue={get('latitude')}
              onChangeValue={(v) => handleFieldChange('latitude', v ? Number(v) : null)}
              type="number"
              half={isTablet}
            />
            <FieldRow
              label="Longitude"
              value={hotel.longitude?.toFixed(6)}
              editing={editing}
              editValue={get('longitude')}
              onChangeValue={(v) => handleFieldChange('longitude', v ? Number(v) : null)}
              type="number"
              half={isTablet}
            />
          </View>
        )}

        {activeTab === 'logistics' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Distance from airport"
              value={hotel.distanceFromAirportMinutes}
              editing={editing}
              editValue={get('distanceFromAirportMinutes')}
              onChangeValue={(v) => handleFieldChange('distanceFromAirportMinutes', v ? Number(v) : null)}
              type="number"
              suffix="min"
              half={isTablet}
            />
            <FieldRow
              label="Standard Check-In"
              value={hotel.standardCheckInLocal}
              editing={editing}
              editValue={get('standardCheckInLocal')}
              onChangeValue={(v) => handleFieldChange('standardCheckInLocal', v)}
              half={isTablet}
            />
            <FieldRow
              label="Standard Check-Out"
              value={hotel.standardCheckOutLocal}
              editing={editing}
              editValue={get('standardCheckOutLocal')}
              onChangeValue={(v) => handleFieldChange('standardCheckOutLocal', v)}
              half={isTablet}
            />
            <FieldRow
              label="Shuttle Always Available"
              value={hotel.shuttleAlwaysAvailable}
              editing={editing}
              editValue={get('shuttleAlwaysAvailable')}
              onChangeValue={(v) => handleFieldChange('shuttleAlwaysAvailable', v)}
              type="toggle"
              half={isTablet}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
