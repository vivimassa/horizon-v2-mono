import type { CargoFlight, CargoHold, DockItem } from '../types/cargo'

export const MOCK_FLIGHTS: CargoFlight[] = [
  { id: 'SH123', dep: 'SGN', arr: 'HAN', std: '06:30', sta: '08:35', status: 'loading', aircraftType: 'A321', tailNumber: 'VN-A601', cargoLoaded: 2840, cargoCapacity: 4200, loadPercent: 68 },
  { id: 'SH456', dep: 'SGN', arr: 'DAD', std: '07:15', sta: '08:30', status: 'scheduled', aircraftType: 'A320', tailNumber: 'VN-A588', cargoLoaded: 0, cargoCapacity: 3800, loadPercent: 0 },
  { id: 'SH789', dep: 'SGN', arr: 'PQC', std: '08:00', sta: '09:05', status: 'onTime', aircraftType: 'A321', tailNumber: 'VN-A612', cargoLoaded: 3950, cargoCapacity: 4200, loadPercent: 94 },
  { id: 'SH234', dep: 'SGN', arr: 'CXR', std: '09:45', sta: '10:55', status: 'delayed', aircraftType: 'A320', tailNumber: 'VN-A595', cargoLoaded: 310, cargoCapacity: 3800, loadPercent: 8 },
  { id: 'SH567', dep: 'SGN', arr: 'HPH', std: '10:30', sta: '12:40', status: 'scheduled', aircraftType: 'A321', tailNumber: 'VN-A603', cargoLoaded: 0, cargoCapacity: 4200, loadPercent: 0 },
]

export const MOCK_HOLDS: Record<string, CargoHold> = {
  fwd: {
    key: 'fwd', name: 'Forward Hold', weight: 1200, capacity: 1500, percent: 80,
    items: [
      { id: 'ULD-001', weight: 680, type: 'AKE', priority: null },
      { id: 'ULD-002', weight: 520, type: 'AKE', priority: null },
    ],
  },
  aft: {
    key: 'aft', name: 'Aft Hold', weight: 1340, capacity: 2000, percent: 67,
    items: [
      { id: 'ULD-003', weight: 710, type: 'AKE', priority: 'rush' },
      { id: 'ULD-004', weight: 630, type: 'AKE', priority: null },
    ],
  },
  bulk: {
    key: 'bulk', name: 'Bulk Cargo', weight: 300, capacity: 700, percent: 43,
    items: [
      { id: 'BLK-001', weight: 180, type: 'Loose', priority: null },
      { id: 'BLK-002', weight: 120, type: 'Loose', priority: 'mail' },
    ],
  },
}

export const MOCK_DOCK: DockItem[] = [
  { id: 'ULD-005', weight: 450, type: 'AKE' },
  { id: 'ULD-006', weight: 390, type: 'AKE' },
  { id: 'BLK-003', weight: 95, type: 'Loose' },
  { id: 'ULD-007', weight: 820, type: 'AKH' },
]

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; darkBg: string; darkText: string }> = {
  loading: { label: 'Loading', bg: '#dbeafe', text: '#1e40af', darkBg: 'rgba(30,64,175,0.2)', darkText: '#60a5fa' },
  scheduled: { label: 'Scheduled', bg: '#f3f4f6', text: '#6b7280', darkBg: 'rgba(107,114,128,0.15)', darkText: '#9ca3af' },
  onTime: { label: 'On Time', bg: '#dcfce7', text: '#166534', darkBg: 'rgba(22,163,74,0.15)', darkText: '#4ade80' },
  delayed: { label: 'Delayed', bg: '#fee2e2', text: '#991b1b', darkBg: 'rgba(220,38,38,0.15)', darkText: '#f87171' },
  cancelled: { label: 'Cancelled', bg: '#fee2e2', text: '#991b1b', darkBg: 'rgba(220,38,38,0.15)', darkText: '#f87171' },
}

export const HOLD_TABS: { key: 'fwd' | 'aft' | 'bulk'; label: string }[] = [
  { key: 'fwd', label: 'Forward' },
  { key: 'aft', label: 'Aft' },
  { key: 'bulk', label: 'Bulk' },
]
