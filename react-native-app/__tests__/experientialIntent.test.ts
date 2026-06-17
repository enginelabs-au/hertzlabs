import {describe, expect, it} from 'vitest';
import {
  buildExperientialGuide,
  buildExperientialProtocol,
  classifyExperientialIntent,
} from '../src/ai/experientialIntent';

describe('classifyExperientialIntent', () => {
  it('detects psychedelic sentiment (incl. common misspelling)', () => {
    expect(classifyExperientialIntent('stimulate a psychadelic experience')?.id).toBe('psychedelic');
    expect(classifyExperientialIntent('stimulate a psychedelic experience')?.id).toBe('psychedelic');
  });

  it('detects chaotic energy', () => {
    expect(classifyExperientialIntent('show me a chaotic energy')?.id).toBe('chaotic');
  });

  it('detects dynamic sequence intent', () => {
    expect(classifyExperientialIntent('create a dynamic sequence')?.id).toBe('dynamic');
  });

  it('ignores unrelated prompts', () => {
    expect(classifyExperientialIntent('what time is it')).toBeNull();
  });
});

describe('buildExperientialProtocol', () => {
  it('builds multi-step protocols for dynamic sentiment', () => {
    const match = classifyExperientialIntent('create a dynamic sequence');
    expect(match).not.toBeNull();
    const protocol = buildExperientialProtocol(match!, 'create a dynamic sequence', 'binaural');
    expect(protocol).not.toBeNull();
    expect(protocol!.steps.length).toBeGreaterThanOrEqual(3);
    expect(protocol!.title.toLowerCase()).toContain('dynamic');
  });

  it('builds visionary arc for psychedelic prompts', () => {
    const match = classifyExperientialIntent('stimulate a psychedelic experience');
    expect(match).not.toBeNull();
    const protocol = buildExperientialProtocol(match!, 'stimulate a psychedelic experience', 'binaural');
    expect(protocol).not.toBeNull();
    expect(protocol!.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('builds zigzag protocol for chaotic energy', () => {
    const match = classifyExperientialIntent('show me chaotic energy');
    expect(match).not.toBeNull();
    const protocol = buildExperientialProtocol(match!, 'show me chaotic energy', 'binaural');
    expect(protocol!.steps.length).toBeGreaterThanOrEqual(4);
  });
});

describe('buildExperientialGuide', () => {
  it('maps serene sentiment without band keywords', () => {
    const match = classifyExperientialIntent('I want something serene and hushed');
    expect(match).not.toBeNull();
    const g = buildExperientialGuide(match!.id, 'I want something serene and hushed');
    expect(g.explanationShort.toLowerCase()).toMatch(/serene|peaceful|calm/);
    expect(g.targetFrequencyHz).toBeCloseTo(9, 0);
  });
});
