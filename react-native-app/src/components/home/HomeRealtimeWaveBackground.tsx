import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {useMathVisualClock} from '../../hooks/useMathVisualClock';
import {useHertzStore} from '../../state/store';
import {RadiantWaveStrip} from '../waveforms/RadiantWaveStrip';
import {HomeOscilloscopeBackdrop} from './HomeOscilloscopeBackdrop';

/** Onboarding-style layered waves driven by live beat Hz + realtime scope traces. */
export function HomeRealtimeWaveBackground() {
  const {width, height} = useWindowDimensions();
  const beatHz = useHertzStore(s => s.beatHz);
  const carrierHz = useHertzStore(s => s.carrierHz);
  const gain = useHertzStore(s => s.gain);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const balance = useHertzStore(s => s.balance);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));
  const timeSec = useMathVisualClock(20);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <HomeOscilloscopeBackdrop
        width={width}
        height={height}
        carrierHz={carrierHz}
        beatHz={beatHz}
        phaseAngle={phaseAngle}
        gain={gain}
        balance={balance}
        leftDriftHz={leftDriftHz}
        rightDriftHz={rightDriftHz}
      />
      <View style={[styles.layer, {top: height * 0.14, opacity: 0.14}]}>
        <RadiantWaveStrip height={height * 0.32} beatHz={beatHz} canvasWidth={width} timeSec={timeSec} />
      </View>
      <View style={[styles.layer, {top: height * 0.36, opacity: 0.1}]}>
        <RadiantWaveStrip
          height={height * 0.28}
          beatHz={beatHz * 0.85}
          canvasWidth={width}
          timeSec={timeSec * 1.08}
          variant="hero"
        />
      </View>
      <View style={[styles.layer, {top: height * 0.58, opacity: 0.08}]}>
        <RadiantWaveStrip
          height={height * 0.24}
          beatHz={beatHz * 1.15}
          canvasWidth={width}
          timeSec={timeSec * 0.92}
        />
      </View>
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,10,18,0.38)',
  },
});
