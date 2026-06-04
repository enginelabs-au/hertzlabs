import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {getBand} from '../ReadoutPanel/brainwaveBands';
import {GlassCard} from './GlassCard';
import {HertzTheme} from '../../theme/hertzTheme';

export function PlayerSettingsCard() {
  const beatHz = useHertzStore(s => s.beatHz);
  const isKinetic = useHertzStore(s => s.isKineticModeEnabled);
  const updateSettings = useHertzStore(s => s.updateSettings);
  const band = getBand(beatHz);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Sleep Timer</Text>
        <Text style={styles.timer}>Off</Text>
        <Pressable
          style={[styles.toggle, isKinetic && styles.toggleOn]}
          onPress={() => updateSettings({isKineticModeEnabled: !isKinetic})}
          accessibilityRole="switch"
          accessibilityState={{checked: isKinetic}}>
          <View style={[styles.thumb, isKinetic && styles.thumbOn]} />
        </Pressable>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Effect</Text>
        <Text style={styles.effect}>
          {band.label} ({band.rangeLabel})
        </Text>
      </View>
      <Pressable style={styles.presetsBtn}>
        <Text style={styles.presetsText}>Presets</Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    fontSize: 14,
    color: HertzTheme.text.secondary,
    flex: 1,
  },
  timer: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    color: HertzTheme.text.muted,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: 'rgba(167,139,250,0.5)',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  thumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: HertzTheme.neon.purple,
  },
  divider: {
    height: 1,
    backgroundColor: HertzTheme.glassBorder,
    marginVertical: 12,
  },
  effect: {
    fontSize: 13,
    color: HertzTheme.text.primary,
    fontWeight: '500',
  },
  presetsBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  presetsText: {
    fontSize: 14,
    fontWeight: '600',
    color: HertzTheme.text.primary,
  },
});
