import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { ChevronDown, Eye, EyeOff, Check } from 'lucide-react-native'
import { crewApi, ApiError, type OperatorOption } from '../../src/lib/api-client'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { resetAndResync } from '../../src/sync/sync-trigger'
import { WallpaperBg } from '../../src/components/WallpaperBg'

const FIELD_BG = 'rgba(255,255,255,0.07)'
const FIELD_BORDER = 'rgba(255,255,255,0.12)'
const FIELD_BORDER_FOCUS = 'rgba(62,123,250,0.6)'
const PLACEHOLDER = 'rgba(255,255,255,0.35)'
const TEXT = 'rgba(255,255,255,0.92)'
const TEXT_DIM = 'rgba(255,255,255,0.55)'
const TEXT_FAINT = 'rgba(255,255,255,0.40)'
const ACCENT = '#3e7bfa'

export default function Login() {
  const router = useRouter()
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  const setOperator = useCrewOperatorStore((s) => s.setOperator)
  const database = useDatabase()

  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [loadingOperators, setLoadingOperators] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [employeeId, setEmployeeId] = useState(secureTokenStorage.getEmployeeId() ?? '')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const { operators } = await crewApi.listOperators()
        setOperators(operators)
        if (!operator && operators.length === 1) setOperator(operators[0]!)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoadingOperators(false)
      }
    })()
  }, [])

  const canSubmit = !!operator && employeeId.trim().length > 0 && pin.length >= 4 && !submitting

  const submit = async () => {
    if (!operator || !canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await crewApi.login(operator.operatorId, employeeId.trim(), pin)
      secureTokenStorage.setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        operatorId: result.profile.operatorId,
        crewId: result.profile.crewId,
        employeeId: result.profile.employeeId,
      })
      secureTokenStorage.setBiometricEnabled(keepLoggedIn)
      useCrewAuthStore.getState().setSession(result.profile)
      // Fresh login = wipe any leftover WatermelonDB rows from a previous
      // crew member on this device, then full-pull. Stops cross-crew data
      // bleed if logout cleanup ever fails.
      void resetAndResync(database)
      router.replace('/login/biometric-enroll')
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'PIN_NOT_SET') {
        router.replace({ pathname: '/login/set-pin', params: { employeeId: employeeId.trim() } })
        return
      }
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a12' }}>
      <WallpaperBg />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 20,
              paddingTop: 32,
              paddingBottom: 40,
              justifyContent: 'center',
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand block */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <Image
                source={require('../../assets/skyhub-logo.png')}
                style={{ width: 220, height: 78, marginBottom: 10 }}
                resizeMode="contain"
              />
              <Text style={{ color: TEXT_FAINT, fontSize: 13, textAlign: 'center', marginTop: 4 }}>Crew companion</Text>
            </View>

            {/* Glass card */}
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 90}
              tint="dark"
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                backgroundColor: 'rgba(12,12,20,0.45)',
              }}
            >
              <View style={{ padding: 22 }}>
                <View style={{ alignItems: 'center', marginBottom: 18 }}>
                  <Text style={{ color: '#fff', fontSize: 19, fontWeight: '600' }}>Sign in</Text>
                  <Text style={{ color: TEXT_FAINT, fontSize: 13, marginTop: 4 }}>
                    Enter your credentials to continue
                  </Text>
                </View>

                {/* Airline */}
                <FieldLabel>Airline</FieldLabel>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  disabled={loadingOperators || operators.length <= 1}
                  style={{
                    height: 46,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: FIELD_BORDER,
                    backgroundColor: FIELD_BG,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  {loadingOperators ? (
                    <ActivityIndicator color={TEXT_DIM} />
                  ) : operator ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: operator.accentColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                          {(operator.iataCode ?? operator.code).slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: TEXT, fontSize: 14, fontWeight: '500' }}>{operator.name}</Text>
                    </View>
                  ) : (
                    <Text style={{ color: PLACEHOLDER, fontSize: 14 }}>Select your airline</Text>
                  )}
                  {operators.length > 1 && <ChevronDown color={TEXT_DIM} size={18} />}
                </Pressable>

                {/* Crew ID */}
                <FieldLabel>Crew ID</FieldLabel>
                <TextInput
                  value={employeeId}
                  onChangeText={setEmployeeId}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="e.g. 10178"
                  placeholderTextColor={PLACEHOLDER}
                  style={{
                    height: 46,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: FIELD_BORDER,
                    backgroundColor: FIELD_BG,
                    paddingHorizontal: 14,
                    fontSize: 14,
                    color: TEXT,
                    marginBottom: 14,
                  }}
                />

                {/* Password */}
                <FieldLabel>Password</FieldLabel>
                <View
                  style={{
                    height: 46,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: FIELD_BORDER,
                    backgroundColor: FIELD_BG,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    marginBottom: 6,
                  }}
                >
                  <TextInput
                    value={pin}
                    onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    secureTextEntry={!showPin}
                    placeholder="••••••"
                    placeholderTextColor={PLACEHOLDER}
                    style={{ flex: 1, fontSize: 14, color: TEXT, letterSpacing: showPin ? 0 : 4 }}
                  />
                  <Pressable onPress={() => setShowPin((v) => !v)} hitSlop={12}>
                    {showPin ? <Eye color={TEXT_DIM} size={18} /> : <EyeOff color={TEXT_DIM} size={18} />}
                  </Pressable>
                </View>

                {/* Keep me logged in */}
                <Pressable
                  onPress={() => setKeepLoggedIn((v) => !v)}
                  style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  hitSlop={8}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: keepLoggedIn ? ACCENT : 'rgba(255,255,255,0.30)',
                      backgroundColor: keepLoggedIn ? ACCENT : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {keepLoggedIn && <Check color="#fff" size={12} strokeWidth={3} />}
                  </View>
                  <Text style={{ color: TEXT, fontSize: 13 }}>Keep me logged in</Text>
                </Pressable>

                {error && (
                  <View
                    style={{
                      marginTop: 14,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: 'rgba(239,68,68,0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(239,68,68,0.25)',
                    }}
                  >
                    <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '500' }}>{error}</Text>
                  </View>
                )}

                {/* Sign in */}
                <Pressable
                  disabled={!canSubmit}
                  onPress={submit}
                  style={{
                    marginTop: 18,
                    height: 46,
                    borderRadius: 10,
                    backgroundColor: canSubmit ? '#1e40af' : 'rgba(30,64,175,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#1e40af',
                    shadowOpacity: canSubmit ? 0.45 : 0,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: canSubmit ? 6 : 0,
                  }}
                >
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Signing in…</Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Sign in</Text>
                  )}
                </Pressable>
              </View>
            </BlurView>

            <Text style={{ textAlign: 'center', color: TEXT_FAINT, fontSize: 12, marginTop: 28 }}>skyhub.aero</Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Operator picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgba(20,20,28,0.95)',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              maxHeight: 480,
              overflow: 'hidden',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', padding: 18 }}>Choose your airline</Text>
            <FlatList
              data={operators}
              keyExtractor={(o) => o.operatorId}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />}
              renderItem={({ item }) => {
                const selected = item.operatorId === operator?.operatorId
                return (
                  <Pressable
                    onPress={() => {
                      setOperator(item)
                      setPickerOpen(false)
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      backgroundColor: selected ? 'rgba(62,123,250,0.10)' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: item.accentColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                        {(item.iataCode ?? item.code).slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT, fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
                      {item.country && (
                        <Text style={{ color: TEXT_FAINT, fontSize: 12, marginTop: 2 }}>{item.country}</Text>
                      )}
                    </View>
                    {selected && <Check color={ACCENT} size={16} />}
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  )
}
