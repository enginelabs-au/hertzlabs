import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Switch, Text, View, type ViewStyle} from 'react-native';
import {applyGuidedDepthPreset} from '../../guidedDepth/applyGuidedDepthPreset';
import {GUIDED_DEPTH_PRESETS, guidedDepthPreset, type GuidedDepthPresetId} from '../../guidedDepth/presets';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from '../math/MathFoldSection';

type GuidedDepthSectionProps = {
  foldStyle?: ViewStyle;
  embedded?: boolean;
};

export function GuidedDepthSection({foldStyle, embedded = false}: GuidedDepthSectionProps) {
  const enabled = useHertzStore(s => s.guidedDepthEnabled);
  const presetId = useHertzStore(s => s.guidedDepthPresetId);
  const setEnabled = useHertzStore(s => s.setGuidedDepthEnabled);
  const preset = guidedDepthPreset(presetId);

  const selectPreset = useCallback(
    (id: GuidedDepthPresetId) => {
      applyGuidedDepthPreset(id);
    },
    [],
  );

  return (
    <MathFoldSection
      icon="🌙"
      title="Guided Depth"
      tag="Relaxation"
      blurb="Delta/theta presets with slow breathing and text-only relaxation cues — not clinical hypnosis"
      defaultExpanded={false}
      embedded={embedded}
      style={foldStyle}>
      <View style={styles.row}>
        <Text style={styles.toggleLabel}>Guided relaxation</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{false: HertzTheme.glassBorder, true: HertzTheme.neon.purple}}
          thumbColor={enabled ? HertzTheme.neon.purple : HertzTheme.text.muted}
        />
      </View>

      <Text style={styles.hint}>
        Self-directed wellness scripts paired with entrainment and breath pacing. Stop anytime.
      </Text>

      <View style={styles.chips}>
        {GUIDED_DEPTH_PRESETS.map(p => {
          const active = presetId === p.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.chip, active && styles.chipActive, !enabled && styles.chipDisabled]}
              onPress={() => selectPreset(p.id)}
              disabled={!enabled}
              accessibilityRole="button">
              <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>{p.label}</Text>
              <Text style={styles.chipTag}>{p.tag}</Text>
            </Pressable>
          );
        })}
      </View>

      {enabled ? (
        <View style={styles.scriptBox}>
          <Text style={styles.scriptTitle}>Session cues</Text>
          {preset.scriptLines.map(line => (
            <Text key={line} style={styles.scriptLine}>
              · {line}
            </Text>
          ))}
          <Text style={styles.safety}>{preset.safetyNote}</Text>
        </View>
      ) : null}
    </MathFoldSection>
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
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    color: HertzTheme.text.primary,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    color: HertzTheme.text.muted,
    marginBottom: 10,
  },
  chips: {
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    borderRadius: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: {
    borderColor: HertzTheme.neon.purple,
    backgroundColor: 'rgba(180,120,255,0.08)',
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  chipTitleActive: {
    color: HertzTheme.neon.purple,
  },
  chipTag: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 2,
  },
  scriptBox: {
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingTop: 10,
    gap: 6,
  },
  scriptTitle: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.purple,
    letterSpacing: 0.5,
  },
  scriptLine: {
    fontSize: 12,
    lineHeight: 18,
    color: HertzTheme.text.secondary,
  },
  safety: {
    fontSize: 10,
    lineHeight: 15,
    color: HertzTheme.text.muted,
    marginTop: 4,
  },
});
