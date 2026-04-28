/**
 * Hard-coded airport coordinates for the SkyHub Crew map.
 * Phase A — covers the SkyHub Aviation network (Vietnam + regional).
 * Phase B will replace this with a server-synced airports table.
 *
 * Both ICAO and IATA codes are accepted — each row is keyed by both.
 */

interface AirportCoord {
  lat: number
  lng: number
  iata?: string
  icao?: string
}

const TABLE: AirportCoord[] = [
  { iata: 'HAN', icao: 'VVNB', lat: 21.2187, lng: 105.8042 },
  { iata: 'SGN', icao: 'VVTS', lat: 10.8188, lng: 106.652 },
  { iata: 'DAD', icao: 'VVDN', lat: 16.0438, lng: 108.1991 },
  { iata: 'CXR', icao: 'VVCR', lat: 12.227, lng: 109.1908 },
  { iata: 'HPH', icao: 'VVCI', lat: 20.8197, lng: 106.725 },
  { iata: 'TBB', icao: 'VVTH', lat: 13.0496, lng: 109.3338 },
  { iata: 'HUI', icao: 'VVPB', lat: 16.4015, lng: 107.7028 },
  { iata: 'VCA', icao: 'VVCT', lat: 10.0851, lng: 105.7117 },
  { iata: 'VCS', icao: 'VVCS', lat: 8.7318, lng: 106.6328 },
  { iata: 'PXU', icao: 'VVPK', lat: 14.0046, lng: 108.0179 },
  { iata: 'BMV', icao: 'VVBM', lat: 12.6683, lng: 108.1203 },
  { iata: 'UIH', icao: 'VVPC', lat: 13.7549, lng: 109.0422 },
  { iata: 'VKG', icao: 'VVRG', lat: 9.9806, lng: 105.1342 },
  { iata: 'DLI', icao: 'VVDL', lat: 11.75, lng: 108.367 },
  { iata: 'VDH', icao: 'VVDH', lat: 17.515, lng: 106.5907 },
  { iata: 'VDO', icao: 'VVVD', lat: 21.1175, lng: 107.4144 },
  // Regional
  { iata: 'BKK', icao: 'VTBS', lat: 13.69, lng: 100.7501 },
  { iata: 'DMK', icao: 'VTBD', lat: 13.9126, lng: 100.6067 },
  { iata: 'ICN', icao: 'RKSI', lat: 37.4602, lng: 126.4407 },
  { iata: 'GMP', icao: 'RKSS', lat: 37.5583, lng: 126.7906 },
  { iata: 'PUS', icao: 'RKPK', lat: 35.1795, lng: 128.9382 },
  { iata: 'KIX', icao: 'RJBB', lat: 34.4347, lng: 135.244 },
  { iata: 'NRT', icao: 'RJAA', lat: 35.7647, lng: 140.3864 },
  { iata: 'HND', icao: 'RJTT', lat: 35.5494, lng: 139.7798 },
  { iata: 'TPE', icao: 'RCTP', lat: 25.0777, lng: 121.2328 },
  { iata: 'KHH', icao: 'RCKH', lat: 22.5771, lng: 120.3503 },
  { iata: 'HKG', icao: 'VHHH', lat: 22.308, lng: 113.9185 },
  { iata: 'SIN', icao: 'WSSS', lat: 1.3644, lng: 103.9915 },
  { iata: 'KUL', icao: 'WMKK', lat: 2.7456, lng: 101.7099 },
  { iata: 'DPS', icao: 'WADD', lat: -8.7482, lng: 115.1672 },
  { iata: 'CGK', icao: 'WIII', lat: -6.1256, lng: 106.6559 },
  { iata: 'MNL', icao: 'RPLL', lat: 14.5086, lng: 121.0194 },
  { iata: 'CEB', icao: 'RPVM', lat: 10.3075, lng: 123.9794 },
  { iata: 'PEK', icao: 'ZBAA', lat: 40.0801, lng: 116.5846 },
  { iata: 'PVG', icao: 'ZSPD', lat: 31.1434, lng: 121.8052 },
  { iata: 'CTU', icao: 'ZUUU', lat: 30.5785, lng: 103.9471 },
  { iata: 'CAN', icao: 'ZGGG', lat: 23.3924, lng: 113.2988 },
  { iata: 'KMG', icao: 'ZPPP', lat: 25.1019, lng: 102.9292 },
  { iata: 'PNH', icao: 'VDPP', lat: 11.5466, lng: 104.8441 },
  { iata: 'REP', icao: 'VDSR', lat: 13.4106, lng: 103.8129 },
  { iata: 'VTE', icao: 'VLVT', lat: 17.9883, lng: 102.5633 },
]

const map = (() => {
  const m = new Map<string, AirportCoord>()
  for (const row of TABLE) {
    if (row.iata) m.set(row.iata.toUpperCase(), row)
    if (row.icao) m.set(row.icao.toUpperCase(), row)
  }
  return m
})()

export function lookupAirport(code: string | null | undefined): { lat: number; lng: number } | null {
  if (!code) return null
  const r = map.get(code.toUpperCase())
  if (!r) return null
  return { lat: r.lat, lng: r.lng }
}
