import { Redirect } from 'expo-router'
import { useCrewAuthStore } from '../src/stores/use-crew-auth-store'

export default function Index() {
  const isAuthenticated = useCrewAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Redirect href="/(tabs)" />
  return <Redirect href="/login/eid-pin" />
}
