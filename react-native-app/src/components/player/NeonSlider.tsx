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
  /** Beat slider: pan math on UI thread, no runOnJS during drag. */
  beatHzOut?: SharedValue<number>;
  beatSliderMinHz?: SharedValue<number>;
  beatSliderMaxHz?: SharedValue<number>;
  /** 0 = linear, 1 = exponential (log). */
  beatSliderScale?: SharedValue<number>;
  onDragBegin?: () => void;
  onDragEnd?: () => void;
  accent?: string;
  /** Live accent colour (UI thread) — follows the value during a drag. */
  accentValue?: SharedValue<string>;
  /** Tapping the track without dragging resets to this beat Hz (beat slider). */
  resetBeatHz?: number;
  /** Called on a tap-to-reset so the store commits the default value. */
  onReset?: () => void;
};

export function NeonSlider({
  value,
  onChange,
  onChangeComplete,
  beatHzOut,
  beatSliderMinHz,
  beatSliderMaxHz,
  beatSliderScale,
  onDragBegin,
  onDragEnd,
  accent = HertzTheme.neon.cyan,
  accentValue,
  resetBeatHz,
  onReset,
}: NeonSliderProps) {
  const trackW = useSharedValue(200);
  const thumbX = useSharedValue(value * 200);
  const dragging = useSharedValue(0);
  const isBeatSlider =
    beatHzOut != null &&
    beatSliderMinHz != null &&
    beatSliderMaxHz != null &&
    beatSliderScale != null;

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
  const reset = useCallback(() => onReset?.(), [onReset]);

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
        beatHzOut!.value = beatHzFromSliderNormWorklet(
          norm,
          beatSliderMinHz!.value,
          beatSliderMaxHz!.value,
          beatSliderScale!.value,
        );
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
        beatHzOut!.value = beatHzFromSliderNormWorklet(
          norm,
          beatSliderMinHz!.value,
          beatSliderMaxHz!.value,
          beatSliderScale!.value,
        );
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

  // Tap (no drag) resets to the default instead of jumping to the tapped point.
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    if (isBeatSlider && resetBeatHz != null) {
      beatHzOut!.value = resetBeatHz;
    }
    if (onReset) {
      runOnJS(reset)();
    } else {
      runOnJS(commitComplete)(0);
    }
  });

  const thumbStyle = useAnimatedStyle(() => {
    const c = accentValue ? accentValue.value : accent;
    return {
      transform: [{translateX: thumbX.value - 10}],
      borderColor: c,
      backgroundColor: c,
    };
  });

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value,
    backgroundColor: accentValue ? accentValue.value : accent,
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
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.View style={[styles.thumb, thumbStyle]} />
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
