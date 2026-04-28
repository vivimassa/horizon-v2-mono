import { View } from 'react-native'
import { Tabs } from 'expo-router'
import { Calendar, Gauge, Home, Menu, Plane } from 'lucide-react-native'
import { useTheme } from '../../src/theme/use-theme'
import { WallpaperBg } from '../../src/components/WallpaperBg'

export default function TabsLayout() {
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a12' }}>
      {/* Cycling aviation wallpaper behind every tab. Cards stay opaque
          on top for readability. */}
      <WallpaperBg />

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.textSec,
          tabBarStyle: {
            backgroundColor: t.page,
            borderTopColor: t.border,
            borderTopWidth: 0.5,
            paddingTop: 6,
            height: 76,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
          tabBarItemStyle: { paddingTop: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="roster"
          options={{
            title: 'Roster',
            tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="flights"
          options={{
            title: 'Flights',
            tabBarIcon: ({ color }) => <Plane color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color }) => <Gauge color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <Menu color={color} size={24} />,
          }}
        />
        {/* Inbox screen — accessible from Home bell + push, hidden from bottom bar */}
        <Tabs.Screen name="messages" options={{ href: null }} />
      </Tabs>
    </View>
  )
}
