import type { TextStyle, ViewStyle } from 'react-native'

export const AUTH_COLORS = {
  accentFrom: '#1e40af',
  accentTo: '#3b6cf5',
  focusBorder: 'rgba(62,123,250,0.6)',
  idleBorder: 'rgba(255,255,255,0.12)',
  inputBg: 'rgba(255,255,255,0.07)',
  inputBgFocus: 'rgba(255,255,255,0.10)',
  cardBg: 'rgba(12,12,20,0.78)',
  cardBorder: 'rgba(255,255,255,0.10)',
  text: 'rgba(255,255,255,0.95)',
  textDim: 'rgba(255,255,255,0.5)',
  textFaint: 'rgba(255,255,255,0.4)',
  errorBg: 'rgba(239,68,68,0.12)',
  errorBorder: 'rgba(239,68,68,0.25)',
  errorText: '#f87171',
  successBg: 'rgba(34,197,94,0.15)',
  successText: '#22c55e',
  infoBg: 'rgba(62,123,250,0.12)',
  infoText: '#5B8DEF',
}

export const labelStyle: TextStyle = {
  fontSize: 13,
  fontWeight: '600',
  color: AUTH_COLORS.textDim,
  letterSpacing: 0.6,
}

export const inputBaseStyle: TextStyle = {
  height: 44,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: AUTH_COLORS.idleBorder,
  backgroundColor: AUTH_COLORS.inputBg,
  paddingHorizontal: 14,
  fontSize: 14,
  color: AUTH_COLORS.text,
}

export const inputFocusStyle: TextStyle = {
  borderColor: AUTH_COLORS.focusBorder,
  backgroundColor: AUTH_COLORS.inputBgFocus,
}

export const cardWrapperStyle: ViewStyle = {
  width: '100%',
  maxWidth: 400,
  borderRadius: 20,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: AUTH_COLORS.cardBorder,
  shadowColor: '#000',
  shadowOpacity: 0.4,
  shadowRadius: 32,
  shadowOffset: { width: 0, height: 16 },
  elevation: 18,
}
