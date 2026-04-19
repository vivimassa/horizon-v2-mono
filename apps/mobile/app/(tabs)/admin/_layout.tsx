import { Stack } from 'expo-router'

/**
 * System Administration tab — matches the web dock's 7th tab. The existing
 * mobile "settings" folder hosts both master-data AND sysadmin routes today;
 * once it's split per `horizon-db-conventions`, admin-only routes (operator
 * config, users, access rights, company documents) will live under this tab.
 * For now index.tsx renders a minimal landing so the tab has a target.
 */
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
