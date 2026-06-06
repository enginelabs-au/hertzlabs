import {describe, expect, it} from 'vitest';
import {
  BRAINWAVE_BANDS,
  EXPERIMENTAL_BAND_INDEX,
  formatBeatDisplay,
  formatBeatUnit,
  getBand,
  railBands,
} from '../src/components/ReadoutPanel/brainwaveBands';

describe('formatBeatDisplay / formatBeatUnit', () => {
  it('keeps Hz below 1 kHz', () => {
    expect(formatBeatDisplay(10)).toBe('10.0');
    expect(formatBeatUnit(10)).toBe('Hz');
    expect(formatBeatDisplay(500)).toBe('500');
    expect(formatBeatUnit(500)).toBe('Hz');
  });

  it('switches TARGET to kHz at and above 1000 Hz', () => {
    expect(formatBeatDisplay(1000)).toBe('1.00');
    expect(formatBeatUnit(1000)).toBe('kHz');
    expect(formatBeatDisplay(1500)).toBe('1.50');
    expect(formatBeatUnit(1500)).toBe('kHz');
    expect(formatBeatDisplay(12_000)).toBe('12.0');
    expect(formatBeatUnit(12_000)).toBe('kHz');
  });

  it('uses MHz at and above 1e6 Hz', () => {
    expect(formatBeatUnit(2_000_000)).toBe('MHz');
    expect(formatBeatDisplay(2_000_000)).toBe('2.00');
  });
});

describe('getBand maps frequency to the correct [minHz, maxHz) band', () => {
  it('classifies representative frequencies (wellness label)', () => {
    expect(getBand(0).label).toBe('HEALING');
    expect(getBand(2).label).toBe('DREAM');
    expect(getBand(6).label).toBe('MEDITATE');
    expect(getBand(10).label).toBe('CALM');
    expect(getBand(13).label).toBe('FOCUS');
    expect(getBand(20).label).toBe('ENGAGED');
    expect(getBand(40).label).toBe('COGNITION');
    expect(getBand(60).label).toBe('INSIGHT');
    expect(getBand(100).label).toBe('SYNTHESIS');
    expect(getBand(200).label).toBe('INTEGRATION');
    expect(getBand(400).label).toBe('INFINITE');
  });

  it('exposes the matching scientific name for the TARGET readout', () => {
    expect(getBand(0).scientific).toBe('Infra-slow');
    expect(getBand(2).scientific).toBe('Delta');
    expect(getBand(6).scientific).toBe('Theta');
    expect(getBand(10).scientific).toBe('Alpha');
    expect(getBand(13).scientific).toBe('Alpha-beta');
    expect(getBand(20).scientific).toBe('Beta');
    expect(getBand(40).scientific).toBe('Gamma');
    expect(getBand(60).scientific).toBe('High-gamma');
    expect(getBand(100).scientific).toBe('Very high-gamma');
    expect(getBand(200).scientific).toBe('Supra-gamma');
    expect(getBand(400).scientific).toBe('Omega');
  });

  it('treats each boundary as the start of the next band (half-open intervals)', () => {
    expect(getBand(0.5).label).toBe('DREAM');
    expect(getBand(4).label).toBe('MEDITATE');
    expect(getBand(8).label).toBe('CALM');
    expect(getBand(12).label).toBe('FOCUS');
    expect(getBand(15).label).toBe('ENGAGED');
    expect(getBand(30).label).toBe('COGNITION');
    expect(getBand(50).label).toBe('INSIGHT');
    expect(getBand(80).label).toBe('SYNTHESIS');
    expect(getBand(150).label).toBe('INTEGRATION');
    expect(getBand(280).label).toBe('INFINITE');
  });

  it('keeps values just under a boundary in the lower band', () => {
    expect(getBand(3.999).label).toBe('DREAM');
    expect(getBand(11.999).label).toBe('CALM');
    expect(getBand(49.999).label).toBe('COGNITION');
    expect(getBand(279.999).label).toBe('INTEGRATION');
  });

  it('keeps the 500 Hz premium ceiling in Omega and routes above it to EXPERIMENT', () => {
    expect(getBand(500).label).toBe('INFINITE'); // Omega tops out at 501
    expect(getBand(500).scientific).toBe('Omega');
    expect(getBand(1000).label).toBe('EXPERIMENT');
    expect(getBand(1000).scientific).toBe('Experimental');
    expect(getBand(19000).label).toBe('EXPERIMENT');
  });

  it('falls back to HEALING for negative input and EXPERIMENT for very high / non-finite values', () => {
    expect(getBand(Infinity).label).toBe('EXPERIMENT');
    expect(getBand(99999).label).toBe('EXPERIMENT');
    expect(getBand(-1).label).toBe('HEALING');
  });

  it('exposes contiguous, non-overlapping band ranges', () => {
    for (let i = 1; i < BRAINWAVE_BANDS.length; i++) {
      expect(BRAINWAVE_BANDS[i].minHz).toBe(BRAINWAVE_BANDS[i - 1].maxHz);
    }
  });

  it('spans from 0 Hz up through the experimental audible ceiling (20 kHz)', () => {
    expect(BRAINWAVE_BANDS[0].minHz).toBe(0);
    expect(BRAINWAVE_BANDS[EXPERIMENTAL_BAND_INDEX - 1].maxHz).toBe(501); // Omega
    expect(BRAINWAVE_BANDS[EXPERIMENTAL_BAND_INDEX].maxHz).toBe(1_000_000);
  });

  it('hides the EXPERIMENT band from the rail unless experimental mode is on', () => {
    expect(railBands(false)).toHaveLength(BRAINWAVE_BANDS.length - 1);
    expect(railBands(true)).toHaveLength(BRAINWAVE_BANDS.length);
    expect(railBands(false).some(b => b.label === 'EXPERIMENT')).toBe(false);
    expect(railBands(true).some(b => b.label === 'EXPERIMENT')).toBe(true);
  });
});
