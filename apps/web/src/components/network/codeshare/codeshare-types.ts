// ── Codeshare Manager — Local Types & Constants ──
// Data interfaces are imported from @skyhub/api.
// This file only has UI-specific types, enums, and display constants.

export type AgreementType = 'free_sale' | 'block_space' | 'hard_block'
export type AgreementStatus = 'active' | 'pending' | 'suspended' | 'terminated'
export type MappingStatus = 'active' | 'pending' | 'cancelled'
export type MappingHealth = 'valid' | 'orphaned' | 'route_mismatch' | 'type_mismatch'
export type TabKey = 'mappings' | 'details' | 'capacity' | 'ssim'

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  free_sale: 'Free-sale',
  block_space: 'Block space',
  hard_block: 'Hard block',
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  pending: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
  suspended: { bg: 'rgba(255,136,0,0.12)', text: '#FF8800' },
  terminated: { bg: 'rgba(255,59,59,0.12)', text: '#FF3B3B' },
  cancelled: { bg: 'rgba(255,59,59,0.12)', text: '#FF3B3B' },
}

export const HEALTH_INDICATORS: Record<MappingHealth, { color: string; title: string }> = {
  valid: { color: '#06C270', title: 'Operating flight verified' },
  orphaned: { color: '#FF3B3B', title: 'Operating flight not found in schedule' },
  route_mismatch: { color: '#FF8800', title: 'Route changed in schedule' },
  type_mismatch: { color: '#FF8800', title: 'Aircraft type changed from agreed type' },
}

export const CABIN_CLASSES = [
  { code: 'F', name: 'First', color: '#8b5cf6' },
  { code: 'J', name: 'Business', color: '#3b82f6' },
  { code: 'C', name: 'Business', color: '#3b82f6' },
  { code: 'W', name: 'Premium Economy', color: '#06b6d4' },
  { code: 'Y', name: 'Economy', color: '#22c55e' },
] as const

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'mappings', label: 'Flight mappings' },
  { key: 'details', label: 'Agreement details' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'ssim', label: 'SSIM output' },
]
