import React, {useCallback, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, runOnUI, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {beatHzFromSliderNormWorklet} from '../../audio/beatHzSliderWorklet';
import {HertzTheme} from '../../theme/hertzTheme';

type NeonSliderProps = {
  value: number;
  onChange?: (v: number) => void;
  onChangeComplete?: (v: number) => void;
  /** Log-scale beat slider: all pan math on UI thread, no runOnJS during drag. */
  beatHzOut?: SharedValue<number>;
  beatLogMin?: SharedValue<number>;
  beatLogSpan?: SharedValue<number>;
  onDragBegin?: () => void;
  onDragEnd?: () => void;
  accent?: string;
};

export function NeonSlider({
  value,
  onChange,
  onChangeComplete,
  beatHzOut,
  beatLogMin,
  beatLogSpan,
  onDragBegin,
  onDragEnd,
  accent = HertzTheme.neon.cyan,
}: NeonSliderProps) {
  const trackW = useSharedValue(200);
  const thumbX = useSharedValue(value * 200);
  const dragging = useSharedValue(0);
  const isBeatSlider = beatHzOut != null && beatLogMin != null && beatLogSpan != null;

  const commit = useCallback((v: number) => onChange?.(Math.min(1, Math.max(0, v))), [onChange]);

  const commitComplete = useCallback(
    (v: number) => {
      const n = Math.min(1, Math.max(0, v));
      onChange?.(n);
      onChangeComplete?.(n);
    },
    [onChange, onChangeComplete],
  );

  const beginDrag = useCallback(() => onDragBegin?.(), [onDragBegin]);
  const endDrag = useCallback(() => onDragEnd?.(), [onDragEnd]);

  useEffect(() => {
    runOnUI(() => {
      'worklet';
      if (dragging.value === 0 && trackW.value > 0) {
        thumbX.value = value * trackW.value;
      }
    })();
  }, [value, thumbX, trackW, dragging]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      dragging.value = 1;
      if (onDragBegin) {
        runOnJS(beginDrag)();
      }
    })
    .onUpdate(e => {
      'worklet';
      const x = Math.min(trackW.value, Math.max(0, e.x));
      thumbX.value = x;
      const norm = x / trackW.value;
      if (isBeatSlider) {
        beatHzOut!.value = beatHzFromSliderNormWorklet(norm, beatLogMin!.value, beatLogSpan!.value);
      } else if (onChange) {
        runOnJS(commit)(norm);
      }
    })
    .onEnd(e => {
      'worklet';
      const x = Math.min(trackW.value, Math.max(0, e.x));
      dragging.value = 0;
      const norm = x / trackW.value;
      if (isBeatSlider) {
        beatHzOut!.value = beatHzFromSliderNormWorklet(norm, beatLogMin!.value, beatLogSpan!.value);
      }
      if (onDragEnd) {
        runOnJS(endDrag)();
      }
      runOnJS(commitComplete)(norm);
    })
    .onFinalize(() => {
      'worklet';
      dragging.value = 0;
      if (onDragEnd) {
        runOnJS(endDrag)();
      }
    });

  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    const x = Math.min(trackW.value, Math.max(0, e.x));
    thumbX.value = x;
    const norm = x / trackW.value;
    if (isBeatSlider) {
      beatHzOut!.value = beatHzFromSliderNormWorklet(norm, beatLogMin!.value, beatLogSpan!.value);
    }
    runOnJS(commitComplete)(norm);
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{translateX: thumbX.value - 10}],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value,
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View
        style={styles.trackHit}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            runOnUI(() => {
              'worklet';
              trackW.value = w;
              if (dragging.value === 0) {
                thumbX.value = value * w;
              }
            })();
          }
        }}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, {backgroundColor: accent}, fillStyle]} />
        </View>
        <Animated.View style={[styles.thumb, {borderColor: accent, backgroundColor: accent}, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  trackHit: {
    height: 32,
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
