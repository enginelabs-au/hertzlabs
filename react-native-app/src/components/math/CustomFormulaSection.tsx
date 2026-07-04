import React from 'react';
import {StyleSheet, View} from 'react-native';
import {BreathPacerSection} from '../breathPacer/BreathPacerSection';
import {ProtocolSequencesSection} from '../protocol/ProtocolSequencesSection';
import {ModeSessionEnhancements} from '../session/ModeSessionEnhancements';
import {MathFoldSection} from './MathFoldSection';
import {CommandLineCard} from '../layout/CommandLineCard';
import {CustomFormulaInput} from './CustomFormulaInput';

import type {FormulaAppliedPayload} from './activeFormulaDisplay';

type CustomFormulaSectionProps = {
  unlocked: boolean;
  formulaPrimary: string;
  formulaSubtitle: string;
  onUpgrade: () => void;
  onFormulaApplied: (payload: FormulaAppliedPayload) => void;
};

export function CustomFormulaSection({
  unlocked,
  formulaPrimary,
  formulaSubtitle,
  onUpgrade,
  onFormulaApplied,
}: CustomFormulaSectionProps) {
  return (
    <MathFoldSection
      icon="∑"
      title="Custom Formula"
      tag="Manual"
      blurb="Build a beat target with symbols, constants, and live L/R variables."
      deepDive="Compose f_target from f_L, f_R, φ, π, and sqrt(). Apply to retune the playing differential instantly."
      isLocked={!unlocked}
      onUpgrade={onUpgrade}>
      <CommandLineCard
        formula={formulaPrimary}
        subtitle={formulaSubtitle}
        style={styles.commandLine}
      />
      <CustomFormulaInput embedded onFormulaApplied={onFormulaApplied} />
      <View style={styles.nestedFold}>
        <ModeSessionEnhancements foldStyle={styles.nestedFoldInner} embedded />
        <BreathPacerSection foldStyle={styles.nestedFoldInner} embedded />
        <ProtocolSequencesSection foldStyle={styles.nestedFoldInner} embedded />
      </View>
    </MathFoldSection>
  );
}

const styles = StyleSheet.create({
  commandLine: {
    marginHorizontal: 0,
    marginBottom: 8,
  },
  nestedFold: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  nestedFoldInner: {
    marginHorizontal: 0,
  },
});
