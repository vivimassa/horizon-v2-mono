/**
 * Centralized marketing imagery — Unsplash-hosted aviation photography.
 * Every ID here is verified working (reused from apps/web/src/app/hub/page.tsx
 * and apps/web/src/components/wallpaper-bg.tsx). Swap to in-house photography
 * before public launch.
 */

const U = (id: string, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`

// ── Verified Unsplash IDs already rendering elsewhere in the app ──
const TARMAC_BLUE_HOUR = 'photo-1533456307239-052e029c1362'
const RAMP_VEHICLES = 'photo-1464037866556-6812c9d1c72e'
const PILOTS_WALKING = 'photo-1503468120394-03d29a34a0bf' // ← crew ops
const WING_ON_TARMAC_NIGHT = 'photo-1751698158488-9faa95a179f8'
const COCKPIT_NIGHT = 'photo-1510505216937-86d3219fa1fd'
const FOGGY_AIRPORT = 'photo-1689414871831-a395df32941e'
const PLANE_NIGHT_SKY = 'photo-1758473788156-e6b2ae00c77d'
const PLANE_CLOUDY_NIGHT = 'photo-1695775147307-690ce4b1ee97'
const WING_CLOUDS_GOLDEN = 'photo-1436491865332-7a61a109cc05'
const EMIRATES_RUNWAY = 'photo-1569154941061-e231b4725ef1'
const PLANE_TAIL_BLUE = 'photo-1540962351504-03099e0a754b'
const TURBINE = 'photo-1521727857535-28d2047314ac'
const WING_BRIGHT_CLOUDS = 'photo-1474302770737-173ee21bab63'

export const mktImages = {
  // Core suites
  network: U(EMIRATES_RUNWAY, 1600),
  flightOps: U(COCKPIT_NIGHT, 1600),
  crewOps: U(PILOTS_WALKING, 1600), // pilots walking through airport
  groundOps: U(RAMP_VEHICLES, 1600),
  heroDashboard: U(WING_ON_TARMAC_NIGHT, 1800),

  // Services
  training: U(COCKPIT_NIGHT),
  audit: U(TURBINE),
  crewPlanning: U(PILOTS_WALKING),
  customization: U(WING_ON_TARMAC_NIGHT),

  // About principles
  webFirst: U(WING_BRIGHT_CLOUDS),
  aiCopilot: U(COCKPIT_NIGHT),
  operatorOwned: U(FOGGY_AIRPORT),
  builtByOps: U(PLANE_CLOUDY_NIGHT),

  // How it works
  stepUnify: U(TARMAC_BLUE_HOUR),
  stepAutomate: U(TURBINE),
  stepDecide: U(PLANE_TAIL_BLUE),
} as const

export type MktImageKey = keyof typeof mktImages
