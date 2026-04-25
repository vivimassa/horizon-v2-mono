/**
 * Maps MODULE_REGISTRY.route (which targets web paths) onto the actual
 * Expo Router paths that exist on mobile. Modules not in this map are
 * treated as "not yet implemented on mobile" — the hub shows them as
 * disabled so we don't route the user into a not-found screen.
 *
 * When a new mobile screen lands, add its mapping here. When the web and
 * mobile paths diverge (e.g. /admin/airports on web → /settings/airports
 * on mobile), this is the single source of truth that reconciles them.
 */
export const HUB_ROUTE_MAP: Record<string, string> = {
  // ── Top-level domain landings ──
  '/network': '/(tabs)/network',
  '/flight-ops': '/(tabs)/flight-ops',
  '/ground-ops': '/(tabs)/ground-ops',
  '/crew-ops': '/(tabs)/crew-ops',
  '/crew-ops/control/documents': '/(tabs)/crew-ops/documents',
  '/settings': '/(tabs)/settings/master-database',

  // ── Network (1.*) ──
  '/network/control/schedule-grid': '/(tabs)/network/schedule-grid',

  // ── Ground Ops (3.*) ──
  // Closest mobile equivalent to "Cargo Manifest" is the cargo-loading screen.
  '/ground-ops/cargo/cargo-manifest': '/(tabs)/ground-ops/cargo-loading',

  // ── Master Database · Network (5.1.*) ──
  '/admin/countries': '/(tabs)/settings/countries',
  '/admin/airports': '/(tabs)/settings/airports',
  '/admin/city-pairs': '/(tabs)/settings/citypairs',
  '/admin/lopa': '/(tabs)/settings/lopa',
  '/admin/service-types': '/(tabs)/settings/service-types',
  '/admin/carrier-codes': '/(tabs)/settings/carrier-codes',

  // ── Master Database · Flight Ops (5.2.*) ──
  '/admin/aircraft-types': '/(tabs)/settings/aircraft-types',
  '/admin/aircraft-registrations': '/(tabs)/settings/aircraft-registrations',
  '/admin/delay-codes': '/(tabs)/settings/delay-codes',
  '/admin/maintenance-checks': '/(tabs)/settings/maintenance-checks',
  '/admin/non-crew-people': '/(tabs)/settings/non-crew-people',

  // ── Master Database · Crew Ops (5.4.*) ──
  '/admin/crew-bases': '/(tabs)/settings/crew-bases',
  '/admin/crew-positions': '/(tabs)/settings/crew-positions',
  '/admin/expiry-codes': '/(tabs)/settings/expiry-codes',
  '/admin/activity-codes': '/(tabs)/settings/activity-codes',
  '/admin/crew-complements': '/(tabs)/settings/crew-complements',
  '/admin/crew-groups': '/(tabs)/settings/crew-groups',
  '/admin/fdt-rules': '/(tabs)/settings/fdt-rules',
  '/admin/duty-patterns': '/(tabs)/settings/duty-patterns',
  '/admin/mpp-lead-times': '/(tabs)/settings/mpp-lead-times',
  '/admin/crew-hotels': '/(tabs)/settings/crew-hotels',
  '/network/control/schedule-gantt': '/(tabs)/network/gantt',
  '/network/schedule/gantt': '/(tabs)/network/gantt',

  // ── System Administration (7.1.*) ──
  '/settings/admin/operator-config': '/(tabs)/settings/operator-config',
  '/sysadmin/company-documents': '/(tabs)/settings/company-documents',
  '/settings/admin/integration/asm-ssm-transmission': '/(tabs)/settings/asm-ssm-transmission',
  '/settings/admin/integration/acars-mvt-ldm-transmission': '/(tabs)/settings/acars-mvt-ldm-transmission',
}

/** Returns the Expo Router path for a given registry web route, or null if unimplemented. */
export function resolveMobileRoute(webRoute: string): string | null {
  if (!webRoute) return null
  return HUB_ROUTE_MAP[webRoute] ?? null
}
