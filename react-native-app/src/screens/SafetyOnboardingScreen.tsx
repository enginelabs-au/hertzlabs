import React, {useCallback, useState} from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInRight, FadeOutLeft} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {OnboardingBackgroundWaves} from '../components/layout/OnboardingBackgroundWaves';
import {ScreenWaveHeader} from '../components/layout/ScreenWaveHeader';
import {PRIVACY_URL, TERMS_URL} from '../constants/legalUrls';
import {useHertzStore} from '../state/store';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {useLayoutProfile} from '../platform/layoutProfile';
import {HertzTheme} from '../theme/hertzTheme';

const STEP_COUNT = 3;
const STEP_BEAT_HZ = [8, 10, 12] as const;

const STEP_TITLES = [
  'Medical & Liability',
  'Hearing Safety',
  'Frequency Bands',
] as const;

function Checkbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.checkboxBox, checked && styles.checkboxChecked]}
      accessibilityRole="checkbox"
      accessibilityState={{checked}}>
      {checked && <Text style={styles.checkmark}>✓</Text>}
    </Pressable>
  );
}

function InlineLink({label, url}: {label: string; url: string}) {
  return (
    <Text
      style={styles.link}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link">
      {label}
    </Text>
  );
}

function StepDots({step}: {step: number}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({length: STEP_COUNT}, (_, i) => (
        <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
      ))}
    </View>
  );
}

function Step1Medical() {
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Medical Disclaimer</Text>
        <Text style={styles.blockBody}>
          Binaural beats and audio-frequency stimulation are intended for relaxation, focus,
          and personal wellness only. They are <Text style={styles.bold}>not</Text> a substitute
          for medical diagnosis, treatment, therapy, or professional medical advice. Do not use
          this app to self-treat any medical condition.
        </Text>
      </View>

      <View style={[styles.block, styles.warningBlock]}>
        <Text style={[styles.blockTitle, styles.warningTitle]}>
          ⚠ Seizure & Photosensitivity Warning
        </Text>
        <Text style={styles.blockBody}>
          Audio entrainment may affect brain wave activity. Do{' '}
          <Text style={styles.bold}>not</Text> use this app if you have epilepsy,
          photosensitivity disorder, or any condition that makes you susceptible to seizures.
          If you are unsure of your sensitivity, consult a licensed physician before use.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Age Requirement</Text>
        <Text style={styles.blockBody}>
          This app is intended for users{' '}
          <Text style={styles.bold}>13 years of age or older</Text>. If you are under 13, do not
          use this app.
        </Text>
      </View>
    </>
  );
}

function Step2Hearing() {
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Hearing Safety</Text>
        <Text style={styles.blockBody}>
          Use headphones or speakers at a comfortable, moderate volume. Prolonged exposure to
          high-volume audio may cause permanent hearing damage.
        </Text>
      </View>

      <View style={[styles.block, styles.highlightBlock]}>
        <Text style={[styles.blockTitle, styles.highlightTitle]}>Session Limits</Text>
        <Text style={styles.blockBody}>
          Hertz Labs recommends a maximum session duration of{' '}
          <Text style={styles.bold}>60 minutes</Text>, followed by a minimum break of{' '}
          <Text style={styles.bold}>15 minutes</Text> before starting another session.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockBody}>
          If you experience ringing, discomfort, or dizziness, stop playback immediately and lower
          your device volume before resuming.
        </Text>
      </View>
    </>
  );
}

function Step3Frequency() {
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Frequency Band Labels</Text>
        <Text style={styles.blockBody}>
          Band names follow common EEG terminology where it is scientifically established —{' '}
          <Text style={styles.bold}>delta, theta, alpha, beta, gamma,</Text> and{' '}
          <Text style={styles.bold}>high-gamma</Text>.
        </Text>
      </View>

      <View style={[styles.block, styles.warningBlock]}>
        <Text style={[styles.blockTitle, styles.warningTitle]}>Experimental Ranges</Text>
        <Text style={styles.blockBody}>
          Labels beyond high-gamma (very high-gamma, supra-gamma, omega) and beat rates above
          roughly <Text style={styles.bold}>100 Hz</Text> describe{' '}
          <Text style={styles.bold}>experimental</Text> audio modulation ranges, not standard
          clinical EEG classifications.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockBody}>
          These ranges are provided for personal wellness and exploration only. Entrainment effects
          at higher rates are not well established in peer-reviewed research.
        </Text>
      </View>
    </>
  );
}

