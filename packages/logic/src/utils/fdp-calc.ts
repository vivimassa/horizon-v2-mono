/**
 * @file fdp-calc.ts
 * Pure FDP computation — importable from both server actions and client components.
 */

const CAAV_BASE: [number, number, number][] = [
  [360, 800, 780],
  [800, 840, 765],
  [840, 870, 750],
  [870, 900, 735],
  [900, 930, 720],
  [930, 960, 705],
  [960, 990, 690],
  [990, 1020, 675],
  [1020, 300, 660],
  [300, 315, 720],
  [315, 330, 735],
  [330, 345, 750],
  [345, 360, 765],
]

function lookupFdpLimit(reportLocalMinOfDay: number, sectorCount: number): number {
  let baseFdp = 660
  for (const [s, e, fdp] of CAAV_BASE) {
    if (s < e) {
      if (reportLocalMinOfDay >= s && reportLocalMinOfDay < e) {
        baseFdp = fdp
        break
      }
    } else {
      if (reportLocalMinOfDay >= s || reportLocalMinOfDay < e) {
        baseFdp = fdp
        break
      }
    }
  }
  return Math.max(baseFdp - Math.max(0, sectorCount - 2) * 30, 480)
}

export function computeAmendedFdp(params: {
  amendmentType: 'normal' | 'delay_lt4h' | 'delay_gt4h'
  onDutyTimeLocal: string
  offDutyTimeLocal: string
  originalReportTimeLocal?: string
  sectorCount: number
}): { fdpMinutes: number; fdpLimitMinutes: number; isLegal: boolean } {
  const [onH, onM] = params.onDutyTimeLocal.split(':').map(Number)
  const [offH, offM] = params.offDutyTimeLocal.split(':').map(Number)
  const onMin = onH * 60 + onM
  let offMin = offH * 60 + offM
  if (offMin <= onMin) offMin += 1440

  const fdpMinutes = offMin - onMin
  let fdpLimitMinutes: number

  switch (params.amendmentType) {
    case 'normal': {
      fdpLimitMinutes = lookupFdpLimit(onMin, params.sectorCount)
      break
    }
    case 'delay_lt4h': {
      const [origH, origM] = (params.originalReportTimeLocal ?? params.onDutyTimeLocal).split(':').map(Number)
      const origMin = origH * 60 + origM
      fdpLimitMinutes = lookupFdpLimit(origMin, params.sectorCount)
      break
    }
    case 'delay_gt4h': {
      const [origH, origM] = (params.originalReportTimeLocal ?? params.onDutyTimeLocal).split(':').map(Number)
      const origMin = origH * 60 + origM
      const limitOriginal = lookupFdpLimit(origMin, params.sectorCount)
      const limitDelayed = lookupFdpLimit(onMin, params.sectorCount)
      fdpLimitMinutes = Math.min(limitOriginal, limitDelayed)
      break
    }
    default:
      fdpLimitMinutes = lookupFdpLimit(onMin, params.sectorCount)
  }

  return { fdpMinutes, fdpLimitMinutes, isLegal: fdpMinutes <= fdpLimitMinutes }
}
