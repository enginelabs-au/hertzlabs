import React, {useCallback, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import {HertzTheme} from '../../theme/hertzTheme';

type KnobSize = 'compact' | 'default' | 'large';

const KNOB_DIMS: Record<KnobSize, {wrap: number; ring: number; border: number; valueSize: number}> = {
  compact: {wrap: 56, ring: 44, border: 2, valueSize: 8},
  default: {wrap: 68, ring: 56, border: 2, valueSize: 9},
  large: {wrap: 84, ring: 72, border: 2, valueSize: 11},
};

type RadialKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: string;
  format?: (v: number) => string;
  size?: KnobSize;
};

export function RadialKnob({label, value, min, max, onChange, color, format, size = 'default'}: RadialKnobProps) {
  const dims = KNOB_DIMS[size];
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
      <View style={[styles.wrap, {width: dims.wrap}]}>
        <View
          style={[
            styles.ring,
            {
              borderColor: color,
              width: dims.ring,
              height: dims.ring,
              borderRadius: dims.ring / 2,
              borderWidth: dims.border,
            },
          ]}>
          <View
            style={[
              styles.arc,
              {
                borderColor: color,
                width: dims.ring,
                height: dims.ring,
                borderRadius: dims.ring / 2,
                transform: [{rotate: `${pct * 270 - 135}deg`}],
              },
            ]}
          />
          <Text style={[styles.value, {fontSize: dims.valueSize}]}>{display}</Text>
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
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  arc: {
    position: 'absolute',
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  value: {
    fontFamily: HertzTheme.mono,
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
