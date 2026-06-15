import {describe, expect, it} from 'vitest';
import {getProtocolsForEngine} from '../src/protocol/builtinProtocols';
import {
  inferTargetTotalSecFromConversation,
  inferTargetTotalSecFromPrompt,
  parseExplicitProtocolFromConversation,
  parseExplicitProtocolFromPrompt,
  promptHasExplicitSequenceNumbers,
} from '../src/ai/parseProtocolFromPrompt';
import {
  computeProtocolTotalSec,
  computeStepsTotalSec,
  evaluateProtocolAt,
  normalizeProtocol,
  scaleProtocolStepsToTotalSec,
} from '../src/protocol/interpolateProtocol';
import {
  parseFadeOutFromConversation,
  parseFadeOutFromText,
} from '../src/ai/parseProtocolFromPrompt';
import {isSequenceRequestInConversation} from '../src/ai/protocolGeneration';
import type {ChatTurn} from '../src/ai/aiPromptParsing';

describe('parseExplicitProtocolFromPrompt', () => {
  it('parses hold then glide steps', () => {
    const p = parseExplicitProtocolFromPrompt(
      '10 min at 12 Hz then 20 min ramp from 12 to 6 Hz',
      'binaural',
    );
    expect(p).not.toBeNull();
    expect(p!.steps).toHaveLength(2);
    expect(p!.steps[0].durationSec).toBe(600);
    expect(p!.steps[1].durationSec).toBe(1200);
  });

  it('parses short few-minute session', () => {
    const p = parseExplicitProtocolFromPrompt('3 minute sequence at 14 Hz', 'binaural');
    expect(p!.steps[0].durationSec).toBe(180);
    expect(p!.steps[0].endBeatHz).toBe(14);
  });

  it('parses seconds', () => {
    const p = parseExplicitProtocolFromPrompt('90 seconds at 8 Hz', 'binaural');
    expect(p!.steps[0].durationSec).toBe(90);
  });

  it('parses multi-hour session', () => {
    expect(inferTargetTotalSecFromPrompt('2 hour sleep sequence')).toBe(7200);
  });

  it('detects explicit numbers in prompt', () => {
    expect(promptHasExplicitSequenceNumbers('10 min at 12 hz')).toBe(true);
    expect(promptHasExplicitSequenceNumbers('help me sleep')).toBe(false);
  });
});

describe('inferTargetTotalSecFromConversation', () => {
  it('uses newest duration refinement', () => {
    const history: ChatTurn[] = [{role: 'user', text: 'Create a 45 minute sleep sequence'}];
    expect(inferTargetTotalSecFromConversation(history, 'actually make it 20 minutes')).toBe(20 * 60);
  });

  it('pulls duration from earlier turn when latest only asks to build', () => {
    const history: ChatTurn[] = [{role: 'user', text: 'I want 2 hours of theta entrainment'}];
    expect(inferTargetTotalSecFromConversation(history, 'build a sequence for that')).toBe(7200);
  });

  it('combines multi-turn step specs', () => {
    const history: ChatTurn[] = [{role: 'user', text: '10 min at 12 Hz'}];
    const p = parseExplicitProtocolFromConversation(history, 'then 5 min at 6 Hz', 'binaural');
    expect(p!.steps).toHaveLength(2);
    expect(computeProtocolTotalSec(p!.steps)).toBe(15 * 60);
  });
});

describe('isSequenceRequestInConversation', () => {
  it('detects sequence follow-up with prior duration', () => {
    const history: ChatTurn[] = [{role: 'user', text: '45 minute sleep journey'}];
    expect(isSequenceRequestInConversation(history, 'turn that into a sequence')).toBe(true);
  });
});

describe('duration scaling to user total', () => {
  it('scales preset steps to requested total', () => {
    const preset = normalizeProtocol({
      ...getProtocolsForEngine('binaural').find(p => /sleep/i.test(p.title))!,
    });
    const targetSec = 45 * 60;
    const scaled = normalizeProtocol({
      ...preset,
      steps: scaleProtocolStepsToTotalSec(preset.steps, targetSec),
    });
    expect(computeProtocolTotalSec(scaled.steps)).toBe(targetSec);
  });

  it('scales to short 3-minute total', () => {
    const preset = normalizeProtocol({
      ...getProtocolsForEngine('binaural').find(p => /sleep/i.test(p.title))!,
    });
    const scaled = normalizeProtocol({
      ...preset,
      steps: scaleProtocolStepsToTotalSec(preset.steps, 180),
    });
    expect(computeStepsTotalSec(scaled.steps)).toBe(180);
  });
});

describe('protocol fade out', () => {
  it('parses fade duration and volume range', () => {
    expect(parseFadeOutFromText('fade out over 2 minutes from 40% to 5%')).toEqual({
      fadeOutDurationSec: 120,
      fadeOutStartGain: 0.4,
      fadeOutEndGain: 0.05,
    });
  });

  it('evaluates gain during end fade', () => {
    const protocol = normalizeProtocol({
      id: 't',
      title: 'T',
      description: '',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 60,
      fadeOutStartGain: 0.4,
      fadeOutEndGain: 0,
      steps: [
        {
          id: 'a',
          label: 'Hold',
          durationSec: 120,
          startBeatHz: 10,
          endBeatHz: 10,
          curve: 'linear',
          startGain: 0.4,
          endGain: 0.4,
          engineMode: 'binaural',
        },
      ],
    });
    const midFade = evaluateProtocolAt(protocol, 150);
    expect(midFade.stepLabel).toBe('Fade out');
    expect(midFade.gain).toBeCloseTo(0.2, 1);
    expect(computeProtocolTotalSec(protocol)).toBe(180);
  });

  it('reads fade from earlier chat turn', () => {
    const patch = parseFadeOutFromConversation(
      [{role: 'user', text: 'use a 90 second fade to silence'}],
      'build the sequence',
    );
    expect(patch?.fadeOutDurationSec).toBe(90);
    expect(patch?.fadeOutEndGain).toBe(0);
  });
});
