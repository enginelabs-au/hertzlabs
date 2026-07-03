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
import {claimReferral} from '../../promos/claimReferral';
import {showStoreOfferAlert} from '../../promos/showStoreOfferAlert';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

const FORM_INPUT_ANDROID = Platform.select({
  android: {includeFontPadding: false} as const,
  default: {},
});

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.08)';

type Props = {
  onRedeem?: () => void;
};

export function ReferralCodePanel({onRedeem}: Props) {
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = code.trim().toUpperCase().replace(/-/g, '');
    if (trimmed.length < 6) {
      Alert.alert('Invalid code', 'Enter your friend\u2019s HZ referral ID (e.g. HZABC123).', [
        {text: 'OK'},
      ]);
      return;
    }
    setSubmitting(true);
    const result = await claimReferral(trimmed);
    setSubmitting(false);
    if (!result.ok) {
      Alert.alert('Could not apply code', result.error, [{text: 'OK'}]);
      return;
    }
    setSuccess(true);
    setClipboardPromoCode(result.referee.code);
    showStoreOfferAlert({
      title: 'Referral reward',
      code: result.referee.code,
      onCopy: setClipboardPromoCode,
      onRedeem: onRedeem,
    });
  }, [code, onRedeem, setClipboardPromoCode]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>HAVE A REFERRAL CODE?</Text>
      <Text style={styles.hint}>
        Enter a friend&apos;s HZ ID from their Refer a Friend message. Separate from store promo
        codes — rewards both of you via the App Store or Google Play.
      </Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="HZABC123"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!success && !submitting}
          {...FORM_INPUT_ANDROID}
        />
        <Pressable
          style={[styles.btn, (submitting || success) && styles.btnDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting || success}
          accessibilityRole="button">
          {submitting ? (
            <ActivityIndicator size="small" color={GOLD} />
          ) : (
            <Text style={styles.btnText}>{success ? 'Applied' : 'Apply'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    color: MUTED,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: HertzTheme.mono,
  },
  btn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
});
