import React from 'react';
import {StyleSheet} from 'react-native';
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
    </MathFoldSection>
  );
}

const styles = StyleSheet.create({
  commandLine: {
    marginHorizontal: 0,
    marginBottom: 8,
  },
});
