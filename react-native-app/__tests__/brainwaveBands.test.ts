import {describe, expect, it} from 'vitest';
import {BRAINWAVE_BANDS, getBand} from '../src/components/ReadoutPanel/brainwaveBands';

describe('getBand maps frequency to the correct [minHz, maxHz) band', () => {
  it('classifies representative frequencies', () => {
    expect(getBand(0).label).toBe('HEALING');
    expect(getBand(2).label).toBe('DREAM');
    expect(getBand(6).label).toBe('MEDITATE');
    expect(getBand(10).label).toBe('CALM');
    expect(getBand(13).label).toBe('FOCUS');
    expect(getBand(20).label).toBe('ENGAGED');
    expect(getBand(40).label).toBe('COGNITION');
    expect(getBand(150).label).toBe('COGNITION');
  });

  it('treats each boundary as the start of the next band (half-open intervals)', () => {
    expect(getBand(0.5).label).toBe('DREAM');
    expect(getBand(4).label).toBe('MEDITATE');
    expect(getBand(8).label).toBe('CALM');
    expect(getBand(12).label).toBe('FOCUS');
    expect(getBand(15).label).toBe('ENGAGED');
    expect(getBand(30).label).toBe('COGNITION');
  });

  it('keeps values just under a boundary in the lower band', () => {
    expect(getBand(3.999).label).toBe('DREAM');
    expect(getBand(11.999).label).toBe('CALM');
  });

  it('falls back to HEALING for negative input and COGNITION for very high values', () => {
    expect(getBand(Infinity).label).toBe('COGNITION');
    expect(getBand(-1).label).toBe('HEALING');
  });

  it('exposes contiguous, non-overlapping band ranges', () => {
    for (let i = 1; i < BRAINWAVE_BANDS.length; i++) {
      expect(BRAINWAVE_BANDS[i].minHz).toBe(BRAINWAVE_BANDS[i - 1].maxHz);
    }
  });
});
