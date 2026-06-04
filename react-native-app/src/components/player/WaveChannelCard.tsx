import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {GlassCard} from './GlassCard';
import {NeonSlider} from './NeonSlider';
import {HertzTheme} from '../../theme/hertzTheme';

type Side = 'left' | 'right';

const STEP = 0.5;

type WaveChannelCardProps = {
  side: Side;
};

export function WaveChannelCard({side}: WaveChannelCardProps) {
  const setParam = useHertzStore(s => s.setParam);
  const gain = useHertzStore(s => s.gain);
  const carrier = useHertzStore(s => s.carrierHz);
  const beat = useHertzStore(s => s.beatHz);

  const channelHz = side === 'left' ? carrier - beat / 2 : carrier + beat / 2;
  const title = side === 'left' ? 'Left Wave' : 'Right Wave';
  const accent = side === 'left' ? HertzTheme.neon.cyan : HertzTheme.neon.magenta;

  const nudge = useCallback(
    (delta: number) => {
      const next = Math.min(1500, Math.max(20, carrier + delta));
      setParam('carrierHz', next);
    },
    [carrier, setParam],
  );

  const onSlider = useCallback(
    (v: number) => {
      const target = 20 + v * 1480;
      const nextCarrier = side === 'left' ? target + beat / 2 : target - beat / 2;
      setParam('carrierHz', Math.min(1500, Math.max(20, nextCarrier)));
    },
    [beat, side, setParam],
  );

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.edit}>✎</Text>
      </View>
      <View style={styles.valueRow}>
        <Pressable style={styles.step} onPress={() => nudge(-STEP)} accessibilityLabel={`Decrease ${title}`}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={[styles.hz, {color: accent}]}>{channelHz.toFixed(2)}Hz</Text>
        <Pressable style={styles.step} onPress={() => nudge(STEP)} accessibilityLabel={`Increase ${title}`}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <NeonSlider
        value={Math.min(1, Math.max(0, (channelHz - 20) / 1480))}
        onChange={onSlider}
        accent={accent}
      />
      <View style={styles.gainRow}>
        <Text style={styles.gainLabel}>Gain</Text>
        <View style={styles.gainTrack}>
          {Array.from({length: 12}).map((_, i) => (
            <View
              key={i}
              style={[styles.gainDot, Math.round(gain * 12) > i && styles.gainDotOn]}
            />
          ))}
          <View style={[styles.gainThumb, {left: `${Math.round(gain * 100)}%`}]} />
        </View>
        <Text style={styles.gainVal}>{Math.round(gain * 100)}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: HertzTheme.text.secondary,
  },
  edit: {
    color: HertzTheme.text.muted,
    fontSize: 14,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 22,
    color: HertzTheme.text.primary,
    fontWeight: '300',
  },
  hz: {
    fontFamily: HertzTheme.mono,
    fontSize: 28,
    fontWeight: '600',
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  gainLabel: {
    fontSize: 12,
    color: HertzTheme.text.muted,
    width: 36,
  },
  gainTrack: {
    flex: 1,
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  gainDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gainDotOn: {
    backgroundColor: HertzTheme.neon.amber,
  },
  gainThumb: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    backgroundColor: HertzTheme.neon.amber,
    borderRadius: 2,
    top: -1,
  },
  gainVal: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    color: HertzTheme.neon.amber,
    width: 24,
    textAlign: 'right',
  },
});
