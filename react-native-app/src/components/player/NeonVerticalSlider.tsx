import React, {useCallback, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, runOnUI, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import {PHASE_COLUMN_W} from '../../hooks/useHubLayout';
import {HertzTheme} from '../../theme/hertzTheme';

type NeonVerticalSliderProps = {
  /** 0–360 degrees */
  valueDeg: number;
  onChangeDeg: (deg: number) => void;
  accent?: string;
  /** Track height — must match hub canvas height when embedded. */
  height?: number;
  /** Sits inside hub card; track fills space between 360°/0° labels. */
  embedded?: boolean;
};

const THUMB = 20;
const TRACK_W = 4;
const HIT_W = THUMB;

function clampThumbCenter(y: number, h: number): number {
  'worklet';
  const half = THUMB / 2;
  return Math.min(h - half, Math.max(half, y));
}

function normFromThumbCenter(centerY: number, h: number): number {
  'worklet';
  const travel = h - THUMB;
  if (travel <= 0) {
    return 0;
  }
  return 1 - (centerY - THUMB / 2) / travel;
}

function thumbCenterFromDeg(deg: number, h: number): number {
  'worklet';
  const travel = h - THUMB;
  const norm = Math.min(1, Math.max(0, deg / 360));
  return THUMB / 2 + (1 - norm) * travel;
}

export function NeonVerticalSlider({
  valueDeg,
  onChangeDeg,
  accent = HertzTheme.neon.purple,
  height = 200,
  embedded = false,
}: NeonVerticalSliderProps) {
  const trackH = useSharedValue(height);
  const thumbY = useSharedValue(THUMB / 2);

  const commit = useCallback(
    (norm: number) => {
      const n = Math.min(1, Math.max(0, norm));
      onChangeDeg(n * 360);
    },
    [onChangeDeg],
  );

  const syncThumbFromDeg = useCallback(
    (deg: number) => {
      runOnUI(() => {
        'worklet';
        const h = trackH.value;
        if (h > THUMB) {
          thumbY.value = thumbCenterFromDeg(deg, h);
        }
      })();
    },
    [thumbY, trackH],
  );

  useEffect(() => {
    syncThumbFromDeg(valueDeg);
  }, [valueDeg, syncThumbFromDeg]);

  const pan = Gesture.Pan()
    .onUpdate(e => {
      'worklet';
      const h = trackH.value;
      const center = clampThumbCenter(e.y, h);
      thumbY.value = center;
      runOnJS(commit)(normFromThumbCenter(center, h));
    })
    .onEnd(e => {
      'worklet';
      const h = trackH.value;
      const center = clampThumbCenter(e.y, h);
      runOnJS(commit)(normFromThumbCenter(center, h));
    });

  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    const h = trackH.value;
    const center = clampThumbCenter(e.y, h);
    thumbY.value = center;
    runOnJS(commit)(normFromThumbCenter(center, h));
  });

  const thumbStyle = useAnimatedStyle(() => ({
    top: thumbY.value - THUMB / 2,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    height: Math.max(0, trackH.value - thumbY.value + THUMB / 2),
  }));

  const onTrackLayout = (h: number) => {
    if (h > THUMB) {
      runOnUI(() => {
        'worklet';
        trackH.value = h;
        thumbY.value = thumbCenterFromDeg(valueDeg, h);
      })();
    }
  };

  const trackBlock = (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View
        style={[styles.trackHit, embedded ? styles.trackHitEmbedded : {height}]}
        onLayout={e => onTrackLayout(e.nativeEvent.layout.height)}>
        <View style={styles.trackRail}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, {backgroundColor: accent}, fillStyle]} />
          </View>
          <Animated.View style={[styles.thumb, {borderColor: accent, backgroundColor: accent}, thumbStyle]} />
        </View>
      </View>
    </GestureDetector>
  );

  if (embedded) {
    return (
      <View style={[styles.embedCol, {height, width: PHASE_COLUMN_W}]}>
        <Text style={styles.embedLabel}>360°</Text>
        <View style={styles.embedTrackFlex}>{trackBlock}</View>
        <Text style={styles.embedLabel}>0°</Text>
        <Text style={[styles.embedValue, {color: accent}]}>{Math.round(valueDeg)}°</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, {height}]}>
      <Text style={styles.edgeTop}>360°</Text>
      {trackBlock}
      <Text style={styles.edgeBottom}>0°</Text>
      <Text style={[styles.value, {color: accent}]}>{Math.round(valueDeg)}°</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: HIT_W + 12,
    alignItems: 'center',
  },
  embedCol: {
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: HertzTheme.glassBorder,
    paddingHorizontal: 2,
  },
  embedLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.text.muted,
    lineHeight: 10,
    marginVertical: 2,
  },
  embedTrackFlex: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embedValue: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  edgeTop: {
    position: 'absolute',
    top: 0,
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.text.muted,
  },
  edgeBottom: {
    position: 'absolute',
    bottom: 18,
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.text.muted,
  },
  value: {
    position: 'absolute',
    bottom: 0,
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  trackHit: {
    width: HIT_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackHitEmbedded: {
    flex: 1,
    width: HIT_W,
  },
  trackRail: {
    width: THUMB,
    height: '100%',
  },
  track: {
    position: 'absolute',
    left: (THUMB - TRACK_W) / 2,
    width: TRACK_W,
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
