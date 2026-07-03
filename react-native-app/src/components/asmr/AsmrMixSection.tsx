import React from 'react';
import {StyleSheet, Switch, Text, View, type ViewStyle} from 'react-native';
import {ASMR_STEM_CATALOG, type AsmrStemId} from '../../audio/asmrStems';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from '../math/MathFoldSection';
import {NeonSlider} from '../player/NeonSlider';

type AsmrMixSectionProps = {
  foldStyle?: ViewStyle;
  embedded?: boolean;
};

export function AsmrMixSection({foldStyle, embedded = false}: AsmrMixSectionProps) {
  const asmrEnabled = useHertzStore(s => s.asmrEnabled);
  const asmrStemMix = useHertzStore(s => s.asmrStemMix);
  const setAsmrEnabled = useHertzStore(s => s.setAsmrEnabled);
  const setAsmrStemMix = useHertzStore(s => s.setAsmrStemMix);

  return (
    <MathFoldSection
      icon="🎧"
      title="ASMR Textures"
      tag="Sound"
      blurb="Optional soft texture layers under the tone — procedural stems, mix independently"
      defaultExpanded={false}
      embedded={embedded}
      style={foldStyle}>
      <View style={styles.row}>
        <Text style={styles.toggleLabel}>ASMR mix</Text>
        <Switch
          value={asmrEnabled}
          onValueChange={setAsmrEnabled}
          trackColor={{false: HertzTheme.glassBorder, true: HertzTheme.neon.cyan}}
          thumbColor={asmrEnabled ? HertzTheme.neon.cyan : HertzTheme.text.muted}
        />
      </View>
      <Text style={styles.hint}>
        Layers blend under entrainment and respect background audio. Off by default.
      </Text>

      {ASMR_STEM_CATALOG.map(stem => (
        <View key={stem.id} style={[styles.stemRow, !asmrEnabled && styles.stemDisabled]}>
          <View style={styles.stemHeader}>
            <Text style={[styles.stemLabel, {color: stem.accent}]}>{stem.label}</Text>
            <Text style={styles.stemTag}>{stem.tag}</Text>
          </View>
          <Text style={styles.stemHint}>{stem.hint}</Text>
          <View style={styles.sliderRow}>
            <NeonSlider
              value={asmrStemMix[stem.id as AsmrStemId]}
              onChange={v => setAsmrStemMix(stem.id as AsmrStemId, v)}
              accent={stem.accent}
            />
            <Text style={styles.pct}>{Math.round(asmrStemMix[stem.id as AsmrStemId] * 100)}%</Text>
          </View>
        </View>
      ))}
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
    marginBottom: 12,
  },
  stemRow: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: HertzTheme.glassBorder,
  },
  stemDisabled: {
    opacity: 0.5,
  },
  stemHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  stemLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  stemTag: {
    fontSize: 10,
    color: HertzTheme.text.muted,
  },
  stemHint: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginBottom: 6,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pct: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
    minWidth: 36,
    textAlign: 'right',
  },
});
