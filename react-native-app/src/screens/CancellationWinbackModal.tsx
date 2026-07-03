import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {usesStoreNativeRedemption} from '../monetization/appleStoreCompliance';
import {
  canShowCancellationWinback,
  openNativeSubscriptionManagement,
} from '../monetization/cancellationWinbackFlow';
import type {ActiveSubscriptionSummary} from '../monetization/activeSubscriptionSummary';
import {presentStoreOfferRedemption} from '../monetization/appStoreOfferRedemption';
import {
  claimCancellationWinback,
  submitCancellationFeedback,
} from '../promos/claimCancellationWinback';
import {showStoreOfferAlert} from '../promos/showStoreOfferAlert';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';

type Props = {
  summary: ActiveSubscriptionSummary;
};

export function CancellationWinbackModal({summary}: Props) {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);
  const insets = useModalScrollInsets();

  const [step, setStep] = useState<'feedback' | 'offer'>('feedback');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [redeemUrl, setRedeemUrl] = useState('');
  const [epochId, setEpochId] = useState(1);
  const [offerTier, setOfferTier] = useState<'trial_1_month' | 'paid_3_month'>(
    summary.isTrial ? 'trial_1_month' : 'paid_3_month',
  );

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const loadOffer = useCallback(async () => {
    setLoading(true);
    await submitCancellationFeedback({
      isTrial: summary.isTrial,
      productId: summary.productId || null,
      epochId,
      feedback,
    });
    const result = await claimCancellationWinback({
      isTrial: summary.isTrial,
      productId: summary.productId || null,
    });
    setLoading(false);
    if (!result.ok) {
      if (result.eligible === false) {
        await openNativeSubscriptionManagement(summary.managementURL);
        dismiss();
        return;
      }
      setStep('offer');
      return;
    }
    setCode(result.code);
    setRedeemUrl(result.redeemUrl);
    setEpochId(result.epochId);
    setOfferTier(result.offerTier);
    setClipboardPromoCode(result.code);
    setStep('offer');
  }, [dismiss, epochId, feedback, setClipboardPromoCode, summary]);

  const skipFeedback = useCallback(() => {
    void loadOffer();
  }, [loadOffer]);

  const continueToStore = useCallback(async () => {
    await claimCancellationWinback({
      isTrial: summary.isTrial,
      productId: summary.productId || null,
      forfeit: true,
    });
    await openNativeSubscriptionManagement(summary.managementURL);
    dismiss();
  }, [dismiss, summary]);

  const redeem = useCallback(() => {
    if (code == null) {
      return;
    }
    if (usesStoreNativeRedemption()) {
      void presentStoreOfferRedemption(code);
    } else if (redeemUrl) {
      void Linking.openURL(redeemUrl);
    }
  }, [code, redeemUrl]);

  if (!canShowCancellationWinback(summary)) {
    return null;
  }

  const headline =
    offerTier === 'paid_3_month'
      ? 'Stay subscribed — 3 months on us'
      : 'Keep your trial going — 1 month free';

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss" />
      <View style={[styles.sheet, {paddingBottom: insets.paddingBottom}]}>
        <ScrollView contentContainerStyle={styles.content}>
          {step === 'feedback' ? (
            <>
              <Text style={styles.title}>Before you go…</Text>
              <Text style={styles.body}>
                Optional — tell us what we could improve. Your subscription is still managed in the
                App Store / Play Store.
              </Text>
              <TextInput
                style={styles.input}
                multiline
                placeholder="What would have kept you subscribed?"
                placeholderTextColor={HertzTheme.text.muted}
                value={feedback}
                onChangeText={setFeedback}
              />
              <Pressable style={styles.primaryBtn} onPress={skipFeedback} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue</Text>
                )}
              </Pressable>
              <Pressable style={styles.linkBtn} onPress={skipFeedback} disabled={loading}>
                <Text style={styles.linkBtnText}>Skip feedback</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{headline}</Text>
              <Text style={styles.body}>
                One store offer code is reserved for you this billing period. Redeem in the App Store
                or Play Store — same code if you return.
              </Text>
              {code != null ? (
                <>
                  <Text style={styles.code} selectable>
                    {code}
                  </Text>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => {
                      showStoreOfferAlert({
                        title: 'Winback offer',
                        code,
                        onCopy: setClipboardPromoCode,
                        onRedeem: redeem,
                      });
                    }}>
                    <Text style={styles.primaryBtnText}>Stay & claim free Premium</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={redeem}>
                    <Text style={styles.secondaryBtnText}>Redeem in store</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable style={styles.linkBtn} onPress={() => void continueToStore()}>
                <Text style={styles.linkBtnText}>No thanks, continue cancelling</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)'},
  sheet: {
    backgroundColor: HertzTheme.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  content: {padding: 20, gap: 12},
  title: {fontSize: 18, fontWeight: '700', color: HertzTheme.text.primary},
  body: {fontSize: 13, lineHeight: 19, color: HertzTheme.text.secondary},
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    borderRadius: 10,
    padding: 12,
    color: HertzTheme.text.primary,
    textAlignVertical: 'top',
  },
  code: {
    fontFamily: HertzTheme.mono,
    fontSize: 16,
    color: HertzTheme.neon.amber,
    textAlign: 'center',
    paddingVertical: 8,
  },
  primaryBtn: {
    backgroundColor: HertzTheme.neon.amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {fontWeight: '700', color: '#000'},
  secondaryBtn: {
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {color: HertzTheme.neon.cyan, fontWeight: '600'},
  linkBtn: {paddingVertical: 8, alignItems: 'center'},
  linkBtnText: {color: HertzTheme.text.muted, fontSize: 13},
});
