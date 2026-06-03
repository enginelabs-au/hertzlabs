import React, {useCallback, useEffect, useState} from 'react';
import {
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useHertzStore} from '../../state/store';

const ACCENT = '#6f6af8';
const BG = '#0a0a0f';
const TEXT_PRIMARY = '#e8e8f0';
const TEXT_SECONDARY = '#a0a0b8';
const DISABLED_BG = '#2a2a3a';
const DISABLED_TEXT = '#5a5a7a';
const BORDER = '#2a2a3a';

export function SafetyOnboardingScreen(): React.JSX.Element {
  const setHasAcceptedSafetyTerms = useHertzStore(
    s => s.setHasAcceptedSafetyTerms,
  );

  const [checkedTerms, setCheckedTerms] = useState(false);
  const [checkedMedical, setCheckedMedical] = useState(false);

  const canContinue = checkedTerms && checkedMedical;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const openTerms = useCallback(() => {
    Linking.openURL('https://hertzlabs.app/terms');
  }, []);

  const openPrivacy = useCallback(() => {
    Linking.openURL('https://hertzlabs.app/privacy');
  }, []);

  const handleContinue = useCallback(() => {
    if (canContinue) {
      setHasAcceptedSafetyTerms(true);
    }
  }, [canContinue, setHasAcceptedSafetyTerms]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Before You Begin</Text>
          <Text style={styles.subtitle}>
            Please read the following carefully.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Medical Disclaimer</Text>
          <Text style={styles.bodyText}>
            Binaural beats and audio-frequency stimulation are intended for
            relaxation, focus, and personal wellness only. They are{' '}
            <Text style={styles.bold}>
              not a substitute for medical diagnosis, treatment, therapy, or
              professional medical advice.
            </Text>{' '}
            Do not use this app to self-treat any medical condition.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            Seizure &amp; Photosensitivity Warning
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>Warning:</Text> Audio entrainment may
            affect brain wave activity. Do{' '}
            <Text style={styles.bold}>not</Text> use this app if you have
            epilepsy, photosensitivity disorder, or any condition that makes
            you susceptible to seizures. If you are unsure of your sensitivity,
            consult a licensed physician before use.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Hearing Safety</Text>
          <Text style={styles.bodyText}>
            Use headphones or speakers at a comfortable, moderate volume.
            Prolonged exposure to high-volume audio may cause permanent hearing
            damage. Hertz Labs recommends a maximum session duration of{' '}
            <Text style={styles.bold}>60 minutes</Text> and a minimum break of{' '}
            <Text style={styles.bold}>15 minutes</Text> between sessions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Age Confirmation</Text>
          <Text style={styles.bodyText}>
            This app is intended for users{' '}
            <Text style={styles.bold}>13 years of age or older.</Text> If you
            are under 13, do not use this app.
          </Text>
        </View>

        <View style={styles.divider} />

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCheckedTerms(v => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: checkedTerms}}>
          <View
            style={[styles.checkbox, checkedTerms && styles.checkboxChecked]}>
            {checkedTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and agree to the{' '}
            <Text
              style={styles.link}
              onPress={e => {
                e.stopPropagation?.();
                openTerms();
              }}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={styles.link}
              onPress={e => {
                e.stopPropagation?.();
                openPrivacy();
              }}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Pressable>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setCheckedMedical(v => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{checked: checkedMedical}}>
          <View
            style={[
              styles.checkbox,
              checkedMedical && styles.checkboxChecked,
            ]}>
            {checkedMedical && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand that Hertz Labs does not provide medical advice and I
            will not use it as a substitute for professional medical care.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityState={{disabled: !canContinue}}>
          <Text
            style={[
              styles.ctaButtonText,
              !canContinue && styles.ctaButtonTextDisabled,
            ]}>
            I Understand — Continue
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: BORDER,
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
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 22,
  },
  link: {
    color: ACCENT,
    textDecorationLine: 'underline',
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: DISABLED_BG,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  ctaButtonTextDisabled: {
    color: DISABLED_TEXT,
  },
});
