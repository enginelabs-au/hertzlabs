import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {ENGINE_CATALOG} from '../../audio/engineModes';
import {BREATH_PATTERNS, breathPatternMeta} from '../../breathPacer/patterns';
import {getProtocolsForEngine} from '../../protocol/builtinProtocols';
import {
  computeProtocolTotalSec,
  computeStepsTotalSec,
  normalizeProtocol,
  scaleProtocolStepsToTotalMin,
} from '../../protocol/interpolateProtocol';
import type {ProtocolStep, RampCurve, SessionProtocol} from '../../protocol/types';
import {useHertzStore} from '../../state/store';
import type {EngineMode} from '../../state/types';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from '../math/MathFoldSection';
import {ProtocolRing} from './ProtocolRing';

const ENGINE_CHIPS = ENGINE_CATALOG.filter(e => !e.comingSoon).map(e => ({
  mode: e.mode,
  label: e.label,
}));

function cloneProtocol(p: SessionProtocol): SessionProtocol {
  return normalizeProtocol(JSON.parse(JSON.stringify(p)) as SessionProtocol);
}

function fmtMin(sec: number): string {
  const m = sec / 60;
  return Number.isInteger(m) ? `${m}` : m.toFixed(1);
}

function parseNum(text: string, fallback: number): number {
  const n = parseFloat(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

type StepRowProps = {
  step: ProtocolStep;
  onChange: (patch: Partial<ProtocolStep>) => void;
};

function StepRow({step, onChange}: StepRowProps) {
  const [open, setOpen] = useState(false);
  const volStart = Math.round(step.startGain * 100);
  const volEnd = Math.round(step.endGain * 100);
  const breathLabel = step.breathPatternId
    ? breathPatternMeta(step.breathPatternId).label
    : null;

  return (
    <View style={styles.stepRow}>
      <Pressable
        style={styles.stepHead}
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button">
        <View style={styles.stepDot} />
        <View style={styles.stepHeadText}>
          <Text style={styles.stepLabel}>{step.label}</Text>
          <Text style={styles.stepSummary}>
            {fmtMin(step.durationSec)} min · {step.startBeatHz}→{step.endBeatHz} Hz · vol {volStart}→{volEnd}%
            {breathLabel != null ? ` · ${breathLabel}` : ''}
          </Text>
        </View>
        <Text style={[styles.chev, open && styles.chevOpen]}>›</Text>
      </Pressable>

      {open && (
        <View style={styles.stepBody}>
          <View style={styles.fieldGrid}>
            <Field
              label="Duration (min)"
              value={fmtMin(step.durationSec)}
              onCommit={t => onChange({durationSec: Math.max(1, parseNum(t, 1)) * 60})}
            />
            <Field
              label="Start Hz"
              value={String(step.startBeatHz)}
              onCommit={t => onChange({startBeatHz: parseNum(t, step.startBeatHz)})}
            />
            <Field
              label="End Hz"
              value={String(step.endBeatHz)}
              onCommit={t => onChange({endBeatHz: parseNum(t, step.endBeatHz)})}
            />
            <Field
              label="Volume start %"
              value={String(volStart)}
              onCommit={t => onChange({startGain: parseNum(t, volStart) / 100})}
            />
            <Field
              label="Volume end %"
              value={String(volEnd)}
              onCommit={t => onChange({endGain: parseNum(t, volEnd) / 100})}
            />
          </View>
          <View style={styles.inlineRow}>
            <Text style={styles.miniLabel}>Glide</Text>
            {(['linear', 'logarithmic'] as RampCurve[]).map(c => (
              <Pressable
                key={c}
                style={[styles.miniChip, step.curve === c && styles.miniChipActive]}
                onPress={() => onChange({curve: c})}>
                <Text style={[styles.miniChipText, step.curve === c && styles.miniChipTextActive]}>
                  {c === 'linear' ? 'Linear' : 'Smooth'}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engineChipScroll}>
            <View style={styles.inlineRow}>
              <Text style={styles.miniLabel}>Engine</Text>
              {ENGINE_CHIPS.map(e => (
                <Pressable
                  key={e.mode}
                  style={[styles.miniChip, step.engineMode === e.mode && styles.miniChipActive]}
                  onPress={() => onChange({engineMode: e.mode})}>
                  <Text style={[styles.miniChipText, step.engineMode === e.mode && styles.miniChipTextActive]}>
                    {e.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engineChipScroll}>
            <View style={styles.inlineRow}>
              <Text style={styles.miniLabel}>Breath</Text>
              <Pressable
                style={[styles.miniChip, step.breathPatternId == null && styles.miniChipActive]}
                onPress={() => onChange({breathPatternId: undefined})}>
                <Text
                  style={[
                    styles.miniChipText,
                    step.breathPatternId == null && styles.miniChipTextActive,
                  ]}>
                  None
                </Text>
              </Pressable>
              {BREATH_PATTERNS.map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.miniChip, step.breathPatternId === p.id && styles.miniChipActive]}
                  onPress={() => onChange({breathPatternId: p.id})}>
                  <Text
                    style={[
                      styles.miniChipText,
                      step.breathPatternId === p.id && styles.miniChipTextActive,
                    ]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Field({label, value, onCommit}: {label: string; value: string; onCommit: (t: string) => void}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        key={`${label}-${value}`}
        style={styles.fieldInput}
        defaultValue={value}
        keyboardType="decimal-pad"
        onEndEditing={e => onCommit(e.nativeEvent.text)}
      />
    </View>
  );
}

type ProtocolSequencesSectionProps = {
  foldStyle?: ViewStyle;
  /** When omitted, uses the live selected engine from the store (AI / Math tabs). */
  engineMode?: EngineMode;
  embedded?: boolean;
};

export function ProtocolSequencesSection({
  foldStyle,
  engineMode,
  embedded = false,
}: ProtocolSequencesSectionProps) {
  const storeEngineType = useHertzStore(s => s.engineType);
  const resolvedEngine = engineMode ?? storeEngineType;
  const presets = useMemo(() => getProtocolsForEngine(resolvedEngine), [resolvedEngine]);

  const startProtocol = useHertzStore(s => s.startProtocol);
  const stopProtocol = useHertzStore(s => s.stopProtocol);
  const updateProtocolStep = useHertzStore(s => s.updateProtocolStep);
  const setProtocolTotalMin = useHertzStore(s => s.setProtocolTotalMin);
  const replaceActiveProtocol = useHertzStore(s => s.replaceActiveProtocol);
  const setProtocolAutoStop = useHertzStore(s => s.setProtocolAutoStop);
  const updateProtocolFadeOut = useHertzStore(s => s.updateProtocolFadeOut);
  const activeProtocol = useHertzStore(s => s.activeProtocol);
  const protocolRunning = useHertzStore(s => s.protocolRunning);
  const protocolDraftSeed = useHertzStore(s => s.protocolDraftSeed);
  const protocolDraftSeedVersion = useHertzStore(s => s.protocolDraftSeedVersion);
  const isPlaying = useHertzStore(s => s.isPlaying);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const requestPause = useHertzStore(s => s.requestPause);

  const [draft, setDraft] = useState<SessionProtocol>(() => cloneProtocol(presets[0]));

  useEffect(() => {
    if (!protocolRunning) {
      setDraft(cloneProtocol(presets[0]));
    }
  }, [resolvedEngine, presets, protocolRunning]);

  useEffect(() => {
    if (protocolDraftSeed != null && !protocolRunning) {
      setDraft(cloneProtocol(protocolDraftSeed));
    }
  }, [protocolDraftSeed, protocolDraftSeedVersion, protocolRunning]);

  const protocol = protocolRunning && activeProtocol != null ? activeProtocol : draft;
  const isLive = protocolRunning && activeProtocol != null;

  const loadPreset = useCallback(
    (preset: SessionProtocol) => {
      const next = cloneProtocol(preset);
      if (isLive) {
        replaceActiveProtocol(next);
      } else {
        setDraft(next);
      }
    },
    [isLive, replaceActiveProtocol],
  );

  const editStep = useCallback(
    (stepId: string, patch: Partial<ProtocolStep>) => {
      if (isLive) {
        updateProtocolStep(stepId, patch);
        return;
      }
      setDraft(d =>
        normalizeProtocol({
          ...d,
          steps: d.steps.map(s => (s.id === stepId ? {...s, ...patch} : s)),
        }),
      );
    },
    [isLive, updateProtocolStep],
  );

  const applyTotalMin = useCallback(
    (text: string) => {
      const min = Math.max(1, parseNum(text, 1));
      if (isLive) {
        setProtocolTotalMin(min);
        return;
      }
      setDraft(d =>
        normalizeProtocol({
          ...d,
          steps: scaleProtocolStepsToTotalMin(d.steps, min),
        }),
      );
    },
    [isLive, setProtocolTotalMin],
  );

  const setAutoStop = useCallback(
    (enabled: boolean) => {
      if (isLive) {
        setProtocolAutoStop(enabled);
        return;
      }
      setDraft(d => ({...d, stopAfterPlayback: enabled}));
    },
    [isLive, setProtocolAutoStop],
  );

  const editFadeOut = useCallback(
    (
      patch: Partial<
        Pick<SessionProtocol, 'fadeOutDurationSec' | 'fadeOutStartGain' | 'fadeOutEndGain'>
      >,
    ) => {
      if (isLive) {
        updateProtocolFadeOut(patch);
        return;
      }
      setDraft(d => normalizeProtocol({...d, ...patch}));
    },
    [isLive, updateProtocolFadeOut],
  );

  const handleStart = useCallback(() => startProtocol(draft), [draft, startProtocol]);
  const handleStop = useCallback(() => {
    stopProtocol();
    requestPause();
  }, [requestPause, stopProtocol]);

  const totalMin = fmtMin(computeStepsTotalSec(protocol.steps));
  const fadeMin = fmtMin(protocol.fadeOutDurationSec);
  const fadeStartPct = Math.round(protocol.fadeOutStartGain * 100);
  const fadeEndPct = Math.round(protocol.fadeOutEndGain * 100);
  const journeyMin = fmtMin(computeProtocolTotalSec(protocol));

  return (
    <MathFoldSection
      icon="⏱"
      title="Protocol Sequences"
      tag={protocolRunning ? 'Running' : 'Timeline'}
      blurb="Chain frequency states over time — each step glides Hz and volume, with auto-stop."
      deepDive="Pick a journey, tweak any step's length, Hz glide, and volume, then start. Ask AI Guide or AI Formula for a custom sequence — it loads here for editing."
      isActive={protocolRunning}
      defaultExpanded={false}
      embedded={embedded}
      style={foldStyle}>
      {isLive && <ProtocolRing />}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetScroll}
        style={styles.presetScrollWrap}>
        {presets.map(p => (
          <Pressable
            key={p.id}
            style={[styles.presetChip, protocol.id === p.id && styles.presetChipActive]}
            onPress={() => loadPreset(p)}>
            <Text style={[styles.presetChipText, protocol.id === p.id && styles.presetChipTextActive]}>
              {p.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.desc}>{protocol.description}</Text>

      {protocol.steps.map(step => (
        <StepRow key={step.id} step={step} onChange={patch => editStep(step.id, patch)} />
      ))}

      <View style={styles.totalRow}>
        <View style={styles.totalFieldWrap}>
          <Text style={styles.totalLabel}>Total (min)</Text>
          <TextInput
            key={`total-${totalMin}-${isLive}`}
            style={styles.totalInput}
            defaultValue={totalMin}
            keyboardType="decimal-pad"
            onEndEditing={e => applyTotalMin(e.nativeEvent.text)}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.totalText}>Stop at end</Text>
          <Switch
            value={protocol.stopAfterPlayback}
            onValueChange={setAutoStop}
            trackColor={{false: '#333', true: HertzTheme.neon.cyan}}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.fadeSection}>
        <Text style={styles.fadeTitle}>Fade out</Text>
        <View style={styles.fieldGrid}>
          <Field
            label="Duration (min)"
            value={fadeMin}
            onCommit={t =>
              editFadeOut({fadeOutDurationSec: Math.max(0, parseNum(t, 0.5)) * 60})
            }
          />
          <Field
            label="Vol start %"
            value={String(fadeStartPct)}
            onCommit={t => editFadeOut({fadeOutStartGain: parseNum(t, fadeStartPct) / 100})}
          />
          <Field
            label="Vol end %"
            value={String(fadeEndPct)}
            onCommit={t => editFadeOut({fadeOutEndGain: parseNum(t, fadeEndPct) / 100})}
          />
        </View>
        <Text style={styles.fadeHint}>
          End fade after all steps · journey total {journeyMin} min (incl. fade)
        </Text>
      </View>

      {isLive ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.stopBtn} onPress={handleStop}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => (isPlaying ? requestPause() : requestPlay())}>
            <Text style={styles.secondaryBtnText}>{isPlaying ? 'Pause' : 'Resume'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startBtnText}>▶  Start sequence</Text>
        </Pressable>
      )}

      {isLive && (
        <Text style={styles.liveHint}>
          Edits update frequency live. Drag the ring to scrub the timeline. Your selected engine stays active.
        </Text>
      )}
    </MathFoldSection>
  );
}

const styles = StyleSheet.create({
  presetScrollWrap: {
    marginBottom: 8,
    marginHorizontal: -4,
  },
  presetScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetChipActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.12)',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: HertzTheme.text.secondary,
  },
  presetChipTextActive: {
    color: HertzTheme.neon.cyan,
  },
  desc: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginBottom: 10,
    lineHeight: 16,
  },
  stepRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 6,
    overflow: 'hidden',
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HertzTheme.neon.cyan,
  },
  stepHeadText: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  stepSummary: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
  },
  chev: {
    fontSize: 18,
    color: HertzTheme.text.muted,
    width: 12,
  },
  chevOpen: {
    transform: [{rotate: '90deg'}],
    color: HertzTheme.neon.cyan,
  },
  stepBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingTop: 8,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  field: {
    gap: 3,
  },
  fieldLabel: {
    fontSize: 9,
    color: HertzTheme.text.muted,
  },
  fieldInput: {
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: HertzTheme.text.primary,
    fontSize: 12,
    fontFamily: HertzTheme.mono,
    textAlign: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 6,
  },
  engineChipScroll: {
    paddingRight: 8,
  },
  miniLabel: {
    fontSize: 9,
    color: HertzTheme.text.muted,
    marginRight: 2,
  },
  miniChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  miniChipActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.1)',
  },
  miniChipText: {
    fontSize: 10,
    color: HertzTheme.text.muted,
  },
  miniChipTextActive: {
    color: HertzTheme.neon.cyan,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
    gap: 8,
  },
  totalFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: {
    fontSize: 11,
    color: HertzTheme.text.secondary,
    fontWeight: '600',
  },
  totalInput: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: HertzTheme.text.primary,
    fontSize: 12,
    fontFamily: HertzTheme.mono,
    textAlign: 'center',
  },
  fadeSection: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 6,
  },
  fadeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.text.secondary,
  },
  fadeHint: {
    fontSize: 9,
    color: HertzTheme.text.muted,
    fontStyle: 'italic',
  },
  totalText: {
    fontSize: 11,
    color: HertzTheme.text.secondary,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  startBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(92,225,255,0.15)',
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
  },
  startBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
  },
  stopBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: HertzTheme.text.secondary,
  },
  liveHint: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});
