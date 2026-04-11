export type CargoFlightStatus = 'loading' | 'scheduled' | 'onTime' | 'delayed' | 'cancelled'

export interface CargoFlight {
  id: string
  dep: string
  arr: string
  std: string
  sta: string
  status: CargoFlightStatus
  aircraftType: string
  tailNumber: string
  cargoLoaded: number
  cargoCapacity: number
  loadPercent: number
}

export type HoldKey = 'fwd' | 'aft' | 'bulk'

export interface CargoHold {
  key: HoldKey
  name: string
  weight: number
  capacity: number
  percent: number
  items: CargoItem[]
}

export interface CargoItem {
  id: string
  weight: number
  type: string
  priority: 'normal' | 'rush' | 'mail' | null
  dimensions?: string
  destination?: string
}

export interface DockItem {
  id: string
  weight: number
  type: string
}

export interface CompartmentZone {
  holdKey: HoldKey
  imageHalf: 'fwd' | 'aft'
  top: string
  left: string
  width: string
  height: string
}

export interface AircraftCargoConfig {
  type: string
  zones: CompartmentZone[]
}
