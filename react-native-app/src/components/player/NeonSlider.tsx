import React, {useCallback, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, runOnUI, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import {HertzTheme} from '../../theme/hertzTheme';

type NeonSliderProps = {
  value: number;
  onChange: (v: number) => void;
  accent?: string;
};

export function NeonSlider({value, onChange, accent = HertzTheme.neon.cyan}: NeonSliderProps) {
  const trackW = useSharedValue(200);
  const thumbX = useSharedValue(value * 200);

  const commit = useCallback((v: number) => onChange(Math.min(1, Math.max(0, v))), [onChange]);

  useEffect(() => {
    runOnUI(() => {
      'worklet';
      if (trackW.value > 0) {
        thumbX.value = value * trackW.value;
      }
    })();
  }, [value, thumbX, trackW]);

  const pan = Gesture.Pan()
    .onUpdate(e => {
      'worklet';
      const x = Math.min(trackW.value, Math.max(0, e.x));
      thumbX.value = x;
      runOnJS(commit)(x / trackW.value);
    })
    .onEnd(e => {
      'worklet';
      const x = Math.min(trackW.value, Math.max(0, e.x));
      runOnJS(commit)(x / trackW.value);
    });

  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    const x = Math.min(trackW.value, Math.max(0, e.x));
    thumbX.value = x;
    runOnJS(commit)(x / trackW.value);
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
              thumbX.value = value * w;
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
