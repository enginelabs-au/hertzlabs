import type {EngineMode, SubscriptionTier} from '../state/types';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';

export type {EngineMode};

export const FREE_MODES: readonly EngineMode[] = ['binaural', 'monaural', 'isochronic'];

export const PREMIUM_MODES: readonly EngineMode[] = [
  'binaural',
  'monaural',
  'isochronic',
  'hemisphericSync',
  'phaseModulated',
  'pitchPanning',
  'musicModulation',
];

export function allowedModes(tier: SubscriptionTier): readonly EngineMode[] {
  return isPremiumUnlocked(tier) ? PREMIUM_MODES : FREE_MODES;
}

/**
 * Returns true if the given mode is accessible for the given tier.
 */
export function isModeAllowed(mode: EngineMode, tier: SubscriptionTier): boolean {
  return (allowedModes(tier) as EngineMode[]).includes(mode);
}

/**
 * Returns the requested mode if allowed for the tier, or falls back to 'binaural'
 * on subscription-lapse downgrade.
 */
export function resolveEngineMode(requested: EngineMode, tier: SubscriptionTier): EngineMode {
  return isModeAllowed(requested, tier) ? requested : 'binaural';
}

export interface EngineMeta {
  mode: EngineMode;
  label: string;
  tag: string;
  group: string;
  requiresHeadphones: boolean;
  isPremium: boolean;
  shortDesc: string;
  deepDive: string;
}

export const ENGINE_CATALOG: EngineMeta[] = [
  {
    mode: 'binaural',
    label: 'Binaural',
    tag: 'Dichotic',
    group: 'Entrainment Engine',
    requiresHeadphones: true,
    isPremium: false,
    shortDesc: 'Two pure tones, one per ear. The brain computes the difference as an internal beat.',
    deepDive:
      'Two pure sine tones at slightly different frequencies are delivered separately to each ear via stereo headphones. The left and right auditory cortices receive each tone independently, and the brain perceives the arithmetic difference as a phantom internal beat — not present in the air, only in neural summation. This is the gold-standard binaural entrainment pathway, proven in peer-reviewed studies. Requires stereo headphones for proper dichotic separation.',
  },
  {
    mode: 'hemisphericSync',
    label: 'Hemispheric Sync',
    tag: 'Phase Alignment',
    group: 'Entrainment Engine',
    requiresHeadphones: true,
    isPremium: true,
    shortDesc: 'Phase-locks both hemispheres via a controlled inter-aural phase offset.',
    deepDive:
      'Delivers the same carrier frequency to both ears simultaneously, but with a precisely controlled phase offset between the left and right channels. Instead of an arithmetic beat, the brain tracks the phase relationship, promoting bilateral cortical coherence. Used in clinical settings to support creative flow, deep meditation, and cross-hemispheric integration. Requires stereo headphones. Premium feature.',
  },
  {
    mode: 'monaural',
    label: 'Monaural',
    tag: 'Open Speaker',
    group: 'Acoustic Interference Engine',
    requiresHeadphones: false,
    isPremium: false,
    shortDesc: 'Two tones mixed in air. Interference creates a real, audible amplitude envelope.',
    deepDive:
      'Two sine tones at slightly different frequencies are played simultaneously through the same channel (or speaker). They physically interfere in the air before reaching your ears, producing a real amplitude-modulated envelope — the beating is genuinely present in the acoustic wave, not just perceived internally. Works through speakers or single-ear buds. No stereo headphones required. Effective but slightly less frequency-precise than binaural due to room acoustics.',
  },
  {
    mode: 'isochronic',
    label: 'Isochronic',
    tag: 'Pulsed Amplitude',
    group: 'Acoustic Interference Engine',
    requiresHeadphones: false,
    isPremium: false,
    shortDesc: 'A single tone pulsed on/off at the target entrainment rate.',
    deepDive:
      'A pure sine carrier is switched on and off (pulsed) at precisely the target brainwave entrainment rate, producing sharply defined amplitude pulses. Unlike binaural or monaural beats, there is no second frequency — the entrainment cue is entirely temporal (rhythmic). Isochronic pulses can be more perceptually intense and are effective through speakers without headphones. Commonly used in protocols targeting focus, alertness, and wakefulness due to the strong rhythmic stimulus.',
  },
  {
    mode: 'phaseModulated',
    label: 'Phase Modulated',
    tag: 'Fluid Sweep',
    group: 'Modulated & Dynamic Engine',
    requiresHeadphones: true,
    isPremium: true,
    shortDesc: 'The carrier phase sweeps continuously, creating a flowing immersive tone.',
    deepDive:
      'Instead of a fixed frequency difference, the carrier tone undergoes continuous phase modulation — the instantaneous phase advances and retreats sinusoidally at the beat rate. The result is a rich, flowing, harmonically complex tone that many users find more immersive and less fatiguing than pure dichotic beats. Phase modulation stimulates the auditory cortex in a more distributed pattern, potentially improving sustained entrainment over longer sessions. Requires stereo headphones. Premium feature.',
  },
  {
    mode: 'pitchPanning',
    label: 'Pitch Panning',
    tag: 'Vector Spatialization',
    group: 'Modulated & Dynamic Engine',
    requiresHeadphones: true,
    isPremium: true,
    shortDesc: 'Beat encoded as lateral stereo movement, stimulating spatial processing.',
    deepDive:
      'The carrier tone sweeps across the stereo field at the entrainment rate — moving from left to right and back in synchrony with the target beat frequency. This recruits both the auditory pathway and the spatial processing networks in the parietal cortex, producing a multi-modal entrainment stimulus. The sense of movement through space creates a distinctly different subjective experience compared to static binaural beats. Requires stereo headphones. Premium feature.',
  },
  {
    mode: 'musicModulation',
    label: 'Music Modulation',
    tag: 'Natural Embedding',
    group: 'Modulated & Dynamic Engine',
    requiresHeadphones: true,
    isPremium: true,
    shortDesc: 'Beat embedded into ambient music — more natural, less fatiguing.',
    deepDive:
      "The target beat frequency is embedded as a subtle amplitude modulation across the full audio spectrum of a background music track. Rather than an obvious synthetic tone, the entrainment cue rides the natural timbre of music — guitars, pads, or orchestral textures carry the beat in a transparent, non-intrusive way. This approach is significantly less fatiguing for extended sessions and may improve entrainment compliance in users who find pure tone entrainment uncomfortable. Requires stereo headphones. Premium feature.",
  },
];
