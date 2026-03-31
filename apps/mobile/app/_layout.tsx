import React, { useState } from 'react'
import { useColorScheme } from 'react-native'
import { Slot } from 'expo-router'
import { TamaguiProvider } from 'tamagui'
import { tamaguiConfig } from '@horizon/ui'
import { setApiBaseUrl } from '@horizon/api'
import { StatusBar } from 'expo-status-bar'

// Set API base URL for physical device dev
setApiBaseUrl('http://192.168.1.101:3001')

export default function RootLayout() {
  const systemScheme = useColorScheme()
  const [theme] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light')

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </TamaguiProvider>
  )
}
