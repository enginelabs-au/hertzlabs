import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {RadiantWaveStrip} from '../waveforms/RadiantWaveStrip';

const STEP_BEAT_HZ = [6, 10, 14] as const;

type OnboardingBackgroundWavesProps = {
  step: number;
};

/** Soft ambient wave motion behind onboarding step cards. */
export function OnboardingBackgroundWaves({step}: OnboardingBackgroundWavesProps) {
  const {width, height} = useWindowDimensions();
  const beatHz = STEP_BEAT_HZ[Math.min(step, STEP_BEAT_HZ.length - 1)] ?? 10;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.layer, {top: height * 0.22, opacity: 0.12}]}>
        <RadiantWaveStrip height={height * 0.35} beatHz={beatHz * 0.7} canvasWidth={width} />
      </View>
      <View style={[styles.layer, {top: height * 0.38, opacity: 0.08}]}>
        <RadiantWaveStrip height={height * 0.28} beatHz={beatHz} canvasWidth={width} variant="hero" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
