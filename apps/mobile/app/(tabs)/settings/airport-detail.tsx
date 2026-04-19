import { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import { Lightbulb, Check } from 'lucide-react-native'
import {
  DetailScreenHeader,
  TabBar,
  FieldRow,
  Text,
  Card,
  SectionHeader,
  Button,
  Badge,
  Icon,
  domainIcons,
  type TabBarItem,
} from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

const InfoIcon = domainIcons.info
const PlaneIcon = domainIcons.aircraft
const RadioIcon = domainIcons.notifications
const UsersIcon = domainIcons.crew
const PlusIcon = domainIcons.add
const TrashIcon = domainIcons.delete

type TabKey = 'basic' | 'runway' | 'operations' | 'crew'

const TABS: TabBarItem[] = [
  { key: 'basic', label: 'Basic', icon: InfoIcon },
  { key: 'runway', label: 'Runway', icon: PlaneIcon },
  { key: 'operations', label: 'Ops', icon: RadioIcon },
  { key: 'crew', label: 'Crew', icon: UsersIcon },
]

export default function AirportDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [airport, setAirport] = useState<AirportRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<AirportRef>>({})

  useEffect(() => {
    if (!id) return
    api
      .getAirport(id)
      .then(setAirport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!airport || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateAirport(airport._id, draft)
      setAirport(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [airport, draft])

  const handleDelete = useCallback(() => {
    if (!airport) return
    Alert.alert('Delete Airport', `Are you sure you want to delete ${airport.name} (${airport.icaoCode})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAirport(airport._id)
            router.back()
          } catch (err: any) {
            let msg = err.message || 'Delete failed'
            try {
              const match = msg.match(/API (\d+): (.+)/)
              if (match) {
                const parsed = JSON.parse(match[2])
                msg = parsed.error || msg
              }
            } catch {
              /* use raw */
            }
            Alert.alert('Cannot Delete', msg)
          }
        },
      },
    ])
  }, [airport, router])

  if (loading || !airport) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text variant="body" muted>
            {loading ? 'Loading…' : 'Airport not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <DetailScreenHeader
          icon={domainIcons.airport}
          title={airport.name}
          subtitle={`${airport.iataCode ?? '—'} / ${airport.icaoCode}`}
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
            label: airport.isActive ? 'Active' : 'Inactive',
            tone: airport.isActive ? 'success' : 'danger',
          }}
        />
      </View>

      {airport.latitude != null && airport.longitude != null && (
        <View style={{ height: isTablet ? 300 : 250, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: airport.latitude,
              longitude: airport.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            mapType="standard"
          >
            <Marker
              coordinate={{ latitude: airport.latitude, longitude: airport.longitude }}
              title={airport.name}
              description={`${airport.iataCode ?? ''} / ${airport.icaoCode}`}
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
                IATA:{' '}
                <Text variant="secondary" color="#111" style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                  {airport.iataCode ?? '—'}
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
                ICAO:{' '}
                <Text variant="secondary" color="#111" style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                  {airport.icaoCode}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
        {/* `stretch` distributes the 4 tabs across the full width so each has
           a generous full-width tap target — matches the web tab pattern. */}
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} stretch />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'basic' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="IATA Code"
              value={airport.iataCode}
              editing={editing}
              editValue={get('iataCode')}
              onChangeValue={(v) => handleFieldChange('iataCode', v)}
              mono
              half={isTablet}
            />
            <FieldRow
              label="ICAO Code"
              value={airport.icaoCode}
              editing={editing}
              editValue={get('icaoCode')}
              onChangeValue={(v) => handleFieldChange('icaoCode', v)}
              mono
              half={isTablet}
            />
            <FieldRow
              label="Airport Name"
              value={airport.name}
              editing={editing}
              editValue={get('name')}
              onChangeValue={(v) => handleFieldChange('name', v)}
              half={isTablet}
            />
            <FieldRow
              label="City"
              value={airport.city}
              editing={editing}
              editValue={get('city')}
              onChangeValue={(v) => handleFieldChange('city', v)}
              half={isTablet}
            />
            <FieldRow
              label="Country"
              value={airport.countryName ?? airport.country}
              editing={editing}
              editValue={get('countryName')}
              onChangeValue={(v) => handleFieldChange('countryName', v)}
              half={isTablet}
            />
            <FieldRow
              label="Timezone"
              value={airport.timezone}
              editing={editing}
              editValue={get('timezone')}
              onChangeValue={(v) => handleFieldChange('timezone', v)}
              half={isTablet}
            />
            <FieldRow
              label="Latitude"
              value={airport.latitude?.toFixed(6)}
              editing={editing}
              editValue={get('latitude')}
              onChangeValue={(v) => handleFieldChange('latitude', v)}
              type="number"
              half={isTablet}
            />
            <FieldRow
              label="Longitude"
              value={airport.longitude?.toFixed(6)}
              editing={editing}
              editValue={get('longitude')}
              onChangeValue={(v) => handleFieldChange('longitude', v)}
              type="number"
              half={isTablet}
            />
            <FieldRow
              label="Elevation"
              value={airport.elevationFt}
              editing={editing}
              editValue={get('elevationFt')}
              onChangeValue={(v) => handleFieldChange('elevationFt', v)}
              type="number"
              suffix="ft"
              half={isTablet}
            />
            <FieldRow
              label="Active"
              value={airport.isActive}
              editing={editing}
              editValue={get('isActive')}
              onChangeValue={(v) => handleFieldChange('isActive', v)}
              type="toggle"
              half={isTablet}
            />
          </View>
        )}
        {activeTab === 'runway' && (
          <>
            <RunwayList
              airport={airport}
              onRefresh={() => {
                api.getAirport(airport._id).then(setAirport).catch(console.error)
              }}
            />

            <SectionHeader title="Facilities" />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <FieldRow
                label="Number of Gates"
                value={airport.numberOfGates}
                editing={editing}
                editValue={get('numberOfGates')}
                onChangeValue={(v) => handleFieldChange('numberOfGates', v)}
                type="number"
                half={isTablet}
              />
              <FieldRow
                label="Fire Category"
                value={airport.fireCategory}
                editing={editing}
                editValue={get('fireCategory')}
                onChangeValue={(v) => handleFieldChange('fireCategory', v)}
                type="number"
                half={isTablet}
              />
              <FieldRow
                label="Fuel Available"
                value={airport.hasFuelAvailable}
                editing={editing}
                editValue={get('hasFuelAvailable')}
                onChangeValue={(v) => handleFieldChange('hasFuelAvailable', v)}
                type="toggle"
                half={isTablet}
              />
              <FieldRow
                label="Crew Facilities"
                value={airport.hasCrewFacilities}
                editing={editing}
                editValue={get('hasCrewFacilities')}
                onChangeValue={(v) => handleFieldChange('hasCrewFacilities', v)}
                type="toggle"
                half={isTablet}
              />
            </View>
          </>
        )}
        {activeTab === 'operations' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Slot Controlled"
              value={airport.isSlotControlled}
              editing={editing}
              editValue={get('isSlotControlled')}
              onChangeValue={(v) => handleFieldChange('isSlotControlled', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="Has Curfew"
              value={airport.hasCurfew}
              editing={editing}
              editValue={get('hasCurfew')}
              onChangeValue={(v) => handleFieldChange('hasCurfew', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="Curfew Start"
              value={airport.curfewStart}
              editing={editing}
              editValue={get('curfewStart')}
              onChangeValue={(v) => handleFieldChange('curfewStart', v)}
              half={isTablet}
            />
            <FieldRow
              label="Curfew End"
              value={airport.curfewEnd}
              editing={editing}
              editValue={get('curfewEnd')}
              onChangeValue={(v) => handleFieldChange('curfewEnd', v)}
              half={isTablet}
            />
            <FieldRow
              label="Weather Monitored"
              value={airport.weatherMonitored}
              editing={editing}
              editValue={get('weatherMonitored')}
              onChangeValue={(v) => handleFieldChange('weatherMonitored', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="Weather Station"
              value={airport.weatherStation}
              editing={editing}
              editValue={get('weatherStation')}
              onChangeValue={(v) => handleFieldChange('weatherStation', v)}
              half={isTablet}
            />
            <FieldRow
              label="Home Base"
              value={airport.isHomeBase}
              editing={editing}
              editValue={get('isHomeBase')}
              onChangeValue={(v) => handleFieldChange('isHomeBase', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="UTC Offset"
              value={
                airport.utcOffsetHours != null
                  ? `UTC${airport.utcOffsetHours >= 0 ? '+' : ''}${airport.utcOffsetHours}`
                  : null
              }
              editing={editing}
              editValue={get('utcOffsetHours')}
              onChangeValue={(v) => handleFieldChange('utcOffsetHours', v)}
              type="number"
              half={isTablet}
            />
          </View>
        )}
        {activeTab === 'crew' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <FieldRow
              label="Crew Base"
              value={airport.isCrewBase}
              editing={editing}
              editValue={get('isCrewBase')}
              onChangeValue={(v) => handleFieldChange('isCrewBase', v)}
              type="toggle"
              half={isTablet}
            />
            <FieldRow
              label="Crew Reporting"
              value={airport.crewReportingTimeMinutes}
              editing={editing}
              editValue={get('crewReportingTimeMinutes')}
              onChangeValue={(v) => handleFieldChange('crewReportingTimeMinutes', v)}
              type="number"
              suffix="min"
              half={isTablet}
            />
            <FieldRow
              label="Crew Debrief"
              value={airport.crewDebriefTimeMinutes}
              editing={editing}
              editValue={get('crewDebriefTimeMinutes')}
              onChangeValue={(v) => handleFieldChange('crewDebriefTimeMinutes', v)}
              type="number"
              suffix="min"
              half={isTablet}
            />
            <FieldRow
              label="Crew Facilities"
              value={airport.hasCrewFacilities}
              editing={editing}
              editValue={get('hasCrewFacilities')}
              onChangeValue={(v) => handleFieldChange('hasCrewFacilities', v)}
              type="toggle"
              half={isTablet}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Runway List ──

function RunwayList({ airport, onRefresh }: { airport: AirportRef; onRefresh: () => void }) {
  const { palette, accent } = useAppTheme()
  const runways = airport.runways ?? []
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ identifier: '', lengthFt: '', widthFt: '', surface: 'ASPHALT' })

  const handleAdd = useCallback(async () => {
    if (!form.identifier.trim()) {
      Alert.alert('Error', 'Identifier is required')
      return
    }
    setSaving(true)
    try {
      const lengthFt = form.lengthFt ? Number(form.lengthFt) : null
      const widthFt = form.widthFt ? Number(form.widthFt) : null
      await api.addRunway(airport._id, {
        identifier: form.identifier.toUpperCase(),
        lengthFt,
        lengthM: lengthFt ? Math.round(lengthFt * 0.3048) : null,
        widthFt,
        widthM: widthFt ? Math.round(widthFt * 0.3048) : null,
        surface: form.surface || null,
        ilsCategory: null,
        lighting: false,
        status: 'active',
        notes: null,
      })
      setForm({ identifier: '', lengthFt: '', widthFt: '', surface: 'ASPHALT' })
      setShowAdd(false)
      onRefresh()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add runway')
    } finally {
      setSaving(false)
    }
  }, [airport._id, form, onRefresh])

  const handleDelete = useCallback(
    (rwId: string, identifier: string) => {
      Alert.alert('Delete Runway', `Delete runway ${identifier}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRunway(airport._id, rwId)
              onRefresh()
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete')
            }
          },
        },
      ])
    },
    [airport._id, onRefresh],
  )

  return (
    <View>
      <SectionHeader
        title="Runways"
        subtitle={`${runways.length}`}
        action={!showAdd ? { label: 'Add', onPress: () => setShowAdd(true) } : undefined}
      />

      {showAdd && (
        <Card padding="compact" className="mb-3">
          <Text variant="cardTitle" style={{ marginBottom: 8 }}>
            New Runway
          </Text>
          <View className="flex-row" style={{ gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="fieldLabel" muted style={{ marginBottom: 2 }}>
                IDENTIFIER
              </Text>
              <TextInput
                value={form.identifier}
                placeholder="e.g. 08L/26R"
                onChangeText={(v) => setForm((p) => ({ ...p, identifier: v.toUpperCase() }))}
                style={{
                  fontSize: 14,
                  fontFamily: 'monospace',
                  color: palette.text,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  paddingVertical: 4,
                }}
                placeholderTextColor={palette.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="fieldLabel" muted style={{ marginBottom: 2 }}>
                LENGTH (FT)
              </Text>
              <TextInput
                value={form.lengthFt}
                placeholder="e.g. 12000"
                onChangeText={(v) => setForm((p) => ({ ...p, lengthFt: v }))}
                keyboardType="numeric"
                style={{
                  fontSize: 14,
                  color: palette.text,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  paddingVertical: 4,
                }}
                placeholderTextColor={palette.textTertiary}
              />
            </View>
          </View>
          <View className="flex-row" style={{ gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text variant="fieldLabel" muted style={{ marginBottom: 2 }}>
                WIDTH (FT)
              </Text>
              <TextInput
                value={form.widthFt}
                placeholder="e.g. 150"
                onChangeText={(v) => setForm((p) => ({ ...p, widthFt: v }))}
                keyboardType="numeric"
                style={{
                  fontSize: 14,
                  color: palette.text,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  paddingVertical: 4,
                }}
                placeholderTextColor={palette.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="fieldLabel" muted style={{ marginBottom: 2 }}>
                SURFACE
              </Text>
              <TextInput
                value={form.surface}
                onChangeText={(v) => setForm((p) => ({ ...p, surface: v.toUpperCase() }))}
                style={{
                  fontSize: 14,
                  color: palette.text,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  paddingVertical: 4,
                }}
                placeholderTextColor={palette.textTertiary}
              />
            </View>
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            <Button
              title={saving ? 'Adding…' : 'Add'}
              variant="affirmative"
              size="sm"
              onPress={handleAdd}
              loading={saving}
              leftIcon={Check}
            />
            <Button title="Cancel" variant="ghost" size="sm" onPress={() => setShowAdd(false)} />
          </View>
        </Card>
      )}

      {runways.length === 0 && !showAdd ? (
        <View className="py-6 items-center">
          <Text variant="secondary" muted>
            No runway data available
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {runways.map((rw) => (
            <Card key={rw._id} padding="compact">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text variant="sectionHeading" style={{ fontFamily: 'monospace', fontWeight: '800' }}>
                    {rw.identifier}
                  </Text>
                  <Badge
                    label={rw.status === 'under-construction' ? 'WIP' : (rw.status?.toUpperCase() ?? '')}
                    variant={rw.status === 'active' ? 'accent' : 'muted'}
                  />
                  {rw.lighting && <Icon icon={Lightbulb} size="sm" color="#f59e0b" />}
                </View>
                <Pressable onPress={() => handleDelete(rw._id, rw.identifier)} className="p-1.5 active:opacity-60">
                  <TrashIcon size={14} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
              </View>
              <View className="flex-row" style={{ gap: 16 }}>
                <View>
                  <Text variant="fieldLabel" muted>
                    LENGTH
                  </Text>
                  <Text variant="cardTitle">{rw.lengthFt ? `${rw.lengthFt.toLocaleString()} ft` : '—'}</Text>
                  {rw.lengthM != null && (
                    <Text variant="caption" muted>
                      {rw.lengthM.toLocaleString()} m
                    </Text>
                  )}
                </View>
                <View>
                  <Text variant="fieldLabel" muted>
                    WIDTH
                  </Text>
                  <Text variant="cardTitle">{rw.widthFt ? `${rw.widthFt.toLocaleString()} ft` : '—'}</Text>
                  {rw.widthM != null && (
                    <Text variant="caption" muted>
                      {rw.widthM.toLocaleString()} m
                    </Text>
                  )}
                </View>
                <View>
                  <Text variant="fieldLabel" muted>
                    SURFACE
                  </Text>
                  <Text variant="cardTitle">{rw.surface ?? '—'}</Text>
                </View>
                <View>
                  <Text variant="fieldLabel" muted>
                    ILS
                  </Text>
                  <Text variant="cardTitle">{rw.ilsCategory ?? 'None'}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
