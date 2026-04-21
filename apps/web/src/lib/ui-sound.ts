/**
 * Synthesized UI sounds for the hub carousel.
 *
 * Two sounds, both generated with Web Audio API — no audio files shipped:
 *   - carouselTick(): Netflix-style "click" on carousel page change.
 *   - hoverTak():     iOS-keyboard-style "tak" on section row hover.
 *
 * The AudioContext is lazy + resumed on first call so we never fight the
 * browser autoplay policy (any call happens in response to a real gesture).
 */

let ctx: AudioContext | null = null
let lastTakAt = 0
const TAK_THROTTLE_MS = 40

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** Short noise buffer used to add "texture" to clicks. Cached after first build. */
let noiseBuf: AudioBuffer | null = null
function getNoise(ac: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf
  const len = Math.floor(ac.sampleRate * 0.08)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuf = buf
  return buf
}

/**
 * Netflix-style carousel tick — a short, bright, filtered noise burst with
 * a pitched thump underneath. ~60ms total.
 */
export function carouselTick() {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime

  // Filtered noise burst (the "click" texture)
  const noise = ac.createBufferSource()
  noise.buffer = getNoise(ac)
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 900
  const bp = ac.createBiquadFilter()
  bp.type = 'lowpass'
  bp.frequency.value = 2600
  bp.Q.value = 0.9
  const ng = ac.createGain()
  ng.gain.setValueAtTime(0, t0)
  ng.gain.linearRampToValueAtTime(0.11, t0 + 0.003)
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055)
  noise.connect(hp).connect(bp).connect(ng).connect(ac.destination)
  noise.start(t0)
  noise.stop(t0 + 0.08)

  // Pitched thump (low-mid body)
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(520, t0)
  osc.frequency.exponentialRampToValueAtTime(280, t0 + 0.05)
  const og = ac.createGain()
  og.gain.setValueAtTime(0, t0)
  og.gain.linearRampToValueAtTime(0.18, t0 + 0.004)
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
  osc.connect(og).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + 0.08)

  // Sub-bass thump — sine pitch-drop for weight. Longer tail than the click
  // so you feel it after the transient, like a soft kick.
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(180, t0)
  sub.frequency.exponentialRampToValueAtTime(55, t0 + 0.09)
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0, t0)
  sg.gain.linearRampToValueAtTime(0.42, t0 + 0.006)
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
  sub.connect(sg).connect(ac.destination)
  sub.start(t0)
  sub.stop(t0 + 0.24)
}

/**
 * Netflix-style "select" — deeper, warmer, more confirming than the tick.
 * A soft whoomph with a low body that resolves over ~180ms. Used when the
 * user commits to opening a carousel card (not when just centering one).
 */
export function carouselSelect() {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime

  // Sub thump — deep pitch drop, warm body
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(220, t0)
  sub.frequency.exponentialRampToValueAtTime(70, t0 + 0.12)
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0, t0)
  sg.gain.linearRampToValueAtTime(0.5, t0 + 0.008)
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
  sub.connect(sg).connect(ac.destination)
  sub.start(t0)
  sub.stop(t0 + 0.3)

  // Mid "confirm" tone — slight upward bump then settle, feels resolving
  const mid = ac.createOscillator()
  mid.type = 'triangle'
  mid.frequency.setValueAtTime(380, t0)
  mid.frequency.exponentialRampToValueAtTime(520, t0 + 0.04)
  mid.frequency.exponentialRampToValueAtTime(340, t0 + 0.18)
  const mg = ac.createGain()
  mg.gain.setValueAtTime(0, t0)
  mg.gain.linearRampToValueAtTime(0.14, t0 + 0.01)
  mg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
  mid.connect(mg).connect(ac.destination)
  mid.start(t0)
  mid.stop(t0 + 0.22)

  // Low-passed noise for soft "air" on the attack
  const noise = ac.createBufferSource()
  noise.buffer = getNoise(ac)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  const ng = ac.createGain()
  ng.gain.setValueAtTime(0, t0)
  ng.gain.linearRampToValueAtTime(0.09, t0 + 0.003)
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
  noise.connect(lp).connect(ng).connect(ac.destination)
  noise.start(t0)
  noise.stop(t0 + 0.06)
}

/**
 * Lighter sibling of carouselSelect — used for dismissing/closing (Back
 * button). Same warm character, but shorter, quieter, and purely descending
 * (no "rise-and-settle" curve — that reads as *confirm*, which we don't want
 * on a back action). ~140ms total.
 */
export function carouselDismiss() {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime

  // Sub thump — shallower pitch drop, lower gain than select
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(180, t0)
  sub.frequency.exponentialRampToValueAtTime(75, t0 + 0.09)
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0, t0)
  sg.gain.linearRampToValueAtTime(0.3, t0 + 0.008)
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
  sub.connect(sg).connect(ac.destination)
  sub.start(t0)
  sub.stop(t0 + 0.22)

  // Mid tone — monotonic descent, no rise (reads as "release")
  const mid = ac.createOscillator()
  mid.type = 'triangle'
  mid.frequency.setValueAtTime(440, t0)
  mid.frequency.exponentialRampToValueAtTime(260, t0 + 0.12)
  const mg = ac.createGain()
  mg.gain.setValueAtTime(0, t0)
  mg.gain.linearRampToValueAtTime(0.09, t0 + 0.008)
  mg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14)
  mid.connect(mg).connect(ac.destination)
  mid.start(t0)
  mid.stop(t0 + 0.16)
}

/**
 * iOS-keyboard-style "tak" — very short, dry, pitched click. ~25ms.
 * Throttled so sweeping across many rows doesn't machine-gun.
 */
export function hoverTak() {
  const now = performance.now()
  if (now - lastTakAt < TAK_THROTTLE_MS) return
  lastTakAt = now

  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime

  // Low thump body — pitch-drop sine. Short so rapid hovers don't muddy.
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(140, t0)
  sub.frequency.exponentialRampToValueAtTime(60, t0 + 0.05)
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0, t0)
  sg.gain.linearRampToValueAtTime(0.22, t0 + 0.004)
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)
  sub.connect(sg).connect(ac.destination)
  sub.start(t0)
  sub.stop(t0 + 0.1)

  // Muted noise transient — low-passed so no "tak" sparkle, just a soft tap
  const noise = ac.createBufferSource()
  noise.buffer = getNoise(ac)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 700
  const ng = ac.createGain()
  ng.gain.setValueAtTime(0, t0)
  ng.gain.linearRampToValueAtTime(0.06, t0 + 0.002)
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025)
  noise.connect(lp).connect(ng).connect(ac.destination)
  noise.start(t0)
  noise.stop(t0 + 0.03)
}
