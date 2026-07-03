import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {usesStoreNativeRedemption} from '../monetization/appleStoreCompliance';
import {presentStoreOfferRedemption} from '../monetization/appStoreOfferRedemption';
import {claimPromoReward} from '../promos/claimPromoReward';
import {showStoreOfferAlert} from '../promos/showStoreOfferAlert';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';

type Props = {
  peakStreakDays: number;
  includePremiumOffer: boolean;
  onRestore: () => void;
  onDecline: () => void;
};

export function LapsedWinbackModal({
  peakStreakDays,
  includePremiumOffer,
  onRestore,
  onDecline,
}: Props) {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);
  const insets = useModalScrollInsets();
  const [claiming, setClaiming] = useState(false);

  const dismiss = useCallback(() => {
    onDecline();
    setActiveModal(null);
  }, [onDecline, setActiveModal]);

  const claim = useCallback(async () => {
    onRestore();
    if (includePremiumOffer && usesStoreNativeRedemption()) {
      setClaiming(true);
      const result = await claimPromoReward('lapsed_winback_30');
      setClaiming(false);
      if (result.ok) {
        setClipboardPromoCode(result.code);
        showStoreOfferAlert({
          title: 'Welcome back',
          code: result.code,
          onCopy: setClipboardPromoCode,
          onRedeem: () => void presentStoreOfferRedemption(result.code),
        });
      }
    }
    setActiveModal(null);
  }, [includePremiumOffer, onRestore, setActiveModal, setClipboardPromoCode]);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={dismiss} />
      <View style={[styles.sheet, {paddingBottom: insets.paddingBottom}]}>
        <Text style={styles.title}>
          {includePremiumOffer ? 'We saved your progress' : 'Welcome back'}
        </Text>
        <Text style={styles.body}>
          {includePremiumOffer
            ? `Return today — restore your ${peakStreakDays}-day peak streak and claim 3 days of Premium free (store redeem).`
            : `Pick up your ${peakStreakDays}-day streak where you left off. Play 2+ minutes today to resume.`}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => void claim()} disabled={claiming}>
          {claiming ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {includePremiumOffer ? 'Return & claim offer' : 'Restore streak'}
            </Text>
          )}
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={dismiss}>
          <Text style={styles.linkBtnText}>Not now</Text>
        </Pressable>
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
    padding: 20,
    gap: 12,
  },
  title: {fontSize: 18, fontWeight: '700', color: HertzTheme.text.primary},
  body: {fontSize: 13, lineHeight: 19, color: HertzTheme.text.secondary},
  primaryBtn: {
    backgroundColor: HertzTheme.neon.amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {fontWeight: '700', color: '#000'},
  linkBtn: {paddingVertical: 8, alignItems: 'center'},
  linkBtnText: {color: HertzTheme.text.muted, fontSize: 13},
});