function AcceptanceSection({
  checkedTerms,
  checkedMedical,
  ctaEnabled,
  onToggleTerms,
  onToggleMedical,
  onAccept,
}: {
  checkedTerms: boolean;
  checkedMedical: boolean;
  ctaEnabled: boolean;
  onToggleTerms: () => void;
  onToggleMedical: () => void;
  onAccept: () => void;
}) {
  return (
    <View style={styles.acceptanceSection}>
      <Pressable
        style={styles.checkboxRow}
        onPress={onToggleTerms}
        accessibilityRole="checkbox"
        accessibilityState={{checked: checkedTerms}}>
        <Checkbox checked={checkedTerms} onToggle={onToggleTerms} />
        <Text style={styles.checkboxLabel}>
          I have read and agree to the <InlineLink label="Terms of Service" url={TERMS_URL} /> and{' '}
          <InlineLink label="Privacy Policy" url={PRIVACY_URL} />.
        </Text>
      </Pressable>

      <Pressable
        style={styles.checkboxRow}
        onPress={onToggleMedical}
        accessibilityRole="checkbox"
        accessibilityState={{checked: checkedMedical}}>
        <Checkbox checked={checkedMedical} onToggle={onToggleMedical} />
        <Text style={styles.checkboxLabel}>
          I understand that Hertz Labs does not provide medical advice and I will not use it as a
          substitute for professional medical care.
        </Text>
      </Pressable>

      <Pressable
        style={[styles.cta, !ctaEnabled && styles.ctaDisabled]}
        onPress={() => {
          if (ctaEnabled) {
            onAccept();
          }
        }}
        disabled={!ctaEnabled}
        accessibilityRole="button"
        accessibilityState={{disabled: !ctaEnabled}}
        accessibilityLabel="Acknowledge safety terms and enter the app">
        <Text style={[styles.ctaText, !ctaEnabled && styles.ctaTextDisabled]}>
          Acknowledge & Enter
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Mandatory legal gate — 3-step wizard with pinned animated wave header.
 */
export function SafetyOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {isMacDesktop} = useLayoutProfile();
  const [step, setStep] = useState(0);
  const [checkedTerms, setCheckedTerms] = useState(false);
  const [checkedMedical, setCheckedMedical] = useState(false);
  const setHasAccepted = useHertzStore(s => s.setHasAcceptedSafetyTerms);

  const ctaEnabled = checkedTerms && checkedMedical;
  const beatHz = STEP_BEAT_HZ[Math.min(step, STEP_BEAT_HZ.length - 1)] ?? 10;
  const isFinalStep = step === STEP_COUNT - 1;
  const bottomInset = Math.max(insets.bottom, 8);

  const goNext = useCallback(() => {
    setStep(s => Math.min(s + 1, STEP_COUNT - 1));
  }, []);

  const renderStepContent = () => {
    if (step === 0) {
      return <Step1Medical />;
    }
    if (step === 1) {
      return <Step2Hearing />;
    }
    return <Step3Frequency />;
  };

  return (
    <View style={styles.root}>
      <OnboardingBackgroundWaves step={step} />

      <View style={styles.headerPinned}>
        <ScreenWaveHeader height={72} beatHz={beatHz} />
        <Text style={styles.brand}>Hertz Labs</Text>
        <Text style={styles.title}>Before You Begin</Text>
        <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
        <StepDots step={step} />
        <Text style={styles.stepMeta}>
          Step {step + 1} of {STEP_COUNT}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isFinalStep && styles.scrollContentFinal,
          isMacDesktop && styles.scrollContentMac,
        ]}
        showsVerticalScrollIndicator={isFinalStep}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled>
        <Animated.View
          key={step}
          entering={FadeInRight.duration(280)}
          exiting={FadeOutLeft.duration(220)}
          style={styles.stepPanel}>
          {renderStepContent()}
        </Animated.View>

        {isFinalStep && (
          <AcceptanceSection
            checkedTerms={checkedTerms}
            checkedMedical={checkedMedical}
            ctaEnabled={ctaEnabled}
            onToggleTerms={() => setCheckedTerms(v => !v)}
            onToggleMedical={() => setCheckedMedical(v => !v)}
            onAccept={() => setHasAccepted(true)}
          />
        )}

        <View style={styles.legalFooter}>
          <LegalMenuBar showLayoutToggle={false} />
        </View>
      </ScrollView>

      {!isFinalStep && (
        <View style={[styles.footer, {paddingBottom: bottomInset}]}>
          <Pressable
            style={styles.nextBtn}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={`Next: ${STEP_TITLES[step + 1]}`}>
            <Text style={styles.nextBtnText}>Next</Text>
            <Text style={styles.nextBtnHint}>→ {STEP_TITLES[step + 1]}</Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  headerPinned: {
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 2,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scrollContentFinal: {
    paddingBottom: 24,
  },
  scrollContentMac: {
    flexGrow: 1,
    paddingHorizontal: 32,
  },
  legalFooter: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
  },
  acceptanceSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
  },
  stepPanel: {
    gap: 12,
  },
  brand: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: HertzTheme.neon.cyan,
    textAlign: 'center',
    marginBottom: 10,
  },
  stepMeta: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  dotActive: {
    backgroundColor: HertzTheme.neon.cyan,
    borderColor: HertzTheme.neon.cyan,
    transform: [{scale: 1.15}],
  },
  dotDone: {
    backgroundColor: 'rgba(92,225,255,0.35)',
    borderColor: 'rgba(92,225,255,0.5)',
  },
  block: {
    backgroundColor: HertzTheme.glassFill,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  warningBlock: {
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  highlightBlock: {
    borderColor: 'rgba(92,225,255,0.35)',
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  blockTitle: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  warningTitle: {
    color: HertzTheme.neon.amber,
  },
  highlightTitle: {
    color: HertzTheme.neon.cyan,
  },
  blockBody: {
    fontSize: 14,
    color: HertzTheme.text.secondary,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(15,14,23,0.94)',
    zIndex: 2,
  },
  nextBtn: {
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.12)',
  },
  nextBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 14,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 1.5,
  },
  nextBtnHint: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkboxChecked: {
    backgroundColor: HertzTheme.neon.cyan,
    borderColor: HertzTheme.neon.cyan,
  },
  checkmark: {
    fontSize: 13,
    color: HertzTheme.bg,
    fontWeight: '700',
    lineHeight: 15,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: HertzTheme.text.secondary,
    lineHeight: 21,
  },
  link: {
    color: HertzTheme.neon.cyan,
    textDecorationLine: 'underline',
  },
  cta: {
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: HertzTheme.neon.lime,
    backgroundColor: 'rgba(190,246,100,0.15)',
  },
  ctaDisabled: {
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ctaText: {
    fontFamily: HertzTheme.mono,
    fontSize: 14,
    fontWeight: '700',
    color: HertzTheme.neon.lime,
    letterSpacing: 1.5,
  },
  ctaTextDisabled: {
    color: HertzTheme.text.muted,
  },
});
