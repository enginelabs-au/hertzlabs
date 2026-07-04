import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {claimPromoReward} from '../promos/claimPromoReward';
import {completeFocusChallengeDayRemote, syncFocusChallengeStart} from '../promos/focusChallengeSync';
import {showStoreOfferAlert} from '../promos/showStoreOfferAlert';
import {FOCUS_CHALLENGE_MIN_PLAY_SEC, FOCUS_CHALLENGE_TOTAL_DAYS} from '../focusChallenge/dayTemplates';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';

function LikertRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.questionLabel}>{label}</Text>
      <View style={styles.scoreRow}>
        {[1, 2, 3, 4, 5].map(n => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              style={[styles.scoreBtn, active && styles.scoreBtnActive]}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityState={{selected: active}}>
              <Text style={[styles.scoreBtnText, active && styles.scoreBtnTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.likertLabels}>
        <Text style={styles.likertHint}>Disagree</Text>
        <Text style={styles.likertHint}>Agree</Text>
      </View>
    </View>
  );
}

export function FocusChallengeReflectionModal() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const focusChallengeCurrentDay = useHertzStore(s => s.focusChallengeCurrentDay);
  const focusChallengeStatus = useHertzStore(s => s.focusChallengeStatus);
  const focusChallengeAttemptId = useHertzStore(s => s.focusChallengeAttemptId);
  const focusChallengeSessionPlaybackSec = useHertzStore(s => s.focusChallengeSessionPlaybackSec);
  const failFocusChallenge = useHertzStore(s => s.failFocusChallenge);
  const finalizeFocusChallengeDayFromServer = useHertzStore(
    s => s.finalizeFocusChallengeDayFromServer,
  );
  const markFocusChallengeRewardClaimed = useHertzStore(s => s.markFocusChallengeRewardClaimed);
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);
  const insets = useModalScrollInsets();

  const [focus, setFocus] = useState<number | null>(null);
  const [progression, setProgression] = useState<number | null>(null);
  const [breathing, setBreathing] = useState<number | null>(null);
  const [reuse, setReuse] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = focus != null && progression != null && breathing != null && reuse != null && !loading;

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || focus == null || progression == null || breathing == null || reuse == null) {
      return;
    }
    if (focusChallengeAttemptId == null) {
      Alert.alert('Could not save', 'Challenge session expired — restart from Promos.');
      return;
    }
    if (focusChallengeSessionPlaybackSec < FOCUS_CHALLENGE_MIN_PLAY_SEC) {
      Alert.alert(
        'Session too short',
        `Play at least ${Math.ceil(FOCUS_CHALLENGE_MIN_PLAY_SEC / 60)} minutes before submitting today's reflection.`,
        [{text: 'OK'}],
      );
      return;
    }
    setLoading(true);
    const wasDay30 =
      focusChallengeCurrentDay === FOCUS_CHALLENGE_TOTAL_DAYS &&
      focusChallengeStatus === 'active';

    await syncFocusChallengeStart(focusChallengeAttemptId);

    const remote = await completeFocusChallengeDayRemote({
      attemptId: focusChallengeAttemptId,
      dayIndex: focusChallengeCurrentDay,
      durationPlayedSec: focusChallengeSessionPlaybackSec,
      reflection: {
        focus,
        progression,
        breathing,
        reuse,
        note: note.trim() || undefined,
      },
    });

    if (!remote.ok) {
      setLoading(false);
      if (remote.status === 'failed') {
        failFocusChallenge();
      }
      Alert.alert('Could not save day', remote.error, [{text: 'OK'}]);
      return;
    }

    if (remote.alreadyCompleted) {
      setLoading(false);
      Alert.alert('Already saved', "Today's session was already recorded.", [
        {text: 'OK', onPress: dismiss},
      ]);
      return;
    }

    finalizeFocusChallengeDayFromServer({
      status: remote.status,
      currentDay: remote.currentDay,
      lastCompletedDate: remote.lastCompletedDate,
    });

    const state = useHertzStore.getState();
    const completed = remote.status === 'complete' || state.focusChallengeStatus === 'complete';

    if (completed && wasDay30 && !state.focusChallengeRewardClaimed) {
      const result = await claimPromoReward('focus_challenge_30');
      setLoading(false);
      if (!result.ok) {
        Alert.alert('Challenge complete', result.error, [{text: 'OK', onPress: dismiss}]);
        return;
      }
      markFocusChallengeRewardClaimed();
      setClipboardPromoCode(result.code);
      showStoreOfferAlert({
        title: '30-Day Challenge complete!',
        code: result.code,
        onCopy: setClipboardPromoCode,
        onRedeem: () => setActiveModal('promo'),
      });
      dismiss();
      return;
    }

    setLoading(false);
    if (completed) {
      Alert.alert('Challenge complete', 'You finished all 30 days. Great work!', [
        {text: 'OK', onPress: dismiss},
      ]);
    } else {
      Alert.alert('Day complete', 'See you tomorrow for the next session.', [
        {text: 'OK', onPress: dismiss},
      ]);
    }
  }, [
    canSubmit,
    focus,
    progression,
    breathing,
    reuse,
    note,
    focusChallengeAttemptId,
    focusChallengeCurrentDay,
    focusChallengeStatus,
    focusChallengeSessionPlaybackSec,
    finalizeFocusChallengeDayFromServer,
    failFocusChallenge,
    dismiss,
    markFocusChallengeRewardClaimed,
    setActiveModal,
    setClipboardPromoCode,
  ]);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} accessibilityLabel="Dismiss reflection" />
      <View style={[styles.sheet, {paddingBottom: insets.paddingBottom}]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Day {focusChallengeCurrentDay} reflection</Text>
          <Text style={styles.subtitle}>Quick check-in — saved securely for your challenge record.</Text>
          <LikertRow
            label="I felt more focused during or after this session."
            value={focus}
            onChange={setFocus}
          />
          <LikertRow
            label="The frequency progression felt appropriate."
            value={progression}
            onChange={setProgression}
          />
          <LikertRow
            label="The breathing guidance helped this session."
            value={breathing}
            onChange={setBreathing}
          />
          <LikertRow
            label="I would use a similar setup again."
            value={reuse}
            onChange={setReuse}
          />
          <TextInput
            style={styles.noteInput}
            placeholder="Anything to adjust tomorrow? (optional)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <Pressable
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>Submit & complete day</Text>
            )}
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
    maxHeight: '90%',
  },
  scroll: {padding: 20, gap: 12},
  title: {fontSize: 18, fontWeight: '700', color: HertzTheme.text.primary},
  subtitle: {fontSize: 13, color: HertzTheme.text.secondary, marginBottom: 4},
  questionBlock: {gap: 8},
  questionLabel: {fontSize: 13, color: HertzTheme.text.primary, lineHeight: 18},
  scoreRow: {flexDirection: 'row', gap: 8, justifyContent: 'space-between'},
  scoreBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreBtnActive: {backgroundColor: HertzTheme.neon.cyan, borderColor: HertzTheme.neon.cyan},
  scoreBtnText: {color: HertzTheme.text.secondary, fontWeight: '600'},
  scoreBtnTextActive: {color: '#000'},
  likertLabels: {flexDirection: 'row', justifyContent: 'space-between'},
  likertHint: {fontSize: 10, color: HertzTheme.text.muted},
  noteInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 10,
    color: HertzTheme.text.primary,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: HertzTheme.neon.cyan,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {opacity: 0.45},
  primaryBtnText: {fontWeight: '700', color: '#000'},
});
