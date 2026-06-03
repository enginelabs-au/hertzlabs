import React, {useState, useCallback} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {BRAINWAVE_BANDS} from '../components/ReadoutPanel/brainwaveBands';
import {MathMode3DHeader} from '../components/math/MathMode3DHeader';
import {CommandLineCard} from '../components/layout/CommandLineCard';
import {MathModeGroupRow, type MathPresetItem} from '../components/math/MathModeGroupRow';
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

function getBandColor(hz: number): string {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band.hexColor;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1].hexColor;
}

function getBandLabel(hz: number): string {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band.label;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1].label;
}

function PremiumFormulaCard({unlocked}: {unlocked: boolean}) {
  const [formula, setFormula] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const setParam = useHertzStore(s => s.setParam);

  const evaluateFormula = useCallback(() => {
    try {
      const cleanFormula = formula
        .replace(/\|([^|]+)\|/g, (_, expr) => `Math.abs(${expr})`)
        .replace(/f_beat\s*=\s*/i, '')
        .replace(/f_L\s*=\s*/i, '')
        .replace(/f_R\s*=\s*/i, '');
      const val = new Function(`return (${cleanFormula})`)() as number;
      if (typeof val === 'number' && isFinite(val) && val > 0) {
        const hz = Math.abs(val);
        setResult(`→ ${hz.toFixed(4)} Hz (${getBandLabel(hz)})`);
        setParam('beatHz', hz);
      } else {
        setResult('⚠ Result must be a positive number.');
      }
    } catch {
      setResult('⚠ Invalid expression. Try: |440 - 432| or 7.83 * 2');
    }
  }, [formula, setParam]);

  if (!unlocked) {
    return null;
  }

  return (
    <View style={styles.formulaCard}>
      <TextInput
        style={styles.mathInput}
        value={formula}
        onChangeText={setFormula}
        placeholder="Custom formula…"
        placeholderTextColor={HertzTheme.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={evaluateFormula}
      />
      <Pressable style={styles.evalBtn} onPress={evaluateFormula}>
        <Text style={styles.evalBtnText}>Apply →</Text>
      </Pressable>
      {result != null && (
        <Text style={[styles.evalResult, result.startsWith('⚠') && styles.evalWarn]}>{result}</Text>
      )}
    </View>
  );
}

export function MathModeScreen() {
  const tier = useHertzStore(s => s.tier);
  const unlocked = isPremiumUnlocked(tier);
  const setParam = useHertzStore(s => s.setParam);
  const beatHz = useHertzStore(s => s.beatHz);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (preset: MathPresetItem) => {
      setActivePresetId(preset.id);
      setParam('beatHz', preset.beatHz);
      setParam('carrierHz', 220);
    },
    [setParam],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <MathMode3DHeader />
      <CommandLineCard />

      <View style={styles.activeChip}>
        <Text style={styles.activeLabel}>ACTIVE TARGET Δ</Text>
        <Text style={[styles.activeHz, {color: getBandColor(beatHz)}]}>{beatHz.toFixed(2)} Hz</Text>
      </View>

      <PremiumFormulaCard unlocked={unlocked} />

      <Text style={styles.sectionTitle}>Math Modes</Text>

      {PRESET_GROUPS.map(group => (
        <MathModeGroupRow
          key={group}
          group={group}
          presets={MATH_PRESETS.filter(p => p.group === group)}
          activePresetId={activePresetId}
          unlocked={unlocked}
          onSelect={handleSelect}
        />
      ))}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  activeChip: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
    alignItems: 'center',
  },
  activeLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
    letterSpacing: 1,
  },
  activeHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
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
  formulaCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
  },
  mathInput: {
    fontFamily: HertzTheme.mono,
    fontSize: 14,
    color: HertzTheme.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: HertzTheme.glassBorder,
    paddingVertical: 8,
    marginBottom: 10,
  },
  evalBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(92,225,255,0.15)',
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
  },
  evalBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
  },
  evalResult: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    color: HertzTheme.neon.cyan,
    marginTop: 10,
  },
  evalWarn: {
    color: HertzTheme.neon.amber,
  },
  bottomPad: {
    height: 16,
  },
});
