import { useCallback } from 'react'
import { usePreventRemove } from '@react-navigation/native'
import { useNavigation, useRouter } from 'expo-router'

/**
 * Swipe-back from a Master-Database / System-Administration sub-screen lands
 * on the hub home with the matching domain panel re-opened.
 *
 * Critical: we must DISPATCH the original back action first so the current
 * screen is actually torn down. Without that dispatch, `usePreventRemove`
 * keeps the screen mounted — the user's next attempt to navigate to the
 * same route silently reuses that zombie instance and no screen transition
 * happens ("I can only navigate to a page once" bug).
 *
 * Sequence:
 *   1. swipe triggers usePreventRemove callback
 *   2. dispatch(data.action) — native-stack pops the current screen
 *   3. router.replace — switch to the hub tab with ?domain=<key>
 *   4. hub home reads the param and auto-opens that module panel
 */
export type HubDomainKey = 'network' | 'flightops' | 'groundops' | 'crewops' | 'settings' | 'sysadmin'

export function useHubBack(domain: HubDomainKey) {
  const router = useRouter()
  const navigation = useNavigation()

  const onPrevent = useCallback(
    ({ data }: { data: { action: unknown } }) => {
      // Allow the default removal to run — otherwise the screen stays
      // mounted and every subsequent push to the same route is a no-op.
      // @ts-expect-error — navigation.dispatch accepts the action object
      navigation.dispatch(data.action)
      // Then redirect to the hub with the domain pre-opened.
      router.replace({ pathname: '/(tabs)/', params: { domain } } as any)
    },
    [navigation, router, domain],
  )

  usePreventRemove(true, onPrevent)
}
