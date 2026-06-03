import {describe, expect, it} from 'vitest';
import {BRAINWAVE_BANDS, getBand} from '../src/components/ReadoutPanel/brainwaveBands';

describe('getBand maps frequency to the correct [minHz, maxHz) band', () => {
  it('classifies representative frequencies', () => {
    expect(getBand(0).label).toBe('Epsilon');
    expect(getBand(2).label).toBe('Delta');
    expect(getBand(6).label).toBe('Theta');
    expect(getBand(10).label).toBe('Alpha');
    expect(getBand(13).label).toBe('SMR');
    expect(getBand(20).label).toBe('Beta');
    expect(getBand(40).label).toBe('Gamma');
    expect(getBand(150).label).toBe('Lambda');
  });

  it('treats each boundary as the start of the next band (half-open intervals)', () => {
    expect(getBand(0.5).label).toBe('Delta');
    expect(getBand(4).label).toBe('Theta');
    expect(getBand(8).label).toBe('Alpha');
    expect(getBand(12).label).toBe('SMR');
    expect(getBand(15).label).toBe('Beta');
    expect(getBand(30).label).toBe('Gamma');
    expect(getBand(100).label).toBe('Lambda');
  });

  it('keeps values just under a boundary in the lower band', () => {
    expect(getBand(3.999).label).toBe('Delta');
    expect(getBand(11.999).label).toBe('Alpha');
  });

  it('falls back to the last band (Lambda) for out-of-domain input', () => {
    expect(getBand(Infinity).label).toBe('Lambda');
    expect(getBand(-1).label).toBe('Lambda');
  });

  it('exposes contiguous, non-overlapping band ranges', () => {
    for (let i = 1; i < BRAINWAVE_BANDS.length; i++) {
      expect(BRAINWAVE_BANDS[i].minHz).toBe(BRAINWAVE_BANDS[i - 1].maxHz);
    }
  });
});
