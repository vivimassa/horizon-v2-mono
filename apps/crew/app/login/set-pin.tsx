import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { crewApi } from '../../src/lib/api-client'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'

export default function SetPin() {
  const router = useRouter()
  const params = useLocalSearchParams<{ employeeId?: string }>()
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const [employeeId, setEmployeeId] = useState(params.employeeId ?? '')
  const [tempPin, setTempPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit =
    operator &&
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
      router.replace('/login/biometric-enroll')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-[24px] font-bold text-black dark:text-white">Set your PIN</Text>
        <Text className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
          Enter the temp PIN issued by Crew Ops, then choose a permanent 6-digit PIN.
        </Text>

        <View className="mt-8 gap-5">
          <Field label="Employee ID" value={employeeId} onChange={setEmployeeId} autoCapitalize="characters" />
          <PinField label="Temp PIN" value={tempPin} onChange={setTempPin} />
          <PinField label="New PIN" value={newPin} onChange={setNewPin} />
          <PinField label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} />
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
            <Text className="text-[15px] font-medium text-white">Set PIN</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  autoCapitalize?: 'none' | 'characters'
}) {
  return (
    <View>
      <Text className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={false}
        className="mt-2 h-12 rounded-lg border border-neutral-200 bg-white px-4 text-[16px] text-black dark:border-neutral-800 dark:bg-card-dark dark:text-white"
      />
    </View>
  )
}

function PinField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Text className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={(t) => props.onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        secureTextEntry
        placeholder="••••••"
        placeholderTextColor="#888"
        className="mt-2 h-12 rounded-lg border border-neutral-200 bg-white px-4 text-[16px] tracking-widest text-black dark:border-neutral-800 dark:bg-card-dark dark:text-white"
      />
    </View>
  )
}
