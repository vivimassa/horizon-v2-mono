import { Redirect } from 'expo-router'

// The Admin tab has no standalone landing — tapping it jumps to the hub
// carousel with System Administration (sysadmin) auto-opened, mirroring the
// web app's `/hub?domain=sysadmin` behaviour. The same redirect runs when a
// Database sub-screen swipes back and ends up on this route by accident.
export default function AdminRedirect() {
  return <Redirect href={{ pathname: '/(tabs)/', params: { domain: 'sysadmin' } }} />
}
