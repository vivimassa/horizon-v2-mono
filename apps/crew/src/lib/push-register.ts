import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { crewApi } from './api-client'

export interface RegisteredPush {
  expoPushToken: string
  platform: 'ios' | 'android'
}

/**
 * Request OS push permission, fetch the Expo push token, and register it
 * with the SkyHub server. Idempotent — calling repeatedly is safe.
 *
 * Returns null when:
 *   - Running in simulator (Expo push tokens require real hardware)
 *   - User denies the permission prompt
 */
export async function registerForPush(): Promise<RegisteredPush | null> {
  if (!Device.isDevice) {
    console.warn('[push] simulator detected — skipping push registration')
    return null
  }

  if (Platform.OS === 'android') {
    // Channel setup is required on Android 8+ for notifications to be
    // visible. We declare the three channels the server emits to.
    await Notifications.setNotificationChannelAsync('roster', {
      name: 'Roster updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1e40af',
    })
    await Notifications.setNotificationChannelAsync('message', {
      name: 'Messages from Crew Control',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    })
    await Notifications.setNotificationChannelAsync('reminder', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') {
    console.warn('[push] permission denied')
    return null
  }

  const projectId = (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId
  const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  const platform = (Platform.OS === 'ios' ? 'ios' : 'android') as 'ios' | 'android'

  await crewApi.registerPushToken(tokenResp.data, platform)
  return { expoPushToken: tokenResp.data, platform }
}

export async function unregisterPush(token: string): Promise<void> {
  try {
    await crewApi.unregisterPushToken(token)
  } catch (err) {
    console.warn('[push] unregister failed', (err as Error).message)
  }
}
