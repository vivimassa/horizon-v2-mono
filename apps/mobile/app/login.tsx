import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { ScanFace, Fingerprint } from 'lucide-react-native'
import { useAuthStore } from '@skyhub/ui'
import { api, getApiBaseUrl } from '@skyhub/api'
import { tokenStorage } from '../src/lib/token-storage'
import { biometricProfile } from '../src/lib/biometric-profile'
import { biometricLabel, checkBiometricAvailable, promptBiometricVerbose } from '../src/lib/biometric-gate'
import { WallpaperBg } from '../components/hub/wallpaper-bg'
import { ForgotPasswordCard } from '../components/auth/forgot-password-card'
import { ResetPasswordCard } from '../components/auth/reset-password-card'
import type { AuthenticationType } from 'expo-local-authentication'

type AuthView = 'login' | 'forgot' | 'reset'

/** Parse `skyhub://reset-password?token=xxx` (or any URL containing reset-password + token). */
function parseResetUrl(url: string | null): string | null {
  if (!url) return null
  if (!/reset-password/i.test(url)) return null
  const match = url.match(/[?&]token=([^&#]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

const TABLET_WIDTH = 768
const ACCENT_FROM = '#1e40af'
const ACCENT_TO = '#3b6cf5'
const FOCUS_BORDER = 'rgba(62,123,250,0.6)'
const IDLE_BORDER = 'rgba(255,255,255,0.12)'
const INPUT_BG = 'rgba(255,255,255,0.07)'
const INPUT_BG_FOCUS = 'rgba(255,255,255,0.10)'

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const isTabletLayout = width >= TABLET_WIDTH

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioName, setBioName] = useState('Face ID')
  const profile = biometricProfile.get()
  const canQuickLogin = bioAvailable && tokenStorage.isBiometricEnabled() && !!profile

  const [view, setView] = useState<AuthView>('login')
  const [resetToken, setResetToken] = useState<string | null>(null)

  // Deep-link listener — handle reset links opened from the email client.
  // Format: skyhub://reset-password?token=xxx (or any URL containing both).
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const t = parseResetUrl(url)
      if (t) {
        setResetToken(t)
        setView('reset')
      }
    })
    const sub = Linking.addEventListener('url', ({ url }) => {
      const t = parseResetUrl(url)
      if (t) {
        setResetToken(t)
        setView('reset')
      }
    })
    return () => sub.remove()
  }, [])

  // Card slide-in animation matching web's `login-card` keyframes.
  const cardOpacity = useRef(new Animated.Value(0)).current
  const cardTranslate = useRef(new Animated.Value(24)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 800,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslate, {
        toValue: 0,
        duration: 800,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [cardOpacity, cardTranslate])

  useEffect(() => {
    let cancelled = false
    checkBiometricAvailable().then((cap) => {
      if (cancelled || !cap.available) return
      setBioAvailable(true)
      setBioName(biometricLabel(cap.types as AuthenticationType[]))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const persistBioProfileIfEnabled = (em: string, refresh: string) => {
    if (tokenStorage.isBiometricEnabled()) {
      biometricProfile.set({ email: em, refreshToken: refresh })
    }
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { accessToken, refreshToken, user } = await api.login(email.trim(), password)
      tokenStorage.setTokens(accessToken, refreshToken)
      useAuthStore.getState().setTokens(accessToken, refreshToken)
      useAuthStore.getState().setUser(user as never)
      persistBioProfileIfEnabled(email.trim(), refreshToken)
    } catch (e) {
      console.log('[login] API base:', getApiBaseUrl())
      console.log('[login] error:', e)
      const msg = e instanceof Error ? e.message : 'Login failed'
      const parsed = msg.match(/API \d+:\s*(.*)$/)?.[1]
      let friendly = msg || 'Login failed. Please try again.'
      if (parsed) {
        try {
          const body = JSON.parse(parsed)
          if (body?.error) friendly = body.error
        } catch {
          friendly = parsed
        }
      }
      setError(friendly)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBiometricLogin = async () => {
    if (!profile) {
      setError('No saved sign-in. Use your password to enable Face ID again.')
      return
    }
    setError(null)
    const result = await promptBiometricVerbose(`Sign in to SkyHub with ${bioName}`)
    console.log('[login] biometric result:', result)
    if (!result.success) {
      const reason = (result as { error?: string }).error
      // Silent reasons: user cancellations and the missing_usage_description
      // warning that fires on iOS until the native rebuild ships
      // NSFaceIDUsageDescription. Surface anything else as a visible error.
      const silent = reason && /cancel|missing_usage_description/i.test(reason)
      if (reason && !silent) {
        setError(`${bioName} failed: ${reason}`)
      }
      return
    }
    setSubmitting(true)
    try {
      const { accessToken, refreshToken } = await api.refreshToken(profile.refreshToken)
      tokenStorage.setTokens(accessToken, refreshToken)
      useAuthStore.getState().setTokens(accessToken, refreshToken)
      const user = await api.getMe()
      useAuthStore.getState().setUser(user as never)
      biometricProfile.set({ email: profile.email, refreshToken })
    } catch (e) {
      console.log('[login] biometric refresh error:', e)
      biometricProfile.clear()
      tokenStorage.setBiometricEnabled(false)
      setError(`${bioName} session expired. Sign in with your password.`)
    } finally {
      setSubmitting(false)
    }
  }

  const BioIcon = bioName === 'Face ID' ? ScanFace : Fingerprint

  const card = (
    <Animated.View
      style={{
        width: '100%',
        maxWidth: 400,
        opacity: cardOpacity,
        transform: [{ translateY: cardTranslate }],
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 32,
        shadowOffset: { width: 0, height: 16 },
        elevation: 18,
      }}
    >
      <View style={{ backgroundColor: 'rgba(12,12,20,0.78)' }}>
        <View style={{ padding: 28, gap: 20 }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Sign in</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Enter your credentials to continue</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="you@airline.aero"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!submitting}
              style={[inputStyle, emailFocused && inputFocusStyle]}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.35)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              editable={!submitting}
              onSubmitEditing={handleSubmit}
              style={[inputStyle, passwordFocused && inputFocusStyle]}
            />
            <Pressable
              onPress={() => {
                setError(null)
                setView('forgot')
              }}
              style={{ alignSelf: 'flex-end', marginTop: 4 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(91,141,239,0.85)' }}>Forgot password?</Text>
            </Pressable>
          </View>

          {error && (
            <View
              style={{
                backgroundColor: 'rgba(239,68,68,0.12)',
                borderColor: 'rgba(239,68,68,0.25)',
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#f87171' }}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              borderRadius: 10,
              overflow: 'hidden',
              opacity: submitting ? 0.65 : 1,
              shadowColor: ACCENT_FROM,
              shadowOpacity: 0.45,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={[ACCENT_FROM, ACCENT_TO]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {submitting && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Text>
            </LinearGradient>
          </Pressable>

          {canQuickLogin && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
              </View>
              <Pressable
                onPress={handleBiometricLogin}
                disabled={submitting}
                style={{
                  height: 44,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <BioIcon size={18} color="#fff" strokeWidth={1.8} />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Sign in with {bioName}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  )

  const activeCard =
    view === 'forgot' ? (
      <ForgotPasswordCard onBack={() => setView('login')} />
    ) : view === 'reset' ? (
      <ResetPasswordCard
        token={resetToken}
        onBack={() => {
          setResetToken(null)
          setView('login')
        }}
        onRequestNewLink={() => {
          setResetToken(null)
          setView('forgot')
        }}
      />
    ) : (
      card
    )

  const branding = (
    <View style={{ gap: 24, maxWidth: 420 }}>
      <Image
        source={require('../assets/skyhub-logo.png')}
        tintColor="#fff"
        style={{ width: 220, height: 120, resizeMode: 'contain' }}
      />
      <View style={{ height: 1, width: 64, backgroundColor: 'rgba(255,255,255,0.2)' }} />
      <Text style={{ fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.55)' }}>
        Network planning, movement control, crew operations, and ground handling — unified in one intelligent system.
      </Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a12' }}>
      <WallpaperBg isDark overlayOpacity={0.65} />
      <KeyboardAvoidingView
        // On tablet there's plenty of room — let the keyboard overlay without
        // shifting the layout. Phone keeps padding-avoid so the card isn't
        // hidden behind the keyboard.
        behavior={!isTabletLayout && Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
          scrollEnabled={!isTabletLayout}
          keyboardShouldPersistTaps="handled"
        >
          {isTabletLayout ? (
            <View style={{ flex: 1, flexDirection: 'row', minHeight: 600 }}>
              <View
                style={{
                  flex: 1,
                  justifyContent: 'flex-end',
                  paddingHorizontal: 56,
                  paddingVertical: 56,
                }}
              >
                {branding}
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 56,
                  paddingVertical: 56,
                }}
              >
                {activeCard}
              </View>
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 24,
                paddingVertical: 40,
              }}
            >
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <Image
                  source={require('../assets/skyhub-logo.png')}
                  tintColor="#fff"
                  style={{ width: 180, height: 64, resizeMode: 'contain' }}
                />
              </View>
              {card}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const labelStyle = {
  fontSize: 13,
  fontWeight: '600' as const,
  color: 'rgba(255,255,255,0.5)',
  letterSpacing: 0.6,
}

const inputStyle = {
  height: 44,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: IDLE_BORDER,
  backgroundColor: INPUT_BG,
  paddingHorizontal: 14,
  fontSize: 14,
  color: 'rgba(255,255,255,0.95)',
}

const inputFocusStyle = {
  borderColor: FOCUS_BORDER,
  backgroundColor: INPUT_BG_FOCUS,
}
