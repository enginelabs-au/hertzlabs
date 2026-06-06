/** Per-ear frequency offset from binaural L/R (does not change TARGET beat slider). */
export const MIN_DRIFT_HZ = -12;
export const MAX_DRIFT_HZ = 12;

/**
 * Minimum per-ear tone when deriving L/R from carrier ± beat/2.
 * When beat is large relative to carrier, the center is raised so both ears
 * move together and the beat differential is always preserved (never a stuck
 * left channel + rising right "straight tone").
 */
export const MIN_BINAURAL_TONE_HZ = 20;

/**
 * Experimental mode keeps the same binaural model as normal mode (carrier ±
 * beat/2). It only widens the user-facing PITCH (carrier) range via the Ω−/Ω+
 * dials — up to the top of human hearing (20 kHz) and never below 20 Hz — while
 * the beat stays the main slider on the normal tier range. So the produced tone
 * is always audible and always a binaural pair (never a single straight tone).
 */

export type ChannelHz = {leftHz: number; rightHz: number};

export function clampDriftHz(hz: number): number {
  'worklet';
  if (!Number.isFinite(hz)) {
    return 0;
  }
  return Math.min(MAX_DRIFT_HZ, Math.max(MIN_DRIFT_HZ, hz));
}

/**
 * Binaural center frequency: raises carrier when needed so L = C − B/2 and
 * R = C + B/2 both stay ≥ minToneHz. UI-thread safe (worklet).
 */
export function binauralCenterHz(
  carrierHz: number,
  beatHz: number,
  // Literal default (= MIN_BINAURAL_TONE_HZ): Reanimated's worklet transform does
  // not capture module constants used in default-param expressions, so referencing
  // the const here crashes when this worklet is called from another worklet.
  minToneHz: number = 20,
): number {
  'worklet';
  const b = Math.max(0, Number.isFinite(beatHz) ? beatHz : 0);
  const raw = Number.isFinite(carrierHz) ? carrierHz : 200;
  const c0 = Math.max(minToneHz, raw);
  const minCenter = b / 2 + minToneHz;
  return Math.max(c0, minCenter);
}

/** L/R tone Hz from carrier, beat differential, and per-channel drift. */
export function channelFrequencies(
  carrierHz: number,
  beatHz: number,
  leftDriftHz: number,
  rightDriftHz: number,
  // Literal default (= MIN_BINAURAL_TONE_HZ) — see binauralCenterHz: a module
  // constant in a worklet default-param isn't captured and crashes the UI thread.
  minToneHz: number = 20,
): ChannelHz {
  'worklet';
  const b = Math.max(0, Number.isFinite(beatHz) ? beatHz : 0);
  const c = binauralCenterHz(carrierHz, b, minToneHz);
  const dl = clampDriftHz(leftDriftHz);
  const dr = clampDriftHz(rightDriftHz);
  return {
    leftHz: c - b * 0.5 + dl,
    rightHz: c + b * 0.5 + dr,
  };
}

