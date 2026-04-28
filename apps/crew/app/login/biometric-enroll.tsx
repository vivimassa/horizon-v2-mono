import { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, Image, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { Fingerprint } from 'lucide-react-native'
import { isBiometricAvailable, promptBiometric } from '../../src/lib/biometric-gate'
import { secureTokenStorage } from '../../src/lib/secure-token-storage'
import { WallpaperBg } from '../../src/components/WallpaperBg'

const TEXT_FAINT = 'rgba(255,255,255,0.40)'
const ACCENT = '#3e7bfa'

export default function BiometricEnroll() {
  const router = useRouter()
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
      <View style={{ flex: 1, backgroundColor: '#0a0a12', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    )
  }

  if (!available) {
    setTimeout(skip, 0)
    return null
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a12' }}>
      <WallpaperBg />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
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
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(62,123,250,0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(62,123,250,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 18,
                }}
              >
                <Fingerprint color={ACCENT} size={40} />
              </View>

              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '600', textAlign: 'center' }}>
                Faster sign-in
              </Text>
              <Text
                style={{
                  color: TEXT_FAINT,
                  fontSize: 13,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 19,
                  paddingHorizontal: 8,
                }}
              >
                Use Face ID or your fingerprint to unlock SkyHub Crew next time. You can change this in Settings.
              </Text>

              <Pressable
                onPress={enable}
                style={{
                  marginTop: 22,
                  height: 46,
                  width: '100%',
                  borderRadius: 10,
                  backgroundColor: '#1e40af',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#1e40af',
                  shadowOpacity: 0.45,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Enable biometric unlock</Text>
              </Pressable>

              <Pressable onPress={skip} style={{ marginTop: 12, padding: 8 }}>
                <Text style={{ color: TEXT_FAINT, fontSize: 13 }}>Not now</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </SafeAreaView>
    </View>
  )
}
