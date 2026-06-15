import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {computeProtocolTotalSec} from '../../protocol/interpolateProtocol';
import {ProtocolRing} from '../protocol/ProtocolRing';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

function parseMin(text: string, fallbackMin: number): number {
  const n = parseFloat(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallbackMin;
}

type SimpleSessionAutomationProps = {
  compact?: boolean;
};

/**
 * Session Automation — sleep timer, fade point, transition velocity, progress ring.
 * Maps to session duration, protocol fade-out, and DSP fadeMs without exposing math UI.
 */
export function SimpleSessionAutomation({compact = false}: SimpleSessionAutomationProps) {
  const durationSec = useHertzStore(s => s.durationSec);
  const defaultDurationSec = useHertzStore(s => s.defaultDurationSec);
  const fadeMs = useHertzStore(s => s.fadeMs);
  const activeProtocol = useHertzStore(s => s.activeProtocol);
  const protocolRunning = useHertzStore(s => s.protocolRunning);
  const elapsedSec = useHertzStore(s => s.elapsedSec);
  const setParam = useHertzStore(s => s.setParam);
  const updateSettings = useHertzStore(s => s.updateSettings);
  const updateProtocolFadeOut = useHertzStore(s => s.updateProtocolFadeOut);
  const replaceActiveProtocol = useHertzStore(s => s.replaceActiveProtocol);

  const sleepMin = Math.round((durationSec || defaultDurationSec) / 60);
  const fadeOutMin = activeProtocol
    ? Math.round((activeProtocol.fadeOutDurationSec ?? 300) / 60)
    : 5;
  const transitionSec = Math.round(fadeMs / 1000);

  const totalSec = useMemo(() => {
    if (protocolRunning && activeProtocol) {
      return computeProtocolTotalSec(activeProtocol);
    }
    return durationSec || defaultDurationSec;
  }, [protocolRunning, activeProtocol, durationSec, defaultDurationSec]);

  const onSleepMin = useCallback(
    (min: number) => {
      const sec = Math.max(60, min * 60);
      updateSettings({defaultDurationSec: sec});
      useHertzStore.setState({durationSec: sec});
    },
    [updateSettings],
  );

  const onFadeMin = useCallback(
    (min: number) => {
      const sec = Math.max(30, min * 60);
      if (activeProtocol) {
        updateProtocolFadeOut({fadeOutDurationSec: sec});
      }
    },
    [activeProtocol, updateProtocolFadeOut],
  );

  const onTransitionSec = useCallback(
    (sec: number) => {
      setParam('fadeMs', Math.max(200, Math.min(30_000, sec * 1000)));
    },
    [setParam],
  );

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact && <Text style={styles.title}>Session Automation</Text>}

      <View style={styles.ringRow}>
        <ProtocolRing />
        <View style={styles.ringMeta}>
          <Text style={styles.clockLabel}>
            {protocolRunning ? 'Sequence active' : 'Session clock'}
          </Text>
          <Text style={styles.clockValue}>
            {Math.floor(elapsedSec / 60)}:{String(Math.floor(elapsedSec % 60)).padStart(2, '0')}
            {' / '}
            {Math.floor(totalSec / 60)}:{String(Math.floor(totalSec % 60)).padStart(2, '0')}
          </Text>
        </View>
      </View>

      <View style={styles.fieldRow}>
        <Field
          label="Sleep Time (min)"
          value={String(sleepMin)}
          onCommit={t => onSleepMin(parseMin(t, sleepMin))}
        />
        <Field
          label="Fade Point (min before end)"
          value={String(fadeOutMin)}
          onCommit={t => onFadeMin(parseMin(t, fadeOutMin))}
        />
        <Field
          label="Transition Velocity (sec)"
          value={String(transitionSec)}
          onCommit={t => onTransitionSec(parseMin(t, transitionSec))}
        />
      </View>

      {activeProtocol && !protocolRunning && (
        <Pressable
          style={styles.applyBtn}
          onPress={() => replaceActiveProtocol(activeProtocol)}>
          <Text style={styles.applyBtnText}>Apply automation to draft sequence</Text>
        </Pressable>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (text: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        defaultValue={value}
        keyboardType="decimal-pad"
        onEndEditing={e => onCommit(e.nativeEvent.text)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  wrapCompact: {
    marginHorizontal: 0,
    marginTop: 8,
  },
  title: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 1,
    marginBottom: 10,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  ringMeta: {
    flex: 1,
  },
  clockLabel: {
    fontSize: 11,
    color: HertzTheme.text.muted,
  },
  clockValue: {
    fontFamily: HertzTheme.mono,
    fontSize: 16,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    marginTop: 4,
  },
  fieldRow: {
    gap: 10,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    color: HertzTheme.text.muted,
  },
  fieldInput: {
    fontFamily: HertzTheme.mono,
    fontSize: 14,
    color: HertzTheme.text.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  applyBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(92,225,255,0.12)',
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: HertzTheme.neon.cyan,
  },
});
