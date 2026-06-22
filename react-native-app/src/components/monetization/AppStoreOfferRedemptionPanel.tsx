import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {presentStoreOfferRedemption} from '../../monetization/appStoreOfferRedemption';
import {promoRedeemLegalNote} from '../../monetization/storePromoCopy';
import {isMacDesktopBuild} from '../../platform/layoutProfile';
import {HertzTheme} from '../../theme/hertzTheme';

const FORM_INPUT_ANDROID = Platform.select({
  android: {includeFontPadding: false} as const,
  default: {},
});

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const MUTED = 'rgba(255,255,255,0.45)';

type Props = {
  variant?: 'inline' | 'modal';
  /** When false, show redeem button only (e.g. Plans paywall). Code entry lives in Promos → Redeem modal. */
  showCodeInput?: boolean;
  onBrowsePromos?: () => void;
};

function redemptionCopy(showCodeInput: boolean): {
  title: string;
  hint: string;
  button: string;
  placeholder: string;
} {
  if (Platform.OS === 'android') {
    return {
      title: 'GOOGLE PLAY OFFER',
      hint: showCodeInput
        ? 'Paste the Google Play promo code from your email, then tap Redeem.'
        : 'Have a Google Play promo code from our team? Tap below to open redemption.',
      button: 'Redeem in Google Play',
      placeholder: 'Google Play promo code',
    };
  }
  if (isMacDesktopBuild()) {
    return {
      title: 'APP STORE OFFER',
      hint: showCodeInput
        ? 'Paste your App Store offer code from email, then tap Redeem to open the App Store page.'
        : 'Have an App Store offer code from our team? Tap below to open redemption.',
      button: 'Redeem App Store Offer',
      placeholder: 'App Store offer code',
    };
  }
  return {
    title: 'APP STORE OFFER',
    hint: showCodeInput
      ? 'Paste the App Store offer code from your email, then tap Redeem. Opens Apple\u2019s offer redemption page.'
      : 'Have an App Store offer code from our team? Tap below to open redemption.',
    button: 'Redeem App Store Offer',
    placeholder: 'App Store offer code',
  };
}

export function AppStoreOfferRedemptionPanel({
  variant = 'modal',
  showCodeInput = true,
  onBrowsePromos,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const copy = redemptionCopy(showCodeInput);
  const trimmedCode = code.trim();
  const canRedeem = showCodeInput ? trimmedCode.length >= 4 && !loading : !loading;

  const handleRedeem = useCallback(async () => {
    if (showCodeInput && trimmedCode.length > 0 && trimmedCode.length < 4) {
      Alert.alert('Invalid code', 'Enter the full offer code from your email.', [{text: 'OK'}]);
      return;
    }
    if (!canRedeem) {
      return;
    }
    setLoading(true);
    try {
      const result = await presentStoreOfferRedemption(showCodeInput ? trimmedCode : undefined);
      if (!result.ok) {
        Alert.alert('Could not redeem', result.error, [{text: 'OK'}]);
      }
    } finally {
      setLoading(false);
    }
  }, [canRedeem, showCodeInput, trimmedCode]);

  return (
    <View style={[styles.container, variant === 'inline' && styles.containerInline]}>
      {variant === 'modal' && <Text style={styles.title}>Redeem store offer</Text>}
      {variant === 'inline' && <Text style={styles.inlineLabel}>{copy.title}</Text>}
      <Text style={[styles.hint, variant === 'inline' && styles.hintInline]}>{copy.hint}</Text>
      {showCodeInput && (
        <TextInput
          style={[styles.codeInput, variant === 'inline' && styles.codeInputInline]}
          placeholder={copy.placeholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          {...FORM_INPUT_ANDROID}
        />
      )}
      <Pressable
        style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
        onPress={() => void handleRedeem()}
        disabled={!canRedeem}
        accessibilityRole="button"
        accessibilityLabel={copy.button}>
        {loading ? (
          <ActivityIndicator size="small" color={GOLD} />
        ) : (
          <Text style={styles.redeemBtnText}>{copy.button}</Text>
        )}
      </Pressable>
      {onBrowsePromos != null && (
        <Pressable onPress={onBrowsePromos} accessibilityRole="button">
          <Text style={styles.promosLink}>Browse earn opportunities →</Text>
        </Pressable>
      )}
      <Text style={styles.legalNote}>{promoRedeemLegalNote()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  containerInline: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  inlineLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
  },
  hint: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  hintInline: {
    fontSize: 12,
    lineHeight: 17,
  },
  codeInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: HertzTheme.mono,
    letterSpacing: 1.5,
    color: GOLD,
    minHeight: 48,
    textAlign: 'center',
  },
  codeInputInline: {
    fontSize: 16,
    letterSpacing: 1,
  },
  redeemBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnDisabled: {
    opacity: 0.7,
  },
  redeemBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.3,
  },
  promosLink: {
    fontSize: 12,
    color: HertzTheme.neon.cyan,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  legalNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 16,
    textAlign: 'center',
  },
});
