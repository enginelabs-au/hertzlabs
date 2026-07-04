import React, {useCallback} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {focusChallengePrescriptionForDay, FOCUS_CHALLENGE_TOTAL_DAYS} from '../focusChallenge/dayTemplates';
import {focusChallengeCanStartSession, FOCUS_CHALLENGE_NEXT_DAY_MESSAGE} from '../focusChallenge/eligibility';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';

export function FocusChallengeBriefingModal() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const focusChallengeCurrentDay = useHertzStore(s => s.focusChallengeCurrentDay);
  const focusChallengeStatus = useHertzStore(s => s.focusChallengeStatus);
  const focusChallengeLastCompletedDate = useHertzStore(s => s.focusChallengeLastCompletedDate);
  const beginFocusChallengeSession = useHertzStore(s => s.beginFocusChallengeSession);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const insets = useModalScrollInsets();

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const sessionGate = focusChallengeCanStartSession({
    status: focusChallengeStatus,
    lastCompletedDate: focusChallengeLastCompletedDate,
  });

  const begin = useCallback(() => {
    if (!sessionGate.ok) {
      Alert.alert('Come back tomorrow', sessionGate.message, [{text: 'OK', onPress: dismiss}]);
      return;
    }
    beginFocusChallengeSession();
    requestPlay();
    setActiveModal(null);
  }, [beginFocusChallengeSession, dismiss, requestPlay, sessionGate, setActiveModal]);

  const prescription = focusChallengePrescriptionForDay(focusChallengeCurrentDay);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss briefing" />
      <View style={[styles.sheet, {paddingBottom: insets.paddingBottom}]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>
            Day {focusChallengeCurrentDay} of {FOCUS_CHALLENGE_TOTAL_DAYS}
          </Text>
          <Text style={styles.title}>{prescription.title}</Text>
          <Text style={styles.body}>{prescription.body}</Text>
          <View style={styles.bullets}>
            <Text style={styles.bullet}>• {prescription.beatHz} Hz binaural beat</Text>
            <Text style={styles.bullet}>• {prescription.breathPatternId} breathing</Text>
            <Text style={styles.bullet}>• ~{prescription.durationMin} minutes of playback</Text>
          </View>
          <Text style={styles.disclaimer}>
            Reflection questions are for your own wellness tracking — not medical advice.
          </Text>
          {!sessionGate.ok ? (
            <Text style={styles.waitHint}>{FOCUS_CHALLENGE_NEXT_DAY_MESSAGE}</Text>
          ) : null}
          <Pressable
            style={[styles.primaryBtn, !sessionGate.ok && styles.primaryBtnDisabled]}
            onPress={begin}
            disabled={!sessionGate.ok}>
            <Text style={styles.primaryBtnText}>
              {sessionGate.ok ? 'Begin challenge' : 'Available tomorrow'}
            </Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={dismiss}>
            <Text style={styles.linkBtnText}>Not now</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)'},
  sheet: {
    backgroundColor: HertzTheme.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  scroll: {padding: 20, gap: 10},
  kicker: {fontSize: 12, color: HertzTheme.neon.cyan, fontWeight: '600', letterSpacing: 0.5},
  title: {fontSize: 20, fontWeight: '700', color: HertzTheme.text.primary},
  body: {fontSize: 14, lineHeight: 20, color: HertzTheme.text.secondary},
  bullets: {gap: 4, marginTop: 4},
  bullet: {fontSize: 13, color: HertzTheme.text.secondary},
  disclaimer: {fontSize: 11, color: HertzTheme.text.muted, marginTop: 8},
  waitHint: {fontSize: 12, color: HertzTheme.neon.cyan, marginTop: 8, lineHeight: 17},
  primaryBtn: {
    backgroundColor: HertzTheme.neon.cyan,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: {fontWeight: '700', color: '#000'},
  primaryBtnDisabled: {opacity: 0.45},
  linkBtn: {paddingVertical: 10, alignItems: 'center'},
  linkBtnText: {color: HertzTheme.text.muted, fontSize: 13},
});
