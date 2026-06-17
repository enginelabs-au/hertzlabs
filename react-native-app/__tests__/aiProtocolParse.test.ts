import {describe, expect, it} from 'vitest';
import {sanitizeBeatHzFromModel, promptMentionsCarrierOrPitch} from '../src/ai/beatHzSanitize';
import {generateProtocolFromPrompt} from '../src/ai/protocolGeneration';
import {
  buildIntentParsingText,
  isConversationContinuation,
} from '../src/ai/parseProtocolFromPrompt';
import type {ChatTurn} from '../src/ai/aiPromptParsing';

describe('sanitizeBeatHzFromModel', () => {
  it('keeps normal beat values', () => {
    expect(sanitizeBeatHzFromModel(13)).toBe(13);
    expect(sanitizeBeatHzFromModel('12.5 hz')).toBe(12.5);
  });

  it('fixes kHz confusion (10000 → 10 Hz beat)', () => {
    expect(sanitizeBeatHzFromModel(10000)).toBe(10);
    expect(sanitizeBeatHzFromModel('10 khz')).toBe(10);
  });

  it('clamps out-of-range high values', () => {
    expect(sanitizeBeatHzFromModel(800)).toBe(500);
  });
});

describe('promptMentionsCarrierOrPitch', () => {
  it('detects explicit pitch requests', () => {
    expect(promptMentionsCarrierOrPitch('raise the carrier to 440')).toBe(true);
    expect(promptMentionsCarrierOrPitch('focus at 12 hz')).toBe(false);
  });
});

describe('multi-turn chat intent parsing', () => {
  const sleepTurn: ChatTurn[] = [
    {role: 'user', text: 'Create a sleep sequence ramping down over 45 minutes'},
    {role: 'assistant', text: 'Sleep sequence applied.'},
  ];

  it('treats a new topic as latest-only intent text', () => {
    expect(isConversationContinuation(sleepTurn, 'Help me focus for work')).toBe(false);
    expect(buildIntentParsingText(sleepTurn, 'Help me focus for work')).toBe(
      'Help me focus for work',
    );
  });

  it('does not re-run the sleep sequencer for a unrelated follow-up', async () => {
    const result = await generateProtocolFromPrompt('Help me focus for work', {
      history: sleepTurn,
    });
    expect(result).toBeNull();
  });

  it('keeps merged context for explicit continuations', () => {
    const history: ChatTurn[] = [
      {role: 'user', text: 'Sweep through every band over 20 minutes'},
      {role: 'assistant', text: 'Band sweep applied.'},
    ];
    expect(isConversationContinuation(history, 'now reverse that')).toBe(true);
    expect(buildIntentParsingText(history, 'now reverse that')).toContain('Sweep through every band');
  });
});
