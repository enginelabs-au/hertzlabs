import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {useHertzStore} from '../../state/store';
import {ENGINE_CATALOG} from '../../audio/engineModes';

const MONO = 'JetBrainsMono-Regular';
const AMBER = '#FBBF24';

interface FrequencyDisplayProps {
  carrierHz: SharedValue<number>;
  beatHz: SharedValue<number>;
  engineType?: string;
}

/**
 * Readout panel frequency rows per spec:
 *   ENGINE TYPE  — label of the active engine
 *   L CHAN        — carrier - beat/2  (left ear in binaural)
 *   R CHAN        — carrier + beat/2  (right ear in binaural)
 *   TARGET Δ      — beat frequency; turns amber on high-volume warning
 */
export function FrequencyDisplay({carrierHz, beatHz, engineType}: FrequencyDisplayProps) {
  const carrierFromStore = useHertzStore(s => s.carrierHz);
  const beatFromStore = useHertzStore(s => s.beatHz);
  const [carrierVal, setCarrierVal] = useState(carrierFromStore);
  const [beatVal, setBeatVal] = useState(beatFromStore);
  const highVolumeWarning = useHertzStore(s => s.highVolumeWarningTriggered);

  const onCarrier = useCallback((v: number) => setCarrierVal(v), []);
  const onBeat = useCallback((v: number) => setBeatVal(v), []);

  useAnimatedReaction(
    () => carrierHz.value,
    val => {
      runOnJS(onCarrier)(val);
    },
    [onCarrier],
  );
  useAnimatedReaction(
    () => beatHz.value,
    val => {
      runOnJS(onBeat)(val);
    },
    [onBeat],
  );

  const lChan = carrierVal - beatVal / 2;
  const rChan = carrierVal + beatVal / 2;

  const engineLabel =
    engineType != null
      ? (ENGINE_CATALOG.find(e => e.mode === engineType)?.label ?? engineType.toUpperCase())
      : 'BINAURAL';

  const deltaColor = highVolumeWarning ? AMBER : '#FFFFFF';
  const deltaLabelColor = highVolumeWarning ? AMBER : 'rgba(255,255,255,0.5)';

  return (
    <View style={styles.container}>
      {/* Engine Type */}
      <View style={styles.row}>
        <Text style={styles.label}>ENGINE</Text>
        <Text style={[styles.value, styles.engineValue]} numberOfLines={1}>
          {engineLabel.toUpperCase()}
        </Text>
      </View>

      {/* L / R Channel */}
      <View style={styles.row}>
        <Text style={styles.label}>L CHAN</Text>
        <Text style={styles.value}>{lChan.toFixed(1)}</Text>
        <Text style={styles.unit}>Hz</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>R CHAN</Text>
        <Text style={styles.value}>{rChan.toFixed(1)}</Text>
        <Text style={styles.unit}>Hz</Text>
      </View>

      {/* Target Delta */}
      <View style={styles.row}>
        <Text style={[styles.label, {color: deltaLabelColor}]}>TARGET Δ</Text>
        <Text style={[styles.value, {color: deltaColor}]}>{beatVal.toFixed(1)}</Text>
        <Text style={[styles.unit, {color: deltaLabelColor}]}>Hz</Text>
        {highVolumeWarning && (
          <Text style={styles.volWarnIcon}>⚠</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: MONO,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    width: 72,
  },
  value: {
    fontFamily: MONO,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'right',
    width: 80,
  },
  engineValue: {
    fontSize: 13,
    letterSpacing: 1,
  },
  unit: {
    fontFamily: MONO,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  volWarnIcon: {
    fontSize: 12,
    color: AMBER,
    marginLeft: 4,
  },
});
