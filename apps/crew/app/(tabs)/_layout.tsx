import { View } from 'react-native'
import { Tabs } from 'expo-router'
import { WallpaperBg } from '../../src/components/WallpaperBg'
import { GlassTabBar } from '../../src/components/GlassTabBar'

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <WallpaperBg />

      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="roster" options={{ title: 'Roster' }} />
        <Tabs.Screen name="flights" options={{ title: 'Flights' }} />
        <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
        <Tabs.Screen name="more" options={{ title: 'More' }} />
        {/* Inbox screen — accessible from Home bell + push, hidden from bottom bar */}
        <Tabs.Screen name="messages" options={{ href: null }} />
      </Tabs>
    </View>
  )
}
