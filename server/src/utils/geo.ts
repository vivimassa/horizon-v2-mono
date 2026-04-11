/**
 * Geographic utility functions for great circle distance and route classification.
 */

const EARTH_RADIUS_NM = 3440.065

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Calculate great circle distance using the Haversine formula.
 * @returns Distance in nautical miles
 */
export function calculateGreatCircleDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_NM * c * 10) / 10
}

/**
 * Convert nautical miles to kilometers.
 */
export function nmToKm(nm: number): number {
  return Math.round(nm * 1.852 * 10) / 10
}

/**
 * Determine route type based on country codes and distance.
 */
export function determineRouteType(
  country1Iso2: string | null,
  country2Iso2: string | null,
  distanceNm: number | null,
): 'domestic' | 'regional' | 'international' | 'long-haul' | 'ultra-long-haul' | 'unknown' {
  if (!country1Iso2 || !country2Iso2) return 'unknown'

  if (country1Iso2 === country2Iso2) return 'domestic'

  // Distance-based classification for international routes
  if (distanceNm != null) {
    if (distanceNm >= 5000) return 'ultra-long-haul'
    if (distanceNm >= 3000) return 'long-haul'
    if (distanceNm < 1500) return 'regional'
  }

  return 'international'
}
