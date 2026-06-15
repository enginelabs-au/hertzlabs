import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import {formatBeatDisplay, getBand} from '../ReadoutPanel/brainwaveBands';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

const SIMPLE_BANDS = [
  {name: 'DELTA', hz: 2},
  {name: 'THETA', hz: 6},
  {name: 'ALPHA', hz: 10},
  {name: 'BETA', hz: 22},
  {name: 'GAMMA', hz: 40},
] as const;

const RING_SIZE = 300;
const RING_STROKE = 1;

type HomeBandRingProps = {
  size?: number;
};

/** Concentric band scroller — sits mid-layer around the AI chat hole. */
export function HomeBandRing({size = RING_SIZE}: HomeBandRingProps) {
  const beatHz = useHertzStore(s => s.beatHz);
  const setParam = useHertzStore(s => s.setParam);
  const rotation = useSharedValue(0);
  const band = getBand(beatHz);

  const applyBandHz = useCallback(
    (hz: number) => {
      setParam('beatHz', hz);
    },
    [setParam],
  );

  const pan = Gesture.Pan()
    .onChange(e => {
      rotation.value += e.changeX * 0.012;
      const norm = ((rotation.value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const idx = Math.floor((norm / (Math.PI * 2)) * SIMPLE_BANDS.length) % SIMPLE_BANDS.length;
      runOnJS(applyBandHz)(SIMPLE_BANDS[idx].hz);
    })
    .onEnd(() => {
      rotation.value = rotation.value % (Math.PI * 2);
    });

  const dialStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}rad`}],
  }));

  const activeBand = SIMPLE_BANDS.reduce((best, b) =>
    Math.abs(b.hz - beatHz) < Math.abs(best.hz - beatHz) ? b : best,
  );

  const radius = size / 2 - 24;

  return (
    <View style={[styles.wrap, {width: size, height: size}]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.ring, {width: size, height: size, borderRadius: size / 2}, dialStyle]}>
          {SIMPLE_BANDS.map((b, i) => {
            const angle = (i / SIMPLE_BANDS.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const active = b.name === activeBand.name;
            return (
              <Pressable
                key={b.name}
                style={[
                  styles.bandHit,
                  {
                    left: size / 2 + x - 24,
                    top: size / 2 + y - 10,
                  },
                ]}
                onPress={() => applyBandHz(b.hz)}
                hitSlop={6}>
                <Text
                  style={[
                    styles.bandLabel,
                    {color: active ? band.hexColor : 'rgba(255,255,255,0.45)'},
                  ]}>
                  {b.name}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </GestureDetector>

      <View style={styles.readout} pointerEvents="none">
        <Text style={[styles.hz, {color: band.hexColor}]}>{formatBeatDisplay(beatHz)}</Text>
        <Text style={styles.hzUnit}>Hz</Text>
        <Text style={styles.hint}>rotate to scrub bands</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: RING_STROKE,
    borderColor: 'rgba(92,225,255,0.22)',
    backgroundColor: 'transparent',
  },
  bandHit: {
    position: 'absolute',
    width: 48,
    alignItems: 'center',
  },
  bandLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  readout: {
    position: 'absolute',
    top: 28,
    alignItems: 'center',
    width: '100%',
  },
  hz: {
    fontFamily: HertzTheme.mono,
    fontSize: 28,
    fontWeight: '700',
  },
  hzUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: -2,
  },
  hint: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
