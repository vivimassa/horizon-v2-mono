import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Lock, CheckCircle, AlertCircle } from 'lucide-react-native'
import { api } from '@skyhub/api'
import { AUTH_COLORS, cardWrapperStyle, inputBaseStyle, inputFocusStyle, labelStyle } from './auth-card-styles'

interface Props {
  token: string | null
  onBack: () => void
  onRequestNewLink: () => void
}

export function ResetPasswordCard({ token, onBack, onRequestNewLink }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwFocused, setPwFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (!token && !done) {
    return (
      <View style={cardWrapperStyle}>
        <View style={{ backgroundColor: AUTH_COLORS.cardBg, padding: 28, gap: 16, alignItems: 'center' }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'rgba(239,68,68,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={24} color="#ef4444" strokeWidth={2} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Invalid link</Text>
          <Text style={{ fontSize: 14, color: AUTH_COLORS.textDim, textAlign: 'center', lineHeight: 20 }}>
            This password reset link is missing or malformed. Please request a new one.
          </Text>
          <Pressable onPress={onRequestNewLink} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(91,141,239,0.9)' }}>Request new link</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const handleSubmit = async () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!token) {
      setError('Missing reset token. Use the link from your email.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await api.resetPassword(token, password)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={cardWrapperStyle}>
      <View style={{ backgroundColor: AUTH_COLORS.cardBg, padding: 28, gap: 20 }}>
        {done ? (
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
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Password reset</Text>
            <Text style={{ fontSize: 14, color: AUTH_COLORS.textDim, textAlign: 'center', lineHeight: 20 }}>
              Your password has been updated. You can now sign in with your new password.
            </Text>
            <Pressable
              onPress={onBack}
              style={{
                width: '100%',
                borderRadius: 10,
                overflow: 'hidden',
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
                style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Sign in</Text>
              </LinearGradient>
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
                <Lock size={22} color={AUTH_COLORS.infoText} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Set new password</Text>
              <Text style={{ fontSize: 13, color: AUTH_COLORS.textFaint }}>Must be at least 8 characters</Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={labelStyle}>NEW PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                textContentType="newPassword"
                editable={!submitting}
                style={[inputBaseStyle, pwFocused && inputFocusStyle]}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={labelStyle}>CONFIRM PASSWORD</Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!submitting}
                onSubmitEditing={handleSubmit}
                style={[inputBaseStyle, confirmFocused && inputFocusStyle]}
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
                  {submitting ? 'Resetting…' : 'Reset password'}
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
