import React, {useCallback, useRef, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {formatBeatDisplay, formatBeatUnit} from '../ReadoutPanel/brainwaveBands';
import {HertzTheme} from '../../theme/hertzTheme';

type ExperimentalDialProps = {
  /** Caption above the knob. */
  label: string;
  /** Caption under the text field (e.g. the sweep range). */
  caption: string;
  color: string;
  /** Live value Hz (UI thread) — drives the waveform, readouts and audio bridge. */
  valueLive: SharedValue<number>;
  /** Committed value Hz from the store (keeps the idle dial/text in sync). */
  committedValue: number;
  /** Logarithmic sweep range for the knob. */
  dialMin: number;
  dialMax: number;
  /** Absolute clamp for typed values (the text field can exceed the knob sweep). */
  absMin: number;
  absMax: number;
  /** Tap-to-reset target. */
  defaultValue: number;
  /** Commit the value to the store (e.g. setParam('carrierHz', hz)). */
  onCommit: (hz: number) => void;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function logNorm(hz: number, min: number, max: number): number {
  const c = clamp(hz, min, max);
  return (Math.log(c) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

function logHz(norm: number, min: number, max: number): number {
  const n = clamp(norm, 0, 1);
  return Math.exp(Math.log(min) + n * (Math.log(max) - Math.log(min)));
}

/** Compact value for the experimental dial (unit shown separately when ≥1 kHz). */
export function formatExperimentalHz(hz: number): string {
  return formatBeatDisplay(hz);
}

export function formatExperimentalUnit(hz: number): string {
  return formatBeatUnit(hz);
}

/**
 * Experimental-mode PITCH dial that flanks the main beat slider. Dragging sweeps
 * the carrier (produced tone) logarithmically across the audible range — 20 Hz on
 * the Ω− side up to 20 kHz on the Ω+ side; the text field accepts any value within
 * the absolute clamp. A tap (no drag) resets the pitch to its default.
 *
 * Perf: a drag writes only the live shared value (waveform / readouts / audio
 * follow with no hub re-render) plus this component's own display state, then
 * commits to the store once on release — matching the main slider's model.
 */
export function ExperimentalDial({
  label,
  caption,
  color,
  valueLive,
  committedValue,
  dialMin,
  dialMax,
  absMin,
  absMax,
  defaultValue,
  onCommit,
}: ExperimentalDialProps) {
  const [liveDisplay, setLiveDisplay] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const startNorm = useRef(0);

  const displayHz = liveDisplay ?? clamp(committedValue, dialMin, dialMax);
  const pct = logNorm(displayHz, dialMin, dialMax);

  const captureStart = useCallback(() => {
    startNorm.current = logNorm(committedValue, dialMin, dialMax);
  }, [committedValue, dialMin, dialMax]);

  const applyDrag = useCallback(
    (translationY: number) => {
      const norm = clamp(startNorm.current - translationY / 160, 0, 1);
      const hz = logHz(norm, dialMin, dialMax);
      valueLive.value = hz;
      setLiveDisplay(hz);
    },
    [valueLive, dialMin, dialMax],
  );

  const commitDrag = useCallback(() => {
    setLiveDisplay(prev => {
      if (prev != null) {
        onCommit(clamp(prev, absMin, absMax));
      }
      return null;
    });
  }, [absMin, absMax, onCommit]);

  const resetToDefault = useCallback(() => {
    valueLive.value = defaultValue;
    setLiveDisplay(null);
    onCommit(defaultValue);
  }, [valueLive, defaultValue, onCommit]);

  const submitText = useCallback(() => {
    setEditing(false);
    const parsed = Number.parseFloat(text);
    if (Number.isFinite(parsed) && parsed > 0) {
      const hz = clamp(parsed, absMin, absMax);
      valueLive.value = hz;
      onCommit(hz);
    }
  }, [text, absMin, absMax, valueLive, onCommit]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(captureStart)();
    })
    .onUpdate(e => {
      runOnJS(applyDrag)(e.translationY);
    })
    .onEnd(() => {
      runOnJS(commitDrag)();
    })
    .onFinalize(() => {
      runOnJS(commitDrag)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(resetToDefault)();
  });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, {color}]} numberOfLines={1}>
        {label}
      </Text>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={[styles.ring, {borderColor: color}]}>
          <View
            style={[
              styles.arc,
              {borderColor: color, transform: [{rotate: `${pct * 270 - 135}deg`}]},
            ]}
          />
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {formatExperimentalHz(displayHz)}
          </Text>
        </View>
      </GestureDetector>
      <TextInput
        style={[styles.input, {borderColor: `${color}66`}]}
        value={editing ? text : formatExperimentalHz(displayHz)}
        onFocus={() => {
          setEditing(true);
          setText(formatExperimentalHz(displayHz));
        }}
        onChangeText={setText}
        onEndEditing={submitText}
        onSubmitEditing={submitText}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={`${label} frequency, Hz`}
        placeholder="Hz"
        placeholderTextColor={HertzTheme.text.muted}
      />
      <Text style={styles.caption} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

const RING = 40;

const styles = StyleSheet.create({
  wrap: {
    width: 54,
    alignItems: 'center',
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  arc: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  value: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.text.primary,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  input: {
    marginTop: 3,
    width: 52,
    height: 18,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 0,
    paddingHorizontal: 3,
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.text.primary,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  caption: {
    marginTop: 2,
    fontFamily: HertzTheme.mono,
    fontSize: 6,
    color: HertzTheme.text.muted,
    textAlign: 'center',
  },
});
