import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PanResponder, StyleSheet, Text, View, type GestureResponderEvent} from 'react-native';
import {Canvas, Circle, Path, Skia, type SkPath} from '@shopify/react-native-skia';
import {useHertzStore} from '../../state/store';
import {buildRingSegments, computeProtocolTotalSec, evaluateProtocolAt} from '../../protocol/interpolateProtocol';
import type {ProtocolRingSegment} from '../../protocol/types';
import {HertzTheme} from '../../theme/hertzTheme';

const SIZE = 168;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2 - 2;
const CENTER = SIZE / 2;
const TAU = Math.PI * 2;

function arcPath(startFraction: number, endFraction: number): SkPath {
  const path = Skia.Path.Make();
  const a0 = -Math.PI / 2 + startFraction * TAU;
  const a1 = -Math.PI / 2 + endFraction * TAU;
  const steps = Math.max(2, Math.ceil((endFraction - startFraction) * 64));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = CENTER + RADIUS * Math.cos(a);
    const y = CENTER + RADIUS * Math.sin(a);
    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  return path;
}

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function fractionFromLocalPoint(localX: number, localY: number): number {
  const dx = localX - CENTER;
  const dy = localY - CENTER;
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) {
    angle += TAU;
  }
  return Math.max(0, Math.min(1, angle / TAU));
}

function elapsedFromEvent(event: GestureResponderEvent, totalSec: number): number {
  const {locationX, locationY} = event.nativeEvent;
  return fractionFromLocalPoint(locationX, locationY) * totalSec;
}

type RingCanvasProps = {
  segments: ProtocolRingSegment[];
  activeStepIndex: number;
  progress: number;
};

const RingCanvas = React.memo(function RingCanvas({segments, activeStepIndex, progress}: RingCanvasProps) {
  const segmentPaths = useMemo(
    () =>
      segments.map(seg => ({
        stepIndex: seg.stepIndex,
        path: arcPath(seg.startFraction + 0.004, seg.endFraction - 0.004),
        color: seg.color,
      })),
    [segments],
  );

  const progressQuantized = Math.round(progress * 120) / 120;
  const progressPath = useMemo(() => {
    if (progressQuantized <= 0) {
      return null;
    }
    return arcPath(0, progressQuantized);
  }, [progressQuantized]);

  const headAngle = -Math.PI / 2 + progressQuantized * TAU;
  const headX = CENTER + RADIUS * Math.cos(headAngle);
  const headY = CENTER + RADIUS * Math.sin(headAngle);

  return (
    <Canvas style={{width: SIZE, height: SIZE}}>
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        style="stroke"
        strokeWidth={STROKE}
        color="rgba(255,255,255,0.08)"
      />
      {segmentPaths.map(seg => (
        <Path
          key={seg.stepIndex}
          path={seg.path}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="butt"
          color={seg.color}
          opacity={seg.stepIndex === activeStepIndex ? 1 : 0.32}
        />
      ))}
      {progressPath != null && (
        <Path
          path={progressPath}
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
          color="#FFFFFF"
          opacity={0.85}
        />
      )}
      <Circle cx={headX} cy={headY} r={6} color="#FFFFFF" />
      <Circle cx={headX} cy={headY} r={3} color={HertzTheme.neon.cyan} />
    </Canvas>
  );
});

/** Circular journey timer — segment arcs, scrubbable playhead, live Hz center. */
export function ProtocolRing() {
  const protocol = useHertzStore(s => s.activeProtocol);
  const elapsedSec = useHertzStore(s => s.elapsedSec);
  const seekProtocolElapsed = useHertzStore(s => s.seekProtocolElapsed);
  const setProtocolScrubbing = useHertzStore(s => s.setProtocolScrubbing);

  /** Local preview while dragging — avoids store/native floods until release. */
  const [scrubElapsed, setScrubElapsed] = useState<number | null>(null);
  const scrubPendingRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      setProtocolScrubbing(false);
    },
    [setProtocolScrubbing],
  );

  const segments = useMemo(
    () => (protocol != null ? buildRingSegments(protocol) : []),
    [protocol],
  );

  const totalSec = useMemo(
    () => (protocol != null ? computeProtocolTotalSec(protocol) : 0),
    [protocol],
  );

  const displayElapsed = scrubElapsed ?? elapsedSec;

  const ev = useMemo(
    () => (protocol != null ? evaluateProtocolAt(protocol, displayElapsed) : null),
    [protocol, displayElapsed],
  );

  const scheduleScrubPreview = useCallback((elapsed: number) => {
    scrubPendingRef.current = elapsed;
    if (rafRef.current != null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (scrubPendingRef.current != null) {
        setScrubElapsed(scrubPendingRef.current);
      }
    });
  }, []);

  const commitSeek = useCallback(
    (elapsed: number) => {
      if (totalSec <= 0) {
        return;
      }
      const clamped = Math.max(0, Math.min(elapsed, totalSec));
      seekProtocolElapsed(clamped);
    },
    [seekProtocolElapsed, totalSec],
  );

  const endScrub = useCallback(() => {
    scrubPendingRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setScrubElapsed(null);
    setProtocolScrubbing(false);
  }, [setProtocolScrubbing]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: event => {
          setProtocolScrubbing(true);
          if (totalSec > 0) {
            scheduleScrubPreview(elapsedFromEvent(event, totalSec));
          }
        },
        onPanResponderMove: event => {
          if (totalSec > 0) {
            scheduleScrubPreview(elapsedFromEvent(event, totalSec));
          }
        },
        onPanResponderRelease: event => {
          if (totalSec > 0) {
            commitSeek(elapsedFromEvent(event, totalSec));
          }
          endScrub();
        },
        onPanResponderTerminate: () => {
          endScrub();
        },
      }),
    [commitSeek, endScrub, scheduleScrubPreview, setProtocolScrubbing, totalSec],
  );

  if (protocol == null || ev == null) {
    return null;
  }

  const centerHz = ev.beatHz;

  return (
    <View style={styles.wrap}>
      <View style={styles.ringBox} {...panResponder.panHandlers}>
        <RingCanvas segments={segments} activeStepIndex={ev.stepIndex} progress={ev.totalProgress} />

        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={styles.centerHz}>{centerHz.toFixed(centerHz < 10 ? 2 : 1)}</Text>
          <Text style={styles.centerUnit}>Hz</Text>
          <Text style={styles.centerStep} numberOfLines={1}>
            {ev.stepLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaClock}>{fmtClock(displayElapsed)}</Text>
        <Text style={styles.metaHint}>{scrubElapsed != null ? 'scrubbing…' : 'drag to scrub'}</Text>
        <Text style={styles.metaRemain}>−{fmtClock(ev.remainingSec)}</Text>
      </View>
      <Text style={styles.stepCount}>
        Step {ev.stepIndex + 1} of {protocol.steps.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  ringBox: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 38,
  },
  centerUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginTop: -2,
  },
  centerStep: {
    fontSize: 11,
    fontWeight: '600',
    color: HertzTheme.neon.cyan,
    marginTop: 4,
    maxWidth: SIZE - 48,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SIZE + 24,
  },
  metaClock: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.secondary,
  },
  metaHint: {
    fontSize: 9,
    color: HertzTheme.text.muted,
    fontStyle: 'italic',
  },
  metaRemain: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
  },
  stepCount: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    letterSpacing: 0.4,
  },
});
