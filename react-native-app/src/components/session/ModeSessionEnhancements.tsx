import React from 'react';
import type {ViewStyle} from 'react-native';
import {AsmrMixSection} from '../asmr/AsmrMixSection';
import {GuidedDepthSection} from '../guidedDepth/GuidedDepthSection';

type ModeSessionEnhancementsProps = {
  foldStyle?: ViewStyle;
  embedded?: boolean;
};

/** Guided relaxation + ASMR texture folds shared across engine, math, and AI menus. */
export function ModeSessionEnhancements({
  foldStyle,
  embedded = true,
}: ModeSessionEnhancementsProps) {
  return (
    <>
      <GuidedDepthSection foldStyle={foldStyle} embedded={embedded} />
      <AsmrMixSection foldStyle={foldStyle} embedded={embedded} />
    </>
  );
}
