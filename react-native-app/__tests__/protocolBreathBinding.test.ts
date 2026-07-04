import {describe, expect, it, vi} from 'vitest';
import {applyStepBreathBinding, suggestBreathPatternForHz} from '../src/protocol/applyStepBreathBinding';
import {normalizeProtocol} from '../src/protocol/interpolateProtocol';
import type {ProtocolStep} from '../src/protocol/types';

describe('protocol breath binding', () => {
  it('suggests slower breath patterns for lower Hz', () => {
    expect(suggestBreathPatternForHz(2)).toBe('478');
    expect(suggestBreathPatternForHz(6)).toBe('resonant');
    expect(suggestBreathPatternForHz(18)).toBe('box');
  });

  it('normalizeProtocol preserves breathPatternId on steps', () => {
    const protocol = normalizeProtocol({
      id: 't',
      title: 'Test',
      description: '',
      steps: [
        {
          id: 's1',
          label: 'Step',
          durationSec: 60,
          startBeatHz: 10,
          endBeatHz: 8,
          curve: 'linear',
          startGain: 0.4,
          endGain: 0.4,
          engineMode: 'binaural',
          breathPatternId: '478',
        },
      ],
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 0,
      fadeOutStartGain: 0.3,
      fadeOutEndGain: 0.04,
    });
    expect(protocol.steps[0].breathPatternId).toBe('478');
  });

  it('applyStepBreathBinding enables overlay and sets pattern', () => {
    const setBreathPatternId = vi.fn();
    const setBreathPacerEnabled = vi.fn();
    const store = {
      breathPacerEnabled: false,
      breathPatternId: 'box' as const,
      setBreathPatternId,
      setBreathPacerEnabled,
    };
    const step: ProtocolStep = {
      id: 's',
      label: 'Theta',
      durationSec: 600,
      startBeatHz: 6,
      endBeatHz: 4,
      curve: 'linear',
      startGain: 0.4,
      endGain: 0.35,
      engineMode: 'binaural',
      breathPatternId: '478',
    };
    applyStepBreathBinding(store, step);
    expect(setBreathPacerEnabled).toHaveBeenCalledWith(true);
    expect(setBreathPatternId).toHaveBeenCalledWith('478');
  });
});
