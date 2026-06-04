import React, {useCallback, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, runOnUI, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {SLIDER_COLUMN_W} from '../../hooks/useHubLayout';
import {HertzTheme} from '../../theme/hertzTheme';

type NeonVerticalSliderBase = {
  accent?: string;
  height?: number;
  embedded?: boolean;
};

export type NeonVerticalPhaseSliderProps = NeonVerticalSliderBase & {
  variant?: 'phase';
  valueDeg: number;
  onChangeDeg?: (deg: number) => void;
  onChangeDegComplete?: (deg: number) => void;
  onDragBegin?: () => void;
  onDragEnd?: () => void;
  /** @deprecated Use onLivePhaseDeg */
  linkedPhaseDeg?: SharedValue<number>;
};

export type NeonVerticalBeatSliderProps = NeonVerticalSliderBase & {
  variant: 'beat';
  valueNorm: number;
  onChangeNorm: (norm: number) => void;
  displayText: string;
  topLabel: string;
  bottomLabel: string;
};

export type NeonVerticalSliderProps = NeonVerticalPhaseSliderProps | NeonVerticalBeatSliderProps;

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

export function NeonVerticalSlider(props: NeonVerticalSliderProps) {
  const {
    accent = props.variant === 'beat' ? HertzTheme.neon.magenta : HertzTheme.neon.purple,
    height = 200,
    embedded = false,
  } = props;

  const isBeat = props.variant === 'beat';
  const valueNorm = isBeat
    ? props.valueNorm
    : Math.min(1, Math.max(0, props.valueDeg / 360));

  const trackH = useSharedValue(height);
  const thumbY = useSharedValue(THUMB / 2);

  const phaseProps = !isBeat ? (props as NeonVerticalPhaseSliderProps) : null;
  const linkedPhaseDeg = phaseProps?.linkedPhaseDeg;
  const onDragBegin = phaseProps?.onDragBegin;
  const onDragEnd = phaseProps?.onDragEnd;
  const onPhaseComplete = phaseProps?.onChangeDegComplete ?? phaseProps?.onChangeDeg;

  const commit = useCallback(
    (norm: number) => {
      const n = Math.min(1, Math.max(0, norm));
      if (isBeat) {
        (props as NeonVerticalBeatSliderProps).onChangeNorm(n);
      } else {
        phaseProps?.onChangeDeg?.(n * 360);
      }
    },
    [isBeat, props, phaseProps],
  );

  const commitComplete = useCallback(
    (norm: number) => {
      const n = Math.min(1, Math.max(0, norm));
      if (isBeat) {
        (props as NeonVerticalBeatSliderProps).onChangeNorm(n);
      } else {
        onPhaseComplete?.(n * 360);
      }
    },
    [isBeat, props, onPhaseComplete],
  );

  const syncThumbFromNorm = useCallback(
    (norm: number) => {
      runOnUI(() => {
        'worklet';
        const h = trackH.value;
        if (h > THUMB) {
          thumbY.value = thumbCenterFromDeg(norm * 360, h);
        }
      })();
    },
    [thumbY, trackH],
  );

  useEffect(() => {
    syncThumbFromNorm(valueNorm);
  }, [valueNorm, syncThumbFromNorm]);

  const beginDrag = useCallback(() => onDragBegin?.(), [onDragBegin]);
  const endDrag = useCallback(() => onDragEnd?.(), [onDragEnd]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      if (onDragBegin) {
        runOnJS(beginDrag)();
      }
    })
    .onUpdate(e => {
      'worklet';
      const h = trackH.value;
      const center = clampThumbCenter(e.y, h);
      thumbY.value = center;
      const norm = normFromThumbCenter(center, h);
      if (!isBeat && linkedPhaseDeg) {
        linkedPhaseDeg.value = norm * 360;
      } else if (isBeat) {
        runOnJS(commit)(norm);
      }
    })
    .onEnd(e => {
      'worklet';
      const h = trackH.value;
      const center = clampThumbCenter(e.y, h);
      const norm = normFromThumbCenter(center, h);
      if (!isBeat && linkedPhaseDeg) {
        linkedPhaseDeg.value = norm * 360;
      }
      if (onDragEnd) {
        runOnJS(endDrag)();
      }
      runOnJS(commitComplete)(norm);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(endDrag)();
    });

  const tap = Gesture.Tap().onEnd(e => {
    'worklet';
    const h = trackH.value;
    const center = clampThumbCenter(e.y, h);
    thumbY.value = center;
    const norm = normFromThumbCenter(center, h);
    if (!isBeat && linkedPhaseDeg) {
      linkedPhaseDeg.value = norm * 360;
    }
    runOnJS(commitComplete)(norm);
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
        thumbY.value = thumbCenterFromDeg(valueNorm * 360, h);
      })();
    }
  };

  const topLabel = isBeat ? props.topLabel : '360°';
  const bottomLabel = isBeat ? props.bottomLabel : '0°';
  const valueLabel = isBeat ? props.displayText : `${Math.round((props as NeonVerticalPhaseSliderProps).valueDeg)}°`;

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
      <View
        style={[
          styles.embedCol,
          {height, width: SLIDER_COLUMN_W},
          isBeat ? styles.embedColBeat : styles.embedColPhase,
        ]}>
        <Text style={styles.embedLabel}>{topLabel}</Text>
        <View style={styles.embedTrackFlex}>{trackBlock}</View>
        <Text style={styles.embedLabel}>{bottomLabel}</Text>
        <Text style={[styles.embedValue, {color: accent}]}>{valueLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, {height}]}>
      <Text style={styles.edgeTop}>{topLabel}</Text>
      {trackBlock}
      <Text style={styles.edgeBottom}>{bottomLabel}</Text>
      <Text style={[styles.value, {color: accent}]}>{valueLabel}</Text>
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
    paddingHorizontal: 2,
  },
  embedColPhase: {
    borderLeftWidth: 1,
    borderLeftColor: HertzTheme.glassBorder,
  },
  embedColBeat: {
    borderRightWidth: 1,
    borderRightColor: HertzTheme.glassBorder,
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
