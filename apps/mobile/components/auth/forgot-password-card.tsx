import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native'
import { api } from '@skyhub/api'
import { AUTH_COLORS, cardWrapperStyle, inputBaseStyle, inputFocusStyle, labelStyle } from './auth-card-styles'

interface Props {
  onBack: () => void
}

export function ForgotPasswordCard({ onBack }: Props) {
  const [email, setEmail] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await api.forgotPassword(email.trim())
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={cardWrapperStyle}>
      <View style={{ backgroundColor: AUTH_COLORS.cardBg, padding: 28, gap: 20 }}>
        {sent ? (
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: AUTH_COLORS.successBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={24} color={AUTH_COLORS.successText} strokeWidth={2} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Check your email</Text>
            <Text style={{ fontSize: 14, color: AUTH_COLORS.textDim, textAlign: 'center', lineHeight: 20 }}>
              If an account exists for{' '}
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>{email}</Text>, we&apos;ve sent a
              password reset link. It expires in 1 hour.
            </Text>
            <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <ArrowLeft size={16} color="rgba(91,141,239,0.9)" strokeWidth={2} />
              <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(91,141,239,0.9)' }}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: AUTH_COLORS.infoBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Mail size={22} color={AUTH_COLORS.infoText} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Forgot password?</Text>
              <Text style={{ fontSize: 13, color: AUTH_COLORS.textFaint, textAlign: 'center' }}>
                Enter your email and we&apos;ll send you a reset link
              </Text>
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
                autoFocus
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!submitting}
                onSubmitEditing={handleSubmit}
                style={[inputBaseStyle, emailFocused && inputFocusStyle]}
              />
            </View>

            {error && (
              <View
                style={{
                  backgroundColor: AUTH_COLORS.errorBg,
                  borderColor: AUTH_COLORS.errorBorder,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: AUTH_COLORS.errorText }}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                opacity: submitting ? 0.65 : 1,
                shadowColor: AUTH_COLORS.accentFrom,
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <LinearGradient
                colors={[AUTH_COLORS.accentFrom, AUTH_COLORS.accentTo]}
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
                  {submitting ? 'Sending…' : 'Send reset link'}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={onBack}
              style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={14} color={AUTH_COLORS.textFaint} strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '500', color: AUTH_COLORS.textFaint }}>Back to sign in</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}
