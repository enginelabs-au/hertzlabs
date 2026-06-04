import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {clampDriftHz, MAX_DRIFT_HZ, MIN_DRIFT_HZ} from '../../audio/channelFrequencies';
import {HertzTheme} from '../../theme/hertzTheme';
import {RadialKnob} from './RadialKnob';

type DriftKnobProps = {
  label: string;
  driftHz: number;
  onChange: (hz: number) => void;
  accent?: string;
  /** Smaller knob for in-hub corner placement. */
  compact?: boolean;
};

function formatDriftHz(hz: number): string {
  const h = clampDriftHz(hz);
  if (h === 0) {
    return '0 Hz';
  }
  return `${h > 0 ? '+' : ''}${h.toFixed(1)} Hz`;
}

/** Per-ear drift (−12…+12 Hz) as a radial knob; same readout as the former horizontal slider. */
export function DriftKnob({
  label,
  driftHz,
  onChange,
  accent = HertzTheme.neon.cyan,
  compact = false,
}: DriftKnobProps) {
  const hz = clampDriftHz(driftHz);

  const onKnobChange = useCallback((v: number) => onChange(clampDriftHz(v)), [onChange]);

  return (
    <View style={styles.wrap}>
      <RadialKnob
        size={compact ? 'compact' : 'default'}
        label={label}
        value={hz}
        min={MIN_DRIFT_HZ}
        max={MAX_DRIFT_HZ}
        onChange={onKnobChange}
        color={accent}
        format={formatDriftHz}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
});
