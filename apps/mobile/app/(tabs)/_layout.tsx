import React from 'react'
import { Tabs } from 'expo-router'
import { useTheme } from 'tamagui'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accentColor.val,
        tabBarInactiveTintColor: theme.tabInactive.val,
        tabBarStyle: {
          backgroundColor: theme.tabBar.val,
          borderTopColor: theme.tabBarBorder.val,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Network' }} />
      <Tabs.Screen name="operations" options={{ title: 'Operations' }} />
      <Tabs.Screen name="ground" options={{ title: 'Ground' }} />
      <Tabs.Screen name="workforce" options={{ title: 'Workforce' }} />
      <Tabs.Screen name="integration" options={{ title: 'Integration' }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin' }} />
    </Tabs>
  )
}
