import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { ChevronLeft } from 'lucide-react-native'
import { crewApi } from '../../src/lib/api-client'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { resetAndResync } from '../../src/sync/sync-trigger'
import { WallpaperBg } from '../../src/components/WallpaperBg'

const FIELD_BG = 'rgba(255,255,255,0.07)'
const FIELD_BORDER = 'rgba(255,255,255,0.12)'
const PLACEHOLDER = 'rgba(255,255,255,0.35)'
const TEXT = 'rgba(255,255,255,0.92)'
const TEXT_FAINT = 'rgba(255,255,255,0.40)'

export default function SetPin() {
  const router = useRouter()
  const params = useLocalSearchParams<{ employeeId?: string }>()
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  const database = useDatabase()
  const [employeeId, setEmployeeId] = useState(params.employeeId ?? '')
  const [tempPin, setTempPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit =
    !!operator &&
    employeeId.trim().length > 0 &&
    /^\d{6}$/.test(tempPin) &&
    /^\d{6}$/.test(newPin) &&
    newPin === confirmPin &&
    !submitting

  const submit = async () => {
    if (!operator || !canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await crewApi.setPin(operator.operatorId, employeeId.trim(), tempPin, newPin)
      secureTokenStorage.setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        operatorId: result.profile.operatorId,
        crewId: result.profile.crewId,
        employeeId: result.profile.employeeId,
      })
      useCrewAuthStore.getState().setSession(result.profile)
      // Wipe any stale local DB from previous crew + full-pull.
      void resetAndResync(database)
      router.replace('/login/biometric-enroll')
    } catch (err) {
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
              paddingTop: 16,
              paddingBottom: 40,
              justifyContent: 'center',
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => router.replace('/login/eid-pin')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 4,
                paddingVertical: 6,
                paddingRight: 12,
              }}
              hitSlop={8}
            >
              <ChevronLeft color={TEXT_FAINT} size={18} />
              <Text style={{ color: TEXT_FAINT, fontSize: 13 }}>Back</Text>
            </Pressable>

            <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 24 }}>
              <Image
                source={require('../../assets/skyhub-logo.png')}
                style={{ width: 200, height: 70 }}
                resizeMode="contain"
              />
            </View>

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
                <Text style={{ color: '#fff', fontSize: 19, fontWeight: '600' }}>Set your PIN</Text>
                <Text style={{ color: TEXT_FAINT, fontSize: 13, marginTop: 4, lineHeight: 19, marginBottom: 20 }}>
                  Enter the temporary PIN issued by Crew Ops, then choose a permanent 6-digit PIN.
                </Text>

                <Field label="Crew ID" value={employeeId} onChange={setEmployeeId} autoCapitalize="characters" />
                <PinField label="Temporary PIN" value={tempPin} onChange={setTempPin} />
                <PinField label="New PIN" value={newPin} onChange={setNewPin} />
                <PinField label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} />

                {error && (
                  <View
                    style={{
                      marginTop: 12,
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
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Set PIN</Text>
                  )}
                </Pressable>
              </View>
            </BlurView>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  autoCapitalize?: 'none' | 'characters'
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <FieldLabel>{props.label}</FieldLabel>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        placeholderTextColor={PLACEHOLDER}
        style={{
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: FIELD_BORDER,
          backgroundColor: FIELD_BG,
          paddingHorizontal: 14,
          fontSize: 14,
          color: TEXT,
        }}
      />
    </View>
  )
}

function PinField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <FieldLabel>{props.label}</FieldLabel>
      <TextInput
        value={props.value}
        onChangeText={(t) => props.onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        placeholder="••••••"
        placeholderTextColor={PLACEHOLDER}
        style={{
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: FIELD_BORDER,
          backgroundColor: FIELD_BG,
          paddingHorizontal: 14,
          fontSize: 14,
          letterSpacing: 4,
          color: TEXT,
        }}
      />
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
