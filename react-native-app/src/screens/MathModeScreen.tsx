import React, {useState, useCallback, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {MathMode3DHeader} from '../components/math/MathMode3DHeader';
import {MathModeGroupRow, type MathPresetItem} from '../components/math/MathModeGroupRow';
import {getMathPresetFormula} from '../components/math/mathModeFormulas';
import type {ActiveFormulaDisplay, FormulaAppliedPayload} from '../components/math/activeFormulaDisplay';
import {ActiveTargetChip} from '../components/math/ActiveTargetChip';
import {CustomFormulaSection} from '../components/math/CustomFormulaSection';
import {AIFormulaSection} from '../components/math/AIFormulaSection';
import {ProtocolSequencesSection} from '../components/protocol/ProtocolSequencesSection';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {DEFAULT_BEAT_HZ} from '../audio/paramMapping';
import {HertzTheme} from '../theme/hertzTheme';

const MATH_PRESETS: MathPresetItem[] = [
  {id: 'schumann-1', label: '7.83 Hz', beatHz: 7.83, group: 'Schumann Resonances', isPremium: false, description: 'Primary Schumann resonance — Earth\'s electromagnetic heartbeat.'},
  {id: 'schumann-2', label: '14.3 Hz', beatHz: 14.3, group: 'Schumann Resonances', isPremium: true, description: '2nd Schumann harmonic — heightened alertness.'},
  {id: 'schumann-3', label: '20.8 Hz', beatHz: 20.8, group: 'Schumann Resonances', isPremium: true, description: '3rd Schumann harmonic — mid-Beta focus range.'},
  {id: 'schumann-4', label: '27.3 Hz', beatHz: 27.3, group: 'Schumann Resonances', isPremium: true, description: '4th Schumann harmonic — high-Beta arousal.'},
  {id: 'alpha-focus', label: '10.0 Hz', beatHz: 10.0, group: 'Alpha Focus', isPremium: false, description: 'Pure Alpha peak — relaxed, open focus.'},
  {id: 'phi-1', label: '1.618 Hz', beatHz: 1.618, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ¹ — deep Delta resonance at the golden ratio.'},
  {id: 'phi-2', label: '2.618 Hz', beatHz: 2.618, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ² — Delta boundary, deep restorative.'},
  {id: 'phi-3', label: '4.236 Hz', beatHz: 4.236, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ³ — Theta entry, meditation onset.'},
  {id: 'phi-4', label: '6.854 Hz', beatHz: 6.854, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ⁴ — deep Theta, vivid imagery.'},
  {id: 'fib-1', label: '13 Hz', beatHz: 13, group: 'Fibonacci', isPremium: true, description: 'F₇ — SMR/Beta boundary, peak sensorimotor rhythm.'},
  {id: 'fib-2', label: '21 Hz', beatHz: 21, group: 'Fibonacci', isPremium: true, description: 'F₈ — mid-Beta, active concentration.'},
  {id: 'fib-3', label: '34 Hz', beatHz: 34, group: 'Fibonacci', isPremium: true, description: 'F₉ — Gamma entry, heightened processing.'},
  {id: 'fib-4', label: '55 Hz', beatHz: 55, group: 'Fibonacci', isPremium: true, description: 'F₁₀ — low Gamma, cross-modal binding.'},
  {id: 'sol-396', label: '396 Hz', beatHz: 396, group: 'Solfeggio', isPremium: true, description: 'UT — Liberation from fear (396 Hz).'},
  {id: 'sol-417', label: '417 Hz', beatHz: 417, group: 'Solfeggio', isPremium: true, description: 'RE — Facilitating change (417 Hz).'},
  {id: 'sol-528', label: '528 Hz', beatHz: 528, group: 'Solfeggio', isPremium: true, description: 'MI — DNA repair / transformation (528 Hz).'},
  {id: 'sol-639', label: '639 Hz', beatHz: 639, group: 'Solfeggio', isPremium: true, description: 'FA — Connection and relationships (639 Hz).'},
  {id: 'sol-741', label: '741 Hz', beatHz: 741, group: 'Solfeggio', isPremium: true, description: 'SOL — Awakening intuition (741 Hz).'},
  {id: 'sol-852', label: '852 Hz', beatHz: 852, group: 'Solfeggio', isPremium: true, description: 'LA — Returning to spiritual order (852 Hz).'},
];

const PRESET_GROUPS = [
  'Schumann Resonances',
  'Alpha Focus',
  'Golden Ratio (φ)',
  'Fibonacci',
  'Solfeggio',
] as const;

export function MathModeScreen() {
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const unlocked = isPremiumUnlocked(tier);
  const setParam = useHertzStore(s => s.setParam);
  const beatHz = useHertzStore(s => s.beatHz);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [liveFormula, setLiveFormula] = useState<ActiveFormulaDisplay | null>(null);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  const handleFormulaApplied = useCallback((payload: FormulaAppliedPayload) => {
    setActivePresetId(null);
    setLiveFormula({
      primary: payload.formula,
      secondary: payload.explanation,
      displayHz: payload.hz,
      source: payload.source,
    });
  }, []);

  const handleSelect = useCallback(
    (preset: MathPresetItem) => {
      setActivePresetId(preset.id);
      setLiveFormula(null);
      if (preset.group === 'Solfeggio') {
        setParam('carrierHz', preset.beatHz);
        setParam('beatHz', DEFAULT_BEAT_HZ);
      } else {
        setParam('beatHz', preset.beatHz);
        setParam('carrierHz', 220);
      }
    },
    [setParam],
  );

  const activePreset = useMemo(
    () => MATH_PRESETS.find(p => p.id === activePresetId) ?? null,
    [activePresetId],
  );

  const activeDisplayHz = useMemo(() => {
    if (liveFormula != null) {
      return liveFormula.displayHz;
    }
    if (!activePreset) {
      return beatHz;
    }
    if (activePreset.group === 'Solfeggio') {
      return activePreset.beatHz;
    }
    return beatHz;
  }, [liveFormula, activePreset, beatHz]);

  const activeFormula = useMemo(() => {
    if (liveFormula != null) {
      return {
        primary: liveFormula.primary,
        secondary: liveFormula.secondary,
      };
    }
    return getMathPresetFormula(activePreset);
  }, [liveFormula, activePreset]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <MathMode3DHeader />

        <ActiveTargetChip
          hz={activeDisplayHz}
          formulaPrimary={activeFormula.primary}
          formulaSecondary={activeFormula.secondary}
        />

        <Text style={styles.sectionTitle}>Math Modes</Text>

        {PRESET_GROUPS.map(group => (
          <MathModeGroupRow
            key={group}
            group={group}
            presets={MATH_PRESETS.filter(p => p.group === group)}
            activePresetId={activePresetId}
            unlocked={unlocked}
            onSelect={handleSelect}
            onUpgrade={openPaywall}
          />
        ))}

        <CustomFormulaSection
          unlocked={unlocked}
          formulaPrimary={activeFormula.primary}
          formulaSubtitle={activeFormula.secondary}
          onUpgrade={openPaywall}
          onFormulaApplied={handleFormulaApplied}
        />

        <AIFormulaSection
          unlocked={unlocked}
          onUpgrade={openPaywall}
          onFormulaApplied={handleFormulaApplied}
          foldStyle={styles.aiFold}
        />

        <ProtocolSequencesSection foldStyle={styles.aiFold} />

        <View style={styles.bottomPad} />
      </ScrollView>
      <LegalMenuBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 1,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
  },
  aiFold: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bottomPad: {
    height: 16,
  },
});
