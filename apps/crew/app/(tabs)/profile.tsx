import { View, Text, Pressable, Switch } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { useCrewAuthStore } from '../../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'
import { useDatabase } from '../../src/providers/DatabaseProvider'
import { crewApi } from '../../src/lib/api-client'
import { unregisterPush } from '../../src/lib/push-register'

export default function ProfileScreen() {
  const router = useRouter()
  const profile = useCrewAuthStore((s) => s.profile)
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const pushToken = useCrewAuthStore((s) => s.expoPushToken)
  const database = useDatabase()
  const [biometric, setBiometric] = useState(secureTokenStorage.isBiometricEnabled())

  const toggleBiometric = (v: boolean) => {
    secureTokenStorage.setBiometricEnabled(v)
    setBiometric(v)
  }

  const logout = async () => {
    if (pushToken) {
      try {
        await crewApi.logout(pushToken)
        await unregisterPush(pushToken)
      } catch {
        // network failure shouldn't block local logout
      }
    }
    await database.write(async () => {
      await database.unsafeResetDatabase()
    })
    secureTokenStorage.clearSession()
    useCrewAuthStore.getState().logout()
    router.replace('/login/eid-pin')
  }

  return (
    <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
      <View className="px-6 pt-6">
        <Text className="text-[24px] font-bold text-black dark:text-white">
          {profile?.firstName} {profile?.lastName}
        </Text>
        <Text className="mt-1 text-[13px] text-neutral-500">
          {profile?.employeeId} · {profile?.position ?? '—'} · {operator?.name}
        </Text>
      </View>

      <View className="mt-8 px-4">
        <View className="rounded-xl bg-card-light p-4 dark:bg-card-dark">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[14px] font-medium text-black dark:text-white">Biometric unlock</Text>
              <Text className="mt-1 text-[12px] text-neutral-500">Use Face ID / fingerprint to open the app</Text>
            </View>
            <Switch value={biometric} onValueChange={toggleBiometric} trackColor={{ true: accentColor }} />
          </View>
        </View>

        <Pressable
          onPress={logout}
          className="mt-6 h-12 items-center justify-center rounded-lg border"
          style={{ borderColor: '#E63535' }}
        >
          <Text className="text-[15px] font-medium" style={{ color: '#E63535' }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
