import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {BeatSliderScale} from '../../audio/beatHzSlider';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

const OPTIONS: {id: BeatSliderScale; label: string}[] = [
  {id: 'linear', label: 'LINEAR'},
  {id: 'exponential', label: 'EXPONENTIAL'},
];

/** Compact LINEAR / EXPONENTIAL toggle for the in-frame beat frequency slider. */
export function BeatSliderScaleToggle() {
  const scale = useHertzStore(s => s.beatSliderScale);
  const updateSettings = useHertzStore(s => s.updateSettings);

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {OPTIONS.map(opt => {
        const active = scale === opt.id;
        return (
          <Pressable
            key={opt.id}
            style={[styles.seg, active && styles.segActive]}
            onPress={() => updateSettings({beatSliderScale: opt.id})}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            accessibilityLabel={`${opt.label} beat slider scaling`}>
            <Text style={[styles.segText, active && styles.segTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  seg: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  segActive: {
    backgroundColor: 'rgba(167,139,250,0.28)',
  },
  segText: {
    fontFamily: HertzTheme.mono,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: HertzTheme.text.muted,
  },
  segTextActive: {
    color: HertzTheme.neon.cyan,
  },
});
