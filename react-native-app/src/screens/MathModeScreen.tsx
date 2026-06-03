import React, {useState, useCallback} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {BRAINWAVE_BANDS} from '../components/ReadoutPanel/brainwaveBands';

const BG = '#000000';
const CARD = 'rgba(255,255,255,0.04)';
const CARD_ACTIVE = 'rgba(74,222,128,0.08)';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_ACTIVE = 'rgba(74,222,128,0.35)';
const ACCENT = '#4ADE80';
const WARN = '#FBBF24';
const MUTED = 'rgba(255,255,255,0.38)';
const LOCK_COLOR = 'rgba(251,191,36,0.7)';
const MONO = 'JetBrainsMono-Regular';

type MathPreset = {
  id: string;
  label: string;
  beatHz: number;
  carrierHz: number;
  group: string;
  isPremium: boolean;
  description: string;
};

const MATH_PRESETS: MathPreset[] = [
  // Schumann Resonances
  {id: 'schumann-1', label: '7.83 Hz', beatHz: 7.83, carrierHz: 220, group: 'Schumann Resonances', isPremium: false, description: 'Primary Schumann resonance — Earth\'s electromagnetic heartbeat.'},
  {id: 'schumann-2', label: '14.3 Hz', beatHz: 14.3, carrierHz: 220, group: 'Schumann Resonances', isPremium: true, description: '2nd Schumann harmonic — heightened alertness.'},
  {id: 'schumann-3', label: '20.8 Hz', beatHz: 20.8, carrierHz: 220, group: 'Schumann Resonances', isPremium: true, description: '3rd Schumann harmonic — mid-Beta focus range.'},
  {id: 'schumann-4', label: '27.3 Hz', beatHz: 27.3, carrierHz: 220, group: 'Schumann Resonances', isPremium: true, description: '4th Schumann harmonic — high-Beta arousal.'},

  // Alpha Focus (free)
  {id: 'alpha-focus', label: '10.0 Hz', beatHz: 10.0, carrierHz: 220, group: 'Alpha Focus', isPremium: false, description: 'Pure Alpha peak — relaxed, open focus.'},

  // Golden Ratio
  {id: 'phi-1', label: '1.618 Hz', beatHz: 1.618, carrierHz: 200, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ¹ — deep Delta resonance at the golden ratio.'},
  {id: 'phi-2', label: '2.618 Hz', beatHz: 2.618, carrierHz: 200, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ² — Delta boundary, deep restorative.'},
  {id: 'phi-3', label: '4.236 Hz', beatHz: 4.236, carrierHz: 200, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ³ — Theta entry, meditation onset.'},
  {id: 'phi-4', label: '6.854 Hz', beatHz: 6.854, carrierHz: 200, group: 'Golden Ratio (φ)', isPremium: true, description: 'φ⁴ — deep Theta, vivid imagery.'},

  // Fibonacci
  {id: 'fib-1', label: '13 Hz', beatHz: 13, carrierHz: 220, group: 'Fibonacci', isPremium: true, description: 'F₇ — SMR/Beta boundary, peak sensorimotor rhythm.'},
  {id: 'fib-2', label: '21 Hz', beatHz: 21, carrierHz: 220, group: 'Fibonacci', isPremium: true, description: 'F₈ — mid-Beta, active concentration.'},
  {id: 'fib-3', label: '34 Hz', beatHz: 34, carrierHz: 220, group: 'Fibonacci', isPremium: true, description: 'F₉ — Gamma entry, heightened processing.'},
  {id: 'fib-4', label: '55 Hz', beatHz: 55, carrierHz: 220, group: 'Fibonacci', isPremium: true, description: 'F₁₀ — low Gamma, cross-modal binding.'},

  // Solfeggio (high frequency — premium only)
  {id: 'sol-396', label: '396 Hz', beatHz: 396, carrierHz: 432, group: 'Solfeggio', isPremium: true, description: 'UT — Liberation from fear (396 Hz).'},
  {id: 'sol-417', label: '417 Hz', beatHz: 417, carrierHz: 432, group: 'Solfeggio', isPremium: true, description: 'RE — Facilitating change (417 Hz).'},
  {id: 'sol-528', label: '528 Hz', beatHz: 528, carrierHz: 432, group: 'Solfeggio', isPremium: true, description: 'MI — DNA repair / transformation (528 Hz).'},
  {id: 'sol-639', label: '639 Hz', beatHz: 639, carrierHz: 432, group: 'Solfeggio', isPremium: true, description: 'FA — Connection and relationships (639 Hz).'},
  {id: 'sol-741', label: '741 Hz', beatHz: 741, carrierHz: 432, group: 'Solfeggio', isPremium: true, description: 'SOL — Awakening intuition (741 Hz).'},
  {id: 'sol-852', label: '852 Hz', beatHz: 852, carrierHz: 432, group: 'Solfeggio', isPremium: true, description: 'LA — Returning to spiritual order (852 Hz).'},
];

const PRESET_GROUPS = [
  'Schumann Resonances',
  'Alpha Focus',
  'Golden Ratio (φ)',
  'Fibonacci',
  'Solfeggio',
];

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

function SafetyBanner({onDismiss}: {onDismiss: () => void}) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerIcon}>⚠</Text>
      <View style={styles.bannerBody}>
        <Text style={styles.bannerText}>
          Pure sine waves carry intense acoustic energy. Keep your physical device volume
          low (ideally under 50%) to ensure safe, sustainable entrainment exposure.
        </Text>
        <Pressable onPress={onDismiss} style={styles.bannerDismiss}>
          <Text style={styles.bannerDismissText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface PresetCardProps {
  preset: MathPreset;
  isActive: boolean;
  isLocked: boolean;
  onSelect: () => void;
}

function PresetCard({preset, isActive, isLocked, onSelect}: PresetCardProps) {
  const bandColor = getBandColor(preset.beatHz);
  const bandLabel = getBandLabel(preset.beatHz);

  return (
    <Pressable
      style={[
        styles.presetCard,
        isActive && styles.presetCardActive,
        isLocked && styles.presetCardLocked,
      ]}
      onPress={!isLocked ? onSelect : undefined}
      accessibilityRole="button"
      accessibilityState={{selected: isActive, disabled: isLocked}}>
      <View style={styles.presetCardRow}>
        <View style={styles.presetCardLeft}>
          <Text style={[styles.presetHz, {color: isLocked ? MUTED : bandColor}]}>
            {preset.label}
          </Text>
          <Text style={[styles.presetDesc, isLocked && styles.textMuted]}>
            {preset.description}
          </Text>
        </View>
        <View style={styles.presetCardRight}>
          {isLocked ? (
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>PRO</Text>
            </View>
          ) : (
            <View style={[styles.bandPill, {borderColor: bandColor + '60', backgroundColor: bandColor + '18'}]}>
              <Text style={[styles.bandPillText, {color: bandColor}]}>{bandLabel}</Text>
            </View>
          )}
          {isActive && <View style={styles.activeDot} />}
        </View>
      </View>
    </Pressable>
  );
}

function PremiumMathMode({unlocked}: {unlocked: boolean}) {
  const [formula, setFormula] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const applyPreset = useHertzStore(s => s.applyPreset);
  const setParam = useHertzStore(s => s.setParam);

  const evaluateFormula = useCallback(() => {
    try {
      // Simple evaluator for numeric expressions and assignments
      // e.g. "f_beat = |440 - 432|" or "7.83 * 2"
      const cleanFormula = formula
        .replace(/\|([^|]+)\|/g, (_, expr) => `Math.abs(${expr})`)
        .replace(/f_beat\s*=\s*/i, '')
        .replace(/f_L\s*=\s*/i, '')
        .replace(/f_R\s*=\s*/i, '');

      // eslint-disable-next-line no-new-func
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
    return (
      <View style={styles.premiumLockCard}>
        <Text style={styles.premiumLockIcon}>🔒</Text>
        <Text style={styles.premiumLockTitle}>Premium Math Mode</Text>
        <Text style={styles.premiumLockDesc}>
          Enter any algebraic formula to compute custom entrainment frequencies.
          {'\n\n'}
          Examples: {' '}
          <Text style={styles.monoText}>|f_L - f_R|</Text>, {' '}
          <Text style={styles.monoText}>7.83 * 1.618</Text>
        </Text>
        <View style={styles.upgradeBtn}>
          <Text style={styles.upgradeBtnText}>Upgrade to Unlock</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mathInputCard}>
      <Text style={styles.mathInputLabel}>Formula Evaluator</Text>
      <Text style={styles.mathInputHint}>
        {'e.g.  f_beat = |f_L - f_R|  →  |440 - 432|  →  8 Hz (Alpha)'}
      </Text>
      <TextInput
        style={styles.mathInput}
        value={formula}
        onChangeText={setFormula}
        placeholder="e.g. 7.83 * 1.618"
        placeholderTextColor={MUTED}
        keyboardType="default"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={evaluateFormula}
      />
      <Pressable style={styles.evalBtn} onPress={evaluateFormula}>
        <Text style={styles.evalBtnText}>Apply Formula →</Text>
      </Pressable>
      {result != null && (
        <Text style={[styles.evalResult, result.startsWith('⚠') ? styles.evalResultWarn : styles.evalResultOk]}>
          {result}
        </Text>
      )}
    </View>
  );
}

export function MathModeScreen() {
  const tier = useHertzStore(s => s.tier);
  const unlocked = isPremiumUnlocked(tier);
  const setParam = useHertzStore(s => s.setParam);
  const beatHz = useHertzStore(s => s.beatHz);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const handleSelect = useCallback((preset: MathPreset) => {
    setActivePresetId(preset.id);
    setParam('beatHz', preset.beatHz);
    setParam('carrierHz', preset.carrierHz);
  }, [setParam]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Math Mode</Text>
        <Text style={styles.headerSubtitle}>
          Mathematically-derived entrainment frequencies
        </Text>
      </View>

      {/* Safety Banner (first-time) */}
      {!bannerDismissed && (
        <SafetyBanner onDismiss={() => setBannerDismissed(true)} />
      )}

      {/* Current frequency display */}
      <View style={styles.currentFreqCard}>
        <Text style={styles.currentFreqLabel}>ACTIVE TARGET Δ</Text>
        <Text style={[styles.currentFreqValue, {color: getBandColor(beatHz)}]}>
          {beatHz.toFixed(3)} Hz
        </Text>
        <Text style={[styles.currentFreqBand, {color: getBandColor(beatHz)}]}>
          {getBandLabel(beatHz)}
        </Text>
      </View>

      {/* Premium Math Mode evaluator */}
      <PremiumMathMode unlocked={unlocked} />

      {/* Preset groups */}
      {PRESET_GROUPS.map(group => {
        const presets = MATH_PRESETS.filter(p => p.group === group);
        return (
          <View key={group} style={styles.group}>
            <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
            {presets.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isActive={activePresetId === preset.id}
                isLocked={preset.isPremium && !unlocked}
                onSelect={() => handleSelect(preset)}
              />
            ))}
          </View>
        );
      })}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: MUTED,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  bannerIcon: {
    fontSize: 18,
    color: WARN,
    paddingTop: 1,
  },
  bannerBody: {
    flex: 1,
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 19,
  },
  bannerDismiss: {
    alignSelf: 'flex-start',
  },
  bannerDismissText: {
    fontSize: 12,
    color: WARN,
    fontWeight: '600',
  },
  currentFreqCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  currentFreqLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.5,
  },
  currentFreqValue: {
    fontFamily: MONO,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  currentFreqBand: {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 1,
    opacity: 0.7,
  },
  mathInputCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 10,
  },
  mathInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mathInputHint: {
    fontSize: 11,
    color: MUTED,
    fontFamily: MONO,
    lineHeight: 16,
  },
  mathInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    color: '#FFFFFF',
    fontFamily: MONO,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  evalBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  evalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  evalResult: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 18,
  },
  evalResultOk: {
    color: ACCENT,
  },
  evalResultWarn: {
    color: WARN,
  },
  premiumLockCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  premiumLockIcon: {
    fontSize: 28,
  },
  premiumLockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  premiumLockDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 19,
  },
  monoText: {
    fontFamily: MONO,
    fontSize: 12,
    color: ACCENT,
  },
  upgradeBtn: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: LOCK_COLOR,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: WARN,
  },
  group: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.5,
    marginBottom: 2,
    paddingLeft: 2,
  },
  presetCard: {
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  presetCardActive: {
    backgroundColor: CARD_ACTIVE,
    borderColor: BORDER_ACTIVE,
  },
  presetCardLocked: {
    opacity: 0.5,
  },
  presetCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presetCardLeft: {
    flex: 1,
    gap: 3,
  },
  presetCardRight: {
    gap: 4,
    alignItems: 'flex-end',
  },
  presetHz: {
    fontFamily: MONO,
    fontSize: 17,
    fontWeight: '700',
  },
  presetDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 16,
  },
  textMuted: {
    color: MUTED,
  },
  bandPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  bandPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
    alignSelf: 'center',
  },
  lockBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: LOCK_COLOR,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: LOCK_COLOR,
    letterSpacing: 1,
  },
  bottomPad: {
    height: 20,
  },
});
