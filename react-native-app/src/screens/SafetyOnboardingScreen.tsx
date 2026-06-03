import React, {useState} from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {StaticWelcomeWaveHeader} from '../components/layout/StaticWelcomeWaveHeader';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const TERMS_URL = 'https://hertzlabs.app/terms';
const PRIVACY_URL = 'https://hertzlabs.app/privacy';

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

/**
 * Mandatory legal gate — themed to match Engines / Math / Background tabs.
 */
export function SafetyOnboardingScreen() {
  const [checkedTerms, setCheckedTerms] = useState(false);
  const [checkedMedical, setCheckedMedical] = useState(false);
  const setHasAccepted = useHertzStore(s => s.setHasAcceptedSafetyTerms);

  const ctaEnabled = checkedTerms && checkedMedical;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <StaticWelcomeWaveHeader height={72} />

        <Text style={styles.brand}>Hertz Labs</Text>
        <Text style={styles.title}>Before You Begin</Text>
        <Text style={styles.subtitle}>Please read the following carefully.</Text>

        <View style={styles.divider} />

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
          <Text style={styles.blockTitle}>Hearing Safety</Text>
          <Text style={styles.blockBody}>
            Use headphones or speakers at a comfortable, moderate volume. Prolonged exposure to
            high-volume audio may cause permanent hearing damage. Hertz Labs recommends a maximum
            session duration of <Text style={styles.bold}>60 minutes</Text> and a minimum break of{' '}
            <Text style={styles.bold}>15 minutes</Text> between sessions.
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

        <View style={styles.divider} />

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCheckedTerms(v => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: checkedTerms}}>
          <Checkbox checked={checkedTerms} onToggle={() => setCheckedTerms(v => !v)} />
          <Text style={styles.checkboxLabel}>
            I have read and agree to the <InlineLink label="Terms of Service" url={TERMS_URL} />{' '}
            and <InlineLink label="Privacy Policy" url={PRIVACY_URL} />.
          </Text>
        </Pressable>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCheckedMedical(v => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: checkedMedical}}>
          <Checkbox checked={checkedMedical} onToggle={() => setCheckedMedical(v => !v)} />
          <Text style={styles.checkboxLabel}>
            I understand that Hertz Labs does not provide medical advice and I will not use it as
            a substitute for professional medical care.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.cta, !ctaEnabled && styles.ctaDisabled]}
          onPress={() => {
            if (ctaEnabled) {
              setHasAccepted(true);
            }
          }}
          disabled={!ctaEnabled}
          accessibilityRole="button"
          accessibilityState={{disabled: !ctaEnabled}}>
          <Text style={[styles.ctaText, !ctaEnabled && styles.ctaTextDisabled]}>
            Acknowledge & Enter
          </Text>
        </Pressable>

        <View style={styles.bottomPad} />
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
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
    fontSize: 28,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: HertzTheme.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: HertzTheme.glassBorder,
    marginVertical: 20,
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
  blockBody: {
    fontSize: 14,
    color: HertzTheme.text.secondary,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
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
    marginTop: 8,
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
  bottomPad: {
    height: 20,
  },
});
