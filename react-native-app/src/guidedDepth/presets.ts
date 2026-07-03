import type {BreathPatternId} from '../breathPacer/patterns';

export type GuidedDepthPresetId =
  | 'delta_sleep'
  | 'theta_unwind'
  | 'theta_body_scan'
  | 'delta_safe_place';

export type GuidedDepthPreset = {
  id: GuidedDepthPresetId;
  label: string;
  tag: string;
  beatHz: number;
  breathPatternId: BreathPatternId;
  breathDeltaDb: number;
  /** Text-only guided relaxation cues (non-clinical). */
  scriptLines: string[];
  safetyNote: string;
};

export const GUIDED_DEPTH_PRESETS: GuidedDepthPreset[] = [
  {
    id: 'delta_sleep',
    label: 'Deep Rest',
    tag: 'Delta · slow breath',
    beatHz: 2,
    breathPatternId: '478',
    breathDeltaDb: 3.5,
    scriptLines: [
      'Settle into a comfortable position. Nothing to fix right now.',
      'With each slow exhale, let your shoulders soften.',
      'Imagine the day drifting behind you — you are safe to rest.',
    ],
    safetyNote:
      'Guided relaxation for personal wellness — not hypnosis therapy or medical treatment. Stop anytime.',
  },
  {
    id: 'theta_unwind',
    label: 'Gentle Unwind',
    tag: 'Theta · resonant breath',
    beatHz: 5,
    breathPatternId: 'resonant',
    breathDeltaDb: 4,
    scriptLines: [
      'Bring attention downward — from head to chest, chest to belly.',
      'Each breath is permissive: you may relax a little more.',
      'Let thoughts pass like clouds — no need to hold them.',
    ],
    safetyNote:
      'Guided relaxation for personal wellness — not hypnosis therapy or medical treatment. Stop anytime.',
  },
  {
    id: 'theta_body_scan',
    label: 'Body Scan',
    tag: 'Theta · box breath',
    beatHz: 6,
    breathPatternId: 'box',
    breathDeltaDb: 4.5,
    scriptLines: [
      'Notice your feet — then calves, knees, hips — without judging.',
      'Scan upward: belly, chest, hands, shoulders, jaw.',
      'If you find tension, breathe into it and allow it to ease.',
    ],
    safetyNote:
      'Guided relaxation for personal wellness — not hypnosis therapy or medical treatment. Stop anytime.',
  },
  {
    id: 'delta_safe_place',
    label: 'Safe Place',
    tag: 'Delta · long exhale',
    beatHz: 1.5,
    breathPatternId: '478',
    breathDeltaDb: 3,
    scriptLines: [
      'Picture a place where you feel completely at ease — real or imagined.',
      'Notice colours, sounds, and the feeling of being supported there.',
      'You can return here whenever you choose; this moment is yours.',
    ],
    safetyNote:
      'Guided relaxation for personal wellness — not hypnosis therapy or medical treatment. Stop anytime.',
  },
];

export function guidedDepthPreset(id: GuidedDepthPresetId): GuidedDepthPreset {
  return GUIDED_DEPTH_PRESETS.find(p => p.id === id) ?? GUIDED_DEPTH_PRESETS[0];
}
