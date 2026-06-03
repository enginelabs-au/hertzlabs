/**
 * Client-side validation layer for the Gemini `SessionRecommendation` payload.
 *
 * The canonical schema gate is native (Swift `GeminiClient` + `Codable`
 * `SessionRecommendation`, see `.cursor/plans/04_telemetry_ai.md` §6). This
 * module mirrors that rigid schema on the JS side as defense-in-depth and adds
 * the numeric-range enforcement that Swift `Codable` decoding does not perform
 * (targetFrequencyHz 0.5..50.0, intensityScale 0.0..1.0). Any malformed,
 * partial, mistyped, or out-of-range payload is rejected; callers fall back to
 * a locally generated recommendation so an offline/parse error instantly
 * deploys a valid local state.
 */

export const BRAINWAVE_STATES = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma'] as const;
export type BrainwaveState = (typeof BRAINWAVE_STATES)[number];

export const BRAIN_REGIONS = [
  'Prefrontal Cortex',
  'Occipital Lobe',
  'Temporal Lobe',
  'Parietal Lobe',
  'Frontal Lobe',
] as const;
export type BrainRegion = (typeof BRAIN_REGIONS)[number];

export const ENTRAINMENT_STYLES = ['Binaural', 'Isochronic', 'Monaural'] as const;
export type EntrainmentStyle = (typeof ENTRAINMENT_STYLES)[number];

export const MIN_TARGET_FREQUENCY_HZ = 0.5;
export const MAX_TARGET_FREQUENCY_HZ = 50.0;
export const MIN_INTENSITY_SCALE = 0.0;
export const MAX_INTENSITY_SCALE = 1.0;

export type SessionRecommendation = {
  brainwaveState: BrainwaveState;
  targetFrequencyHz: number;
  targetedBrainRegions: BrainRegion[];
  entrainmentStyle: EntrainmentStyle;
  intensityScale: number;
  explanationShort: string;
};

export type TelemetryContext = {
  accelMagnitude: number;
  gyroY: number;
  roll: number;
  stepCadence: number;
  shakeDetected: boolean;
  currentBeatHz: number;
  sessionState: 'playing' | 'paused' | 'idle';
};

export class SessionRecommendationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRecommendationParseError';
  }
}

function isFiniteNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Strictly validates an already-parsed object against the rigid schema.
 * Throws `SessionRecommendationParseError` on any structural, type, enum, or
 * range violation. Rejects extra keys to match the "no extra keys" contract.
 */
export function validateSessionRecommendation(input: unknown): SessionRecommendation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SessionRecommendationParseError('payload is not a JSON object');
  }

  const obj = input as Record<string, unknown>;

  const allowedKeys = [
    'brainwaveState',
    'targetFrequencyHz',
    'targetedBrainRegions',
    'entrainmentStyle',
    'intensityScale',
    'explanationShort',
  ];
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw new SessionRecommendationParseError(`unexpected key: ${key}`);
    }
  }

  if (!BRAINWAVE_STATES.includes(obj.brainwaveState as BrainwaveState)) {
    throw new SessionRecommendationParseError('invalid brainwaveState');
  }

  if (!isFiniteNumberInRange(obj.targetFrequencyHz, MIN_TARGET_FREQUENCY_HZ, MAX_TARGET_FREQUENCY_HZ)) {
    throw new SessionRecommendationParseError('targetFrequencyHz out of range');
  }

  if (
    !Array.isArray(obj.targetedBrainRegions) ||
    obj.targetedBrainRegions.length === 0 ||
    !obj.targetedBrainRegions.every(region => BRAIN_REGIONS.includes(region as BrainRegion))
  ) {
    throw new SessionRecommendationParseError('invalid targetedBrainRegions');
  }

  if (!ENTRAINMENT_STYLES.includes(obj.entrainmentStyle as EntrainmentStyle)) {
    throw new SessionRecommendationParseError('invalid entrainmentStyle');
  }

  if (!isFiniteNumberInRange(obj.intensityScale, MIN_INTENSITY_SCALE, MAX_INTENSITY_SCALE)) {
    throw new SessionRecommendationParseError('intensityScale out of range');
  }

  if (typeof obj.explanationShort !== 'string' || obj.explanationShort.length === 0) {
    throw new SessionRecommendationParseError('invalid explanationShort');
  }

  return {
    brainwaveState: obj.brainwaveState as BrainwaveState,
    targetFrequencyHz: obj.targetFrequencyHz,
    targetedBrainRegions: obj.targetedBrainRegions as BrainRegion[],
    entrainmentStyle: obj.entrainmentStyle as EntrainmentStyle,
    intensityScale: obj.intensityScale,
    explanationShort: obj.explanationShort,
  };
}

