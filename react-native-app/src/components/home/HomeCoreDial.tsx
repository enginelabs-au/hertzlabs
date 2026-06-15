import React, {useCallback, useMemo, useRef} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Canvas, Path, Skia} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import {formatBeatDisplay, getBand} from '../ReadoutPanel/brainwaveBands';
import {AIGuideChatSection} from '../ai/AIGuideChatSection';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Clockwise from top — matches reference dial. */
const SIMPLE_BANDS = [
  {name: 'GAMMA', hz: 40},
  {name: 'DELTA', hz: 2},
  {name: 'THETA', hz: 6},
  {name: 'ALPHA', hz: 10},
  {name: 'BETA', hz: 22},
] as const;

const DIAL_SIZE = 330;

function gainLabel(gain: number): string {
  const pct = Math.round(gain * 100);
  const sign = pct >= 0 ? '+' : '';
  return `GAIN: ${sign}${pct}%`;
}

function hemisphericSyncLabel(isPlaying: boolean): string {
  return `HEMISPHERIC SYNC: ${isPlaying ? 'HIGH' : 'LOW'}`;
}

type HomeCoreDialProps = {
  size?: number;
};

/** Reference-style core dial: band ring, arc highlight, central AI input, readouts. */
export function HomeCoreDial({size = DIAL_SIZE}: HomeCoreDialProps) {
  const ringR = size / 2 - 18;
  const inputRef = useRef<TextInput>(null);
  const beatHz = useHertzStore(s => s.beatHz);
  const gain = useHertzStore(s => s.gain);
  const isPlaying = useHertzStore(s => s.isPlaying);
  const setParam = useHertzStore(s => s.setParam);
  const rotation = useSharedValue(0);
  const band = getBand(beatHz);

  const activeBand = SIMPLE_BANDS.reduce((best, b) =>
    Math.abs(b.hz - beatHz) < Math.abs(best.hz - beatHz) ? b : best,
  );
  const activeIdx = SIMPLE_BANDS.findIndex(b => b.name === activeBand.name);

  const applyBandHz = useCallback(
    (hz: number) => {
      setParam('beatHz', hz);
    },
    [setParam],
  );

  const pan = Gesture.Pan()
    .onChange(e => {
      rotation.value += e.changeX * 0.011;
      const norm = ((rotation.value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const idx = Math.floor((norm / (Math.PI * 2)) * SIMPLE_BANDS.length) % SIMPLE_BANDS.length;
      runOnJS(applyBandHz)(SIMPLE_BANDS[idx].hz);
    })
    .onEnd(() => {
      rotation.value = rotation.value % (Math.PI * 2);
    });

  const dialRotate = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}rad`}],
  }));

  const arcPath = useMemo(() => {
    const sweep = 360 / SIMPLE_BANDS.length;
    const start = -90 + activeIdx * sweep - sweep * 0.08;
    const p = Skia.Path.Make();
    p.addArc(
      {
        x: size / 2 - ringR,
        y: size / 2 - ringR,
        width: ringR * 2,
        height: ringR * 2,
      },
      start,
      sweep * 0.84,
    );
    return p;
  }, [activeIdx, size, ringR]);

  const innerR = ringR - 8;
  const outerRing = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(size / 2, size / 2, innerR);
    return p;
  }, [size]);

  return (
    <View style={[styles.wrap, {width: size, height: size + 88}]}>
      <Canvas style={{width: size, height: size}} pointerEvents="none">
        <Path path={outerRing} style="stroke" strokeWidth={1.5} color="rgba(92,225,255,0.18)" />
        <Path path={arcPath} style="stroke" strokeWidth={5} color="rgba(92,225,255,0.75)" strokeCap="round" />
      </Canvas>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.labelRing, {width: size, height: size}, dialRotate]}>
          {SIMPLE_BANDS.map((b, i) => {
            const angle = (i / SIMPLE_BANDS.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * (ringR - 4);
            const y = Math.sin(angle) * (ringR - 4);
            const active = b.name === activeBand.name;
            return (
              <Pressable
                key={b.name}
                style={[
                  styles.bandHit,
                  {
                    left: size / 2 + x - 28,
                    top: size / 2 + y - 9,
                  },
                ]}
                onPress={() => applyBandHz(b.hz)}>
                <Text
                  style={[
                    styles.bandLabel,
                    active && styles.bandLabelActive,
                    active && {color: band.hexColor},
                  ]}>
                  {b.name}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </GestureDetector>

      <View style={[styles.coreStack, {top: size / 2 - 58, width: size}]}>
        <Pressable
          style={styles.coreBox}
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="none">
          <AIGuideChatSection layoutMode="homeInline" inputRef={inputRef} />
        </Pressable>

        <Text style={[styles.hzReadout, {color: band.hexColor}]}>{formatBeatDisplay(beatHz)} Hz</Text>
        <Text style={styles.gainReadout}>{gainLabel(gain)}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLeft}>TARGET BAND: {band.scientific.toUpperCase()}</Text>
          <Text style={styles.metaRight}>{hemisphericSyncLabel(isPlaying)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  labelRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bandHit: {
    position: 'absolute',
    width: 56,
    alignItems: 'center',
  },
  bandLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.42)',
  },
  bandLabelActive: {
    color: HertzTheme.neon.cyan,
    textShadowColor: HertzTheme.neon.cyan,
    textShadowRadius: 8,
  },
  coreStack: {
    position: 'absolute',
    alignItems: 'center',
  },
  coreBox: {
    width: 168,
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: 'rgba(6,8,14,0.96)',
    borderWidth: 2,
    borderColor: 'rgba(92,225,255,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: HertzTheme.neon.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 0},
  },
  hzReadout: {
    fontFamily: HertzTheme.mono,
    fontSize: 34,
    fontWeight: '700',
    marginTop: 14,
    letterSpacing: -0.5,
  },
  gainReadout: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '600',
    color: HertzTheme.neon.cyan,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '92%',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  metaLeft: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    flex: 1,
  },
  metaRight: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    textAlign: 'right',
    flex: 1,
  },
});
