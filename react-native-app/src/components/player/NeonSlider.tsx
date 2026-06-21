import React, {useCallback, useEffect, useRef} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, runOnUI, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {
  beatHzFromSliderNormWorklet,
} from '../../audio/beatHzSliderWorklet';
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
  /** Normalized [0,1] position where the free-tier lock begins (thumb cannot pass). */
  lockedNormStart?: number;
  /** Tap on the grey locked zone opens the paywall. */
  onLockedZonePress?: () => void;
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
  lockedNormStart,
  onLockedZonePress,
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
  const capNorm = useSharedValue(lockedNormStart ?? 1);
  const isBeatSlider =
    beatHzOut != null &&
    beatSliderMinHz != null &&
    beatSliderMaxHz != null &&
    beatSliderScale != null;
  const hasLockedZone = lockedNormStart != null && lockedNormStart < 1 && onLockedZonePress != null;

  useEffect(() => {
    capNorm.value = lockedNormStart ?? 1;
  }, [lockedNormStart, capNorm]);

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
  const openPaywall = useCallback(() => onLockedZonePress?.(), [onLockedZonePress]);

  const lastBeatChangeMs = useRef(0);
  const commitBeatChange = useCallback(
    (norm: number) => {
      if (onChange == null) {
        return;
      }
      const now = Date.now();
      if (now - lastBeatChangeMs.current < 50) {
        return;
      }
      lastBeatChangeMs.current = now;
      onChange(Math.min(1, Math.max(0, norm)));
    },
    [onChange],
  );

  useEffect(() => {
    runOnUI(() => {
      'worklet';
      if (trackW.value > 0) {
        // External commits (band chips, store) must win over a stuck Mac mouse drag.
        dragging.value = 0;
        thumbX.value = value * trackW.value;
        if (isBeatSlider) {
          beatHzOut!.value = beatHzFromSliderNormWorklet(
            value,
            beatSliderMinHz!.value,
            beatSliderMaxHz!.value,
            beatSliderScale!.value,
          );
        }
      }
    })();
  }, [value, thumbX, trackW, dragging, isBeatSlider, beatHzOut, beatSliderMinHz, beatSliderMaxHz, beatSliderScale]);

  const clampX = (x: number) => {
    'worklet';
    const w = trackW.value;
    let clamped = Math.min(w, Math.max(0, x));
    if (capNorm.value < 1) {
      const capX = capNorm.value * w;
      if (clamped > capX) {
        clamped = capX;
      }
    }
    return clamped;
  };

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
      const x = clampX(e.x);
      thumbX.value = x;
      const norm = x / trackW.value;
      if (isBeatSlider) {
        beatHzOut!.value = beatHzFromSliderNormWorklet(
          norm,
          beatSliderMinHz!.value,
          beatSliderMaxHz!.value,
          beatSliderScale!.value,
        );
        if (onChange) {
          runOnJS(commitBeatChange)(norm);
        }
      } else if (onChange) {
        runOnJS(commit)(norm);
      }
    })
    .onEnd(e => {
      'worklet';
      const x = clampX(e.x);
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

  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    if (capNorm.value < 1 && e.x > capNorm.value * trackW.value) {
      runOnJS(openPaywall)();
      return;
    }
    if (isBeatSlider && resetBeatHz != null) {
      beatHzOut!.value = resetBeatHz;
    }
    if (onReset) {
      runOnJS(reset)();
    }
    // Note: when neither isBeatSlider+resetBeatHz nor onReset is set, tapping the
    // track used to call commitComplete(0) which would accidentally zero beatHz.
    // Now we do nothing — the slider only changes value via a drag or an explicit reset.
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

  const lockedOverlayStyle = useAnimatedStyle(() => ({
    left: capNorm.value * trackW.value,
    width: Math.max(0, trackW.value - capNorm.value * trackW.value),
  }));

  const lockBadgeStyle = useAnimatedStyle(() => ({
    left: capNorm.value * trackW.value - 11,
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
                if (isBeatSlider) {
                  beatHzOut!.value = beatHzFromSliderNormWorklet(
                    value,
                    beatSliderMinHz!.value,
                    beatSliderMaxHz!.value,
                    beatSliderScale!.value,
                  );
                }
              }
            })();
          }
        }}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
          {hasLockedZone && <Animated.View style={[styles.lockedOverlay, lockedOverlayStyle]} pointerEvents="none" />}
        </View>
        {hasLockedZone && (
          <Animated.View style={[styles.lockBadge, lockBadgeStyle]}>
            <Pressable
              onPress={openPaywall}
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Unlock premium frequencies"
              hitSlop={8}
            />
            <Text style={styles.lockIcon}>🔒</Text>
          </Animated.View>
        )}
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
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.22)',
  },
  lockBadge: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 11,
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