/** Map effective L/R back to native carrier + beat (drift folded into oscillator). */
export function nativeBinauralFromChannels(leftHz: number, rightHz: number): {
  carrierHz: number;
  beatHz: number;
} {
  const left = Math.max(MIN_BINAURAL_TONE_HZ, leftHz);
  const right = Math.max(MIN_BINAURAL_TONE_HZ, rightHz);
  return {
    carrierHz: (left + right) / 2,
    // Near-zero (not 0) floor keeps Experimental-mode ultra-slow modulation alive.
    beatHz: Math.max(1e-18, right - left),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Visual-only mapping (oscilloscope / Lissajous)
//
// The hub scope reproduces the original (previous-commit) look exactly and never
// draws anything outside the normal [0.5, 500] Hz band. Experimental-mode pitches
// can be far outside that band; the scope simply holds the boundary pattern there
// (the AUDIO path still uses the literal pitch). This is decoupled from the audio.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Oscilloscope visual band. The previous-commit scope only ever showed beats in
 * this range (the slider was 0.5–500 Hz), so the hub scope clamps to it.
 */
export const SCOPE_VISUAL_MIN_BEAT_HZ = 0.5;
export const SCOPE_VISUAL_MAX_BEAT_HZ = 500;

/**
 * Hub oscilloscope stereo pair — the exact previous-commit mapping (carrier ±
 * beat/2 with a 0.5 Hz ear floor), with the visual beat CLAMPED to [0.5, 500] Hz
 * so the scope never renders anything outside the normal frequency band. Used for
 * BOTH normal and Experimental mode (Experimental pitches beyond the band hold the
 * boundary pattern). Visual only — audio uses the literal pitch. Worklet-safe.
 */
export function scopeStereoHz(
  carrierHz: number,
  beatHz: number,
  leftDriftHz: number,
  rightDriftHz: number,
): ChannelHz {
  'worklet';
  const c = Math.max(20, Number.isFinite(carrierHz) ? carrierHz : 220);
  const raw = Number.isFinite(beatHz) ? beatHz : 10;
  const b = Math.min(SCOPE_VISUAL_MAX_BEAT_HZ, Math.max(SCOPE_VISUAL_MIN_BEAT_HZ, raw));
  const dl = clampDriftHz(leftDriftHz);
  const dr = clampDriftHz(rightDriftHz);
  return {
    leftHz: Math.max(SCOPE_VISUAL_MIN_BEAT_HZ, c - b * 0.5 + dl),
    rightHz: Math.max(SCOPE_VISUAL_MIN_BEAT_HZ, c + b * 0.5 + dr),
  };
}

/** Identity-band floor for the visual fold (matches premium min beat). */
export const VISUAL_BEAT_MIN_HZ = 0.05;
/** Identity-band ceiling: < 2×220 so the left trace never flatlines at 0. */
export const VISUAL_BEAT_MAX_HZ = 435;

/**
 * Fold an arbitrary beat into [VISUAL_BEAT_MIN_HZ, VISUAL_BEAT_MAX_HZ] using a
 * triangle wave in log space. Inside the band it is the identity (normal look is
 * unchanged); outside it sweeps the band back and forth so the patterns keep
 * evolving instead of freezing at extreme beats. Worklet-safe.
 */
export function visualBeatHz(beatHz: number): number {
  'worklet';
  const b = Math.abs(Number.isFinite(beatHz) ? beatHz : 0);
  if (b >= VISUAL_BEAT_MIN_HZ && b <= VISUAL_BEAT_MAX_HZ) {
    return b;
  }
  if (b <= 0) {
    return VISUAL_BEAT_MIN_HZ;
  }
  const lo = Math.log(VISUAL_BEAT_MIN_HZ);
  const hi = Math.log(VISUAL_BEAT_MAX_HZ);
  const span = hi - lo;
  const p = (Math.log(b) - lo) / span;
  const m = ((p % 2) + 2) % 2; // 0..2 (continuous, period 2)
  const tri = m <= 1 ? m : 2 - m; // 0..1..0
  return Math.exp(lo + tri * span);
}

/**
 * Visual-only stereo pair for the hub scope: fixed carrier + folded beat so the
 * Lissajous/edge traces always animate and stay beautiful. NOT used for audio.
 */
export function visualStereoHz(
  carrierHz: number,
  beatHz: number,
  leftDriftHz: number,
  rightDriftHz: number,
): ChannelHz {
  'worklet';
  const c = Math.max(MIN_BINAURAL_TONE_HZ, Number.isFinite(carrierHz) ? carrierHz : 220);
  const b = visualBeatHz(beatHz);
  const dl = clampDriftHz(leftDriftHz);
  const dr = clampDriftHz(rightDriftHz);
  return {
    leftHz: Math.max(0.5, c - b * 0.5 + dl),
    rightHz: Math.max(0.5, c + b * 0.5 + dr),
  };
}

export function driftNormFromHz(hz: number): number {
  return (clampDriftHz(hz) - MIN_DRIFT_HZ) / (MAX_DRIFT_HZ - MIN_DRIFT_HZ);
}

export function driftHzFromNorm(norm: number): number {
  const n = Math.min(1, Math.max(0, norm));
  return MIN_DRIFT_HZ + n * (MAX_DRIFT_HZ - MIN_DRIFT_HZ);
}
