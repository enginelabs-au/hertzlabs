import React, {useCallback, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import {HertzTheme} from '../../theme/hertzTheme';

type RadialKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: string;
  format?: (v: number) => string;
};

export function RadialKnob({label, value, min, max, onChange, color, format}: RadialKnobProps) {
  const display = format ? format(value) : value.toFixed(1);
  const pct = (value - min) / (max - min);
  const startRef = useRef(value);

  const applyDrag = useCallback(
    (translationY: number) => {
      const delta = -translationY * ((max - min) / 120);
      const next = Math.min(max, Math.max(min, startRef.current + delta));
      onChange(next);
    },
    [max, min, onChange],
  );

  const captureStart = useCallback(() => {
    startRef.current = value;
  }, [value]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(captureStart)();
    })
    .onUpdate(e => {
      runOnJS(applyDrag)(e.translationY);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap}>
        <View style={[styles.ring, {borderColor: color}]}>
          <View
            style={[
              styles.arc,
              {
                borderColor: color,
                transform: [{rotate: `${pct * 270 - 135}deg`}],
              },
            ]}
          />
          <Text style={styles.value}>{display}</Text>
        </View>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: 68,
  },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  arc: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  value: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.primary,
    textAlign: 'center',
  },
  label: {
    marginTop: 6,
    fontSize: 8,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 10,
  },
});
