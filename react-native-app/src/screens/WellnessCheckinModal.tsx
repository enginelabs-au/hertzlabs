import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {submitWellnessCheckin} from '../monetization/wellnessCheckinService';
import {formatPromoCodeDisplay} from '../monetization/promoCodeFormat';
import {promoCodeNoun} from '../monetization/storePromoCopy';
import {showStoreOfferAlert} from '../promos/showStoreOfferAlert';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const CYAN = HertzTheme.neon.cyan;

function ScoreRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.questionLabel}>{label}</Text>
      <Text style={styles.questionHint}>{hint}</Text>
      <View style={styles.scoreRow}>
        {Array.from({length: 10}, (_, i) => i + 1).map(n => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              style={[styles.scoreBtn, active && styles.scoreBtnActive]}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              accessibilityLabel={`${label} ${n} out of 10`}>
              <Text style={[styles.scoreBtnText, active && styles.scoreBtnTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function WellnessCheckinModal() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const recordWellnessCheckin = useHertzStore(s => s.recordWellnessCheckin);
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);

  const [mood, setMood] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [focusLevel, setFocusLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rewardCode, setRewardCode] = useState<string | null>(null);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const canSubmit = mood != null && sleepQuality != null && focusLevel != null && !loading;

  const handleSubmit = useCallback(async () => {
    if (mood == null || sleepQuality == null || focusLevel == null) {
      return;
    }
    setLoading(true);
    setError(null);
    const result = await submitWellnessCheckin({mood, sleepQuality, focusLevel});
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    recordWellnessCheckin();
    setSuccess(result.message);
    if (result.code != null) {
      setRewardCode(result.code);
      setClipboardPromoCode(result.code);
    }
  }, [mood, sleepQuality, focusLevel, recordWellnessCheckin, setClipboardPromoCode]);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly wellness check-in</Text>
          <Pressable onPress={dismiss} style={styles.closeBtn} accessibilityLabel="Close">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {success != null ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
            {rewardCode != null && (
              <Text style={styles.codeText}>{formatPromoCodeDisplay(rewardCode)}</Text>
            )}
            {rewardCode != null && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  showStoreOfferAlert({
                    title: 'Wellness reward',
                    code: rewardCode,
                    onCopy: setClipboardPromoCode,
                    onRedeem: () => setActiveModal('promo'),
                  });
                }}>
                <Text style={styles.secondaryBtnText}>Redeem {promoCodeNoun()}</Text>
              </Pressable>
            )}
            <Pressable style={styles.primaryBtn} onPress={dismiss}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              Rate each area from 1 (low) to 10 (excellent). Responses are saved securely so we
              can improve Hertz Labs. Reward: one {promoCodeNoun()} — once per week.
            </Text>

            <ScoreRow
              label="Mood right now"
              hint="How do you feel emotionally at this moment?"
              value={mood}
              onChange={setMood}
            />
            <ScoreRow
              label="Sleep quality"
              hint="How well did you sleep last night?"
              value={sleepQuality}
              onChange={setSleepQuality}
            />
            <ScoreRow
              label="Focus level"
              hint="How sharp and focused do you feel today?"
              value={focusLevel}
              onChange={setFocusLevel}
            />

            {error != null && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              disabled={!canSubmit}
              onPress={handleSubmit}>
              {loading ? (
                <ActivityIndicator color={HertzTheme.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>Submit check-in</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100,
  },
  sheet: {
    maxHeight: '88%',
    borderRadius: 16,
    backgroundColor: 'rgba(10,12,20,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.35)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HertzTheme.glassBorder,
  },
  title: {
    fontFamily: HertzTheme.mono,
    fontSize: 14,
    fontWeight: '800',
    color: HertzTheme.text.primary,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 8,
  },
  closeText: {
    color: HertzTheme.text.muted,
    fontSize: 16,
  },
  scroll: {
    padding: 16,
    paddingBottom: 24,
  },
  intro: {
    color: HertzTheme.text.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  questionBlock: {
    marginBottom: 18,
  },
  questionLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '800',
    color: CYAN,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  questionHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scoreBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  scoreBtnActive: {
    borderColor: CYAN,
    backgroundColor: 'rgba(92,225,255,0.2)',
  },
  scoreBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
  },
  scoreBtnTextActive: {
    color: CYAN,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginBottom: 12,
  },
  primaryBtn: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '800',
    color: HertzTheme.bg,
    letterSpacing: 0.5,
  },
  successBox: {
    padding: 20,
    gap: 16,
  },
  successText: {
    color: '#34D399',
    fontSize: 14,
    lineHeight: 20,
  },
  codeText: {
    fontFamily: HertzTheme.mono,
    fontSize: 20,
    letterSpacing: 1.5,
    color: '#FBBF24',
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
});