/**
 * Parses a raw Gemini response string and validates it against the schema.
 * Throws `SessionRecommendationParseError` on malformed JSON or schema failure.
 */
export function parseSessionRecommendation(raw: string): SessionRecommendation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SessionRecommendationParseError('malformed JSON');
  }
  return validateSessionRecommendation(parsed);
}

/**
 * Offline rule-based fallback. Mirrors the native `RegexFallback` table in
 * `.cursor/plans/04_telemetry_ai.md` §6.3. Always returns a schema-valid
 * recommendation. Priority: shake override → high motion → walking → still → very still → default.
 */
export function offlineFallbackRecommendation(context: TelemetryContext): SessionRecommendation {
  const {accelMagnitude, stepCadence, shakeDetected} = context;

  if (shakeDetected) {
    return {
      brainwaveState: 'Alpha',
      targetFrequencyHz: 10.0,
      targetedBrainRegions: ['Prefrontal Cortex'],
      entrainmentStyle: 'Binaural',
      intensityScale: 0.4,
      explanationShort: 'Gentle motion — alpha wave relaxation mode activated.',
    };
  }
  if (accelMagnitude > 0.7) {
    return {
      brainwaveState: 'Beta',
      targetFrequencyHz: 20.0,
      targetedBrainRegions: ['Frontal Lobe', 'Prefrontal Cortex'],
      entrainmentStyle: 'Binaural',
      intensityScale: 0.75,
      explanationShort: 'Active movement detected — beta focus entrainment engaged.',
    };
  }
  if (stepCadence > 0.4) {
    return {
      brainwaveState: 'Beta',
      targetFrequencyHz: 18.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Temporal Lobe'],
      entrainmentStyle: 'Binaural',
      intensityScale: 0.65,
      explanationShort: 'Active movement detected — beta focus entrainment engaged.',
    };
  }
  if (accelMagnitude < 0.1) {
    return {
      brainwaveState: 'Delta',
      targetFrequencyHz: 2.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Occipital Lobe'],
      entrainmentStyle: 'Binaural',
      intensityScale: 0.3,
      explanationShort: 'Deep rest detected — guiding you into slow-wave recovery.',
    };
  }
  if (accelMagnitude < 0.3) {
    return {
      brainwaveState: 'Theta',
      targetFrequencyHz: 6.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Parietal Lobe'],
      entrainmentStyle: 'Binaural',
      intensityScale: 0.45,
      explanationShort: 'Calm stillness — entering light meditative theta state.',
    };
  }
  return {
    brainwaveState: 'Alpha',
    targetFrequencyHz: 10.0,
    targetedBrainRegions: ['Prefrontal Cortex'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.5,
    explanationShort: 'Gentle motion — alpha wave relaxation mode activated.',
  };
}

/**
 * Parses a raw Gemini response; on any parse/validation failure instantly
 * deploys the local offline fallback derived from the current telemetry context.
 */
export function parseSessionRecommendationOrFallback(
  raw: string,
  context: TelemetryContext,
): SessionRecommendation {
  try {
    return parseSessionRecommendation(raw);
  } catch {
    return offlineFallbackRecommendation(context);
  }
}
