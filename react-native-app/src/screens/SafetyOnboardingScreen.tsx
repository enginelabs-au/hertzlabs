import React, {useState} from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useHertzStore} from '../state/store';

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
 * Mandatory legal gate screen per Plan 05 §3.
 * Rendered as the sole full-screen surface until the user accepts both
 * checkboxes and taps "Acknowledge & Enter".
 * Persists acceptance via Zustand → MMKV. On acceptance the screen
 * unmounts and the normal PlayerScreen mounts.
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
        {/* Header */}
        <Text style={styles.title}>Before You Begin</Text>
        <Text style={styles.subtitle}>Please read the following carefully.</Text>

        <View style={styles.divider} />

        {/* Block 1 — Medical Disclaimer */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Medical Disclaimer</Text>
          <Text style={styles.blockBody}>
            Binaural beats and audio-frequency stimulation are intended for
            relaxation, focus, and personal wellness only. They are{' '}
            <Text style={styles.bold}>not</Text> a substitute for medical
            diagnosis, treatment, therapy, or professional medical advice. Do
            not use this app to self-treat any medical condition.
          </Text>
        </View>

        {/* Block 2 — Seizure & Photosensitivity Warning */}
        <View style={[styles.block, styles.warningBlock]}>
          <Text style={[styles.blockTitle, styles.warningTitle]}>
            {'⚠ Seizure & Photosensitivity Warning'}
          </Text>
          <Text style={styles.blockBody}>
            Audio entrainment may affect brain wave activity. Do{' '}
            <Text style={styles.bold}>not</Text> use this app if you have
            epilepsy, photosensitivity disorder, or any condition that makes you
            susceptible to seizures. If you are unsure of your sensitivity,
            consult a licensed physician before use.
          </Text>
        </View>

        {/* Block 3 — Hearing Safety */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Hearing Safety</Text>
          <Text style={styles.blockBody}>
            Use headphones or speakers at a comfortable, moderate volume.
            Prolonged exposure to high-volume audio may cause permanent hearing
            damage. Hertz Labs recommends a maximum session duration of{' '}
            <Text style={styles.bold}>60 minutes</Text> and a minimum break of{' '}
            <Text style={styles.bold}>15 minutes</Text> between sessions.
          </Text>
        </View>

        {/* Block 4 — Age Confirmation */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Age Requirement</Text>
          <Text style={styles.blockBody}>
            This app is intended for users{' '}
            <Text style={styles.bold}>13 years of age or older</Text>. If you
            are under 13, do not use this app.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Checkbox A */}
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCheckedTerms(v => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: checkedTerms}}>
          <Checkbox
            checked={checkedTerms}
            onToggle={() => setCheckedTerms(v => !v)}
          />
          <Text style={styles.checkboxLabel}>
            I have read and agree to the{' '}
            <InlineLink label="Terms of Service" url={TERMS_URL} /> and{' '}
            <InlineLink label="Privacy Policy" url={PRIVACY_URL} />.
          </Text>
        </Pressable>

        {/* Checkbox B */}
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCheckedMedical(v => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: checkedMedical}}>
          <Checkbox
            checked={checkedMedical}
            onToggle={() => setCheckedMedical(v => !v)}
          />
          <Text style={styles.checkboxLabel}>
            I understand that Hertz Labs does not provide medical advice and I
            will not use it as a substitute for professional medical care.
          </Text>
        </Pressable>

        {/* CTA */}
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
            {'Acknowledge & Enter'}
          </Text>
        </Pressable>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const ACCENT = '#4ADE80';
const WARN = '#FBBF24';
const BG = '#050810';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 20,
  },
  block: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  warningBlock: {
    borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(251,191,36,0.05)',
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  warningTitle: {
    color: WARN,
  },
  blockBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
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
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkmark: {
    fontSize: 13,
    color: '#000',
    fontWeight: '700',
    lineHeight: 15,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 21,
  },
  link: {
    color: ACCENT,
    textDecorationLine: 'underline',
  },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.2,
  },
  ctaTextDisabled: {
    color: 'rgba(255,255,255,0.25)',
  },
  bottomPad: {
    height: 20,
  },
});
