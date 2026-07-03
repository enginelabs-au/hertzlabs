import {describe, expect, it} from 'vitest';
import {BREATH_PATTERNS, breathPatternToNativeId} from '../src/breathPacer/patterns';

describe('breath patterns', () => {
  it('maps pattern ids to native indices', () => {
    expect(breathPatternToNativeId('box')).toBe(0);
    expect(breathPatternToNativeId('478')).toBe(1);
    expect(breathPatternToNativeId('resonant')).toBe(2);
    expect(breathPatternToNativeId('wimhof')).toBe(3);
    expect(breathPatternToNativeId('alternate')).toBe(4);
  });

  it('defines five presets', () => {
    expect(BREATH_PATTERNS).toHaveLength(5);
    expect(BREATH_PATTERNS[0].cycleSec).toBe(16);
    expect(BREATH_PATTERNS[1].cycleSec).toBe(19);
    expect(BREATH_PATTERNS[2].cycleSec).toBe(11);
    expect(BREATH_PATTERNS[3].cycleSec).toBe(90);
    expect(BREATH_PATTERNS[4].cycleSec).toBe(16);
  });
});
