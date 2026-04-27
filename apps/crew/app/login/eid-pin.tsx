import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { crewApi, ApiError } from '../../src/lib/api-client'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'

export default function EidPin() {
  const router = useRouter()
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const [employeeId, setEmployeeId] = useState(secureTokenStorage.getEmployeeId() ?? '')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = employeeId.trim().length > 0 && /^\d{6}$/.test(pin) && operator && !submitting

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
      useCrewAuthStore.getState().setSession(result.profile)
      router.replace('/login/biometric-enroll')
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'PIN_NOT_SET') {
        router.replace({
          pathname: '/login/set-pin',
          params: { employeeId: employeeId.trim() },
        })
        return
      }
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
        <View className="flex-1 px-6 pt-8">
          <Text className="text-[14px] text-neutral-500 dark:text-neutral-400">Signing in to</Text>
          <Text className="mt-1 text-[18px] font-semibold text-black dark:text-white">
            {operator?.name ?? 'SkyHub'}
          </Text>
          <Pressable className="mt-1" onPress={() => router.replace('/login/operator-picker')}>
            <Text className="text-[13px]" style={{ color: accentColor }}>
              Change airline
            </Text>
          </Pressable>

          <View className="mt-10">
            <Text className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">Employee ID</Text>
            <TextInput
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. VJ12345"
              placeholderTextColor="#888"
              className="mt-2 h-12 rounded-lg border border-neutral-200 bg-white px-4 text-[16px] text-black dark:border-neutral-800 dark:bg-card-dark dark:text-white"
            />
          </View>

          <View className="mt-6">
            <Text className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">PIN (6 digits)</Text>
            <TextInput
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor="#888"
              className="mt-2 h-12 rounded-lg border border-neutral-200 bg-white px-4 text-[16px] tracking-widest text-black dark:border-neutral-800 dark:bg-card-dark dark:text-white"
            />
          </View>

          {error && <Text className="mt-4 text-[13px] text-red-500">{error}</Text>}

          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            className="mt-8 h-12 items-center justify-center rounded-lg"
            style={{ backgroundColor: canSubmit ? accentColor : '#88888888' }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-medium text-white">Sign in</Text>
            )}
          </Pressable>

          <Pressable className="mt-6" onPress={() => router.push('/login/set-pin')}>
            <Text className="text-center text-[13px]" style={{ color: accentColor }}>
              First time? Set your PIN
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}
