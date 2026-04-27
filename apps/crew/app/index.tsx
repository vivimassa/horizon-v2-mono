import { Redirect } from 'expo-router'
import { useCrewAuthStore } from '../src/stores/use-crew-auth-store'
import { useCrewOperatorStore } from '../src/stores/use-crew-operator-store'

export default function Index() {
  const isAuthenticated = useCrewAuthStore((s) => s.isAuthenticated)
  const operator = useCrewOperatorStore((s) => s.selectedOperator)
  if (isAuthenticated) return <Redirect href="/(tabs)" />
  if (!operator) return <Redirect href="/login/operator-picker" />
  return <Redirect href="/login/eid-pin" />
}
