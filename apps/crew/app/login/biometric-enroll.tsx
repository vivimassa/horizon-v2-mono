import { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isBiometricAvailable, promptBiometric } from '../../src/lib/biometric-gate'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { useCrewOperatorStore } from '../../src/stores/use-crew-operator-store'

export default function BiometricEnroll() {
  const router = useRouter()
  const accentColor = useCrewOperatorStore((s) => s.accentColor)
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => setAvailable(await isBiometricAvailable()))()
  }, [])

  const enable = async () => {
    const ok = await promptBiometric('Enable biometric unlock')
    if (ok) secureTokenStorage.setBiometricEnabled(true)
    router.replace('/(tabs)')
  }

  const skip = () => {
    secureTokenStorage.setBiometricEnabled(false)
    router.replace('/(tabs)')
  }

  if (available === null) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={accentColor} />
      </View>
    )
  }

  if (!available) {
    // No biometric hardware / not enrolled at OS level — skip silently.
    setTimeout(skip, 0)
    return null
  }

  return (
    <SafeAreaView className="flex-1 bg-page-light dark:bg-page-dark">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-[22px] font-bold text-black dark:text-white">Faster sign-in</Text>
        <Text className="mt-2 text-center text-[14px] text-neutral-600 dark:text-neutral-400">
          Use Face ID or your fingerprint to unlock SkyHub Crew next time. You can change this in Settings.
        </Text>

        <Pressable
          onPress={enable}
          className="mt-10 h-12 w-full items-center justify-center rounded-lg"
          style={{ backgroundColor: accentColor }}
        >
          <Text className="text-[15px] font-medium text-white">Enable biometric unlock</Text>
        </Pressable>

        <Pressable onPress={skip} className="mt-4">
          <Text className="text-[14px]" style={{ color: accentColor }}>
            Not now
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
