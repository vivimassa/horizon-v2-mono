import { useState } from 'react'
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, useTheme, useAuthStore } from '@skyhub/ui'
import { api } from '@skyhub/api'
import { tokenStorage } from '../src/lib/token-storage'

export default function LoginScreen() {
  const { palette, accentColor, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      useAuthStore.getState().setUser(user as any)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed'
      const parsed = msg.match(/API \d+:\s*(.*)$/)?.[1]
      let friendly = 'Login failed. Please try again.'
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: palette.text,
              marginBottom: 6,
            }}
          >
            SkyHub
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '400',
              color: palette.textSecondary,
            }}
          >
            Sign in to continue
          </Text>
        </View>

        <Card>
          <View style={{ padding: 16, gap: 14 }}>
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: palette.textSecondary,
                }}
              >
                EMAIL
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@skyhub.aero"
                placeholderTextColor={palette.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!submitting}
                style={{
                  height: 44,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.card,
                  paddingHorizontal: 12,
                  fontSize: 14,
                  color: palette.text,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: palette.textSecondary,
                }}
              >
                PASSWORD
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={palette.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!submitting}
                onSubmitEditing={handleSubmit}
                style={{
                  height: 44,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.card,
                  paddingHorizontal: 12,
                  fontSize: 14,
                  color: palette.text,
                }}
              />
            </View>

            {error && (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.08)',
                  borderLeftWidth: 3,
                  borderLeftColor: '#dc2626',
                  borderRadius: 6,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '500' }}>{error}</Text>
              </View>
            )}

            <Button
              title={submitting ? 'Signing in…' : 'Sign in'}
              variant="primary"
              onPress={handleSubmit}
              disabled={submitting}
              loading={submitting}
            />
          </View>
        </Card>

        {submitting && (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <ActivityIndicator color={accentColor} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
