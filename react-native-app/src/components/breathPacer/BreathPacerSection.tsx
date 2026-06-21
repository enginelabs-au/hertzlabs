import React from 'react';
import {Pressable, StyleSheet, Switch, Text, View, type ViewStyle} from 'react-native';
import {
  BREATH_PATTERNS,
  MAX_BREATH_DELTA_DB,
  MIN_BREATH_DELTA_DB,
  type BreathPatternId,
} from '../../breathPacer/patterns';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from '../math/MathFoldSection';
import {NeonSlider} from '../player/NeonSlider';

type BreathPacerSectionProps = {
  foldStyle?: ViewStyle;
  embedded?: boolean;
};

export function BreathPacerSection({foldStyle, embedded = false}: BreathPacerSectionProps) {
  const enabled = useHertzStore(s => s.breathPacerEnabled);
  const patternId = useHertzStore(s => s.breathPatternId);
  const deltaDb = useHertzStore(s => s.breathDeltaDb);
  const setEnabled = useHertzStore(s => s.setBreathPacerEnabled);
  const setPatternId = useHertzStore(s => s.setBreathPatternId);
  const setDeltaDb = useHertzStore(s => s.setBreathDeltaDb);

  const deltaNorm =
    (deltaDb - MIN_BREATH_DELTA_DB) / (MAX_BREATH_DELTA_DB - MIN_BREATH_DELTA_DB);

  return (
    <MathFoldSection
      icon="🫁"
      title="Acoustic Breath Pacing"
      tag="Overlay"
      blurb="Close your eyes — volume follows inhale, hold, exhale cycles in the DSP"
      defaultExpanded={false}
      embedded={embedded}
      style={foldStyle}>
      <View style={styles.row}>
        <Text style={styles.toggleLabel}>Breath overlay</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{false: HertzTheme.glassBorder, true: HertzTheme.neon.cyan}}
          thumbColor={enabled ? HertzTheme.neon.cyan : HertzTheme.text.muted}
        />
      </View>

      <Text style={styles.hint}>
        Subtle master-volume modulation ({MIN_BREATH_DELTA_DB}–{MAX_BREATH_DELTA_DB} dB swing) —
        does not alter your beat frequency.
      </Text>

      <ScrollChips
        patternId={patternId}
        onSelect={setPatternId}
        disabled={!enabled}
      />

      <View style={[styles.deltaRow, !enabled && styles.disabled]}>
        <Text style={styles.deltaLabel}>Depth · {deltaDb.toFixed(1)} dB</Text>
        <NeonSlider
          value={deltaNorm}
          onChange={norm =>
            setDeltaDb(
              MIN_BREATH_DELTA_DB + norm * (MAX_BREATH_DELTA_DB - MIN_BREATH_DELTA_DB),
            )
          }
          accent={HertzTheme.neon.magenta}
        />
      </View>
    </MathFoldSection>
  );
}

function ScrollChips({
  patternId,
  onSelect,
  disabled,
}: {
  patternId: BreathPatternId;
  onSelect: (id: BreathPatternId) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.chips}>
      {BREATH_PATTERNS.map(p => {
        const active = patternId === p.id;
        return (
          <Pressable
            key={p.id}
            style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
            onPress={() => onSelect(p.id)}
            disabled={disabled}
            accessibilityRole="button">
            <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>{p.label}</Text>
            <Text style={styles.chipSub}>{p.subtitle}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: HertzTheme.text.primary,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    color: HertzTheme.text.muted,
    fontFamily: HertzTheme.mono,
    marginBottom: 12,
  },
  chips: {
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.08)',
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: HertzTheme.text.secondary,
  },
  chipTitleActive: {
    color: HertzTheme.neon.cyan,
  },
  chipSub: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 3,
    fontFamily: HertzTheme.mono,
  },
  deltaRow: {
    gap: 8,
  },
  deltaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: HertzTheme.text.secondary,
    fontFamily: HertzTheme.mono,
  },
  disabled: {
    opacity: 0.5,
  },
});
