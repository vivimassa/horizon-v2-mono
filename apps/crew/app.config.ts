import type { ExpoConfig } from 'expo/config'

/**
 * Expo dynamic config for SkyHub Crew.
 *
 * Why dynamic (app.config.ts) instead of static (app.json):
 *   - `android.googleServicesFile` MUST resolve to a real file at build
 *     time. The file is git-ignored (it identifies our Firebase project
 *     and we treat it as sensitive even though Firebase doesn't strictly
 *     require it). EAS injects it at build time via a file-type
 *     environment variable named GOOGLE_SERVICES_JSON, which contains a
 *     filesystem path on the build VM. Locally, we fall back to the
 *     working-tree copy at `./google-services.json`.
 */

const googleServicesPath = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'

const config: ExpoConfig = {
  name: 'SkyHub Crew',
  slug: 'skyhub-crew',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0E0E14',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.skyhub.crew',
    infoPlist: {
      NSFaceIDUsageDescription: 'SkyHub Crew uses Face ID to unlock the app and protect your roster.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0E0E14',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: true,
    package: 'com.skyhub.crew',
    googleServicesFile: googleServicesPath,
    permissions: ['android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT'],
  },
  scheme: 'skyhubcrew',
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-local-authentication',
      { faceIDPermission: 'SkyHub Crew uses Face ID to unlock the app and protect your roster.' },
    ],
  ],
  notification: {
    color: '#1e40af',
    androidMode: 'default',
    androidCollapsedTitle: 'SkyHub Crew',
  },
  extra: {
    router: {},
    eas: {
      projectId: 'd8386d58-098c-4bbc-a821-4c54bb781dcf',
    },
  },
  owner: 'horizon.129',
}

export default config
