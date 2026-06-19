import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';
import {refreshRcEntitlements, validatePromoCode} from '../monetization/promoCodeService';
import {REVENUECAT_ENTITLEMENT} from '../monetization/iapCatalog';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.08)';
const SUCCESS = '#34D399';
const SUCCESS_DIM = 'rgba(52,211,153,0.10)';
const SUCCESS_BORDER = 'rgba(52,211,153,0.30)';
const ERROR = '#F87171';
const ERROR_DIM = 'rgba(248,113,113,0.08)';
const ERROR_BORDER = 'rgba(248,113,113,0.25)';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function PromoRedemptionModal() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const applyPromo = useHertzStore(s => s.applyPromo);
  const _hydrateFromRC = useHertzStore(s => s._hydrateFromRC);

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<TextInput>(null);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const handleRedeem = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    setSuccessMsg('');

    const result = await validatePromoCode(trimmed);

    if (!result.valid) {
      setStatus('error');
      setErrorMsg(result.error);
      return;
    }

    // Apply locally
    applyPromo(trimmed, result.entitlement);

    // For trial / lifetime codes: the backend already called RC API to grant
    // the entitlement — refresh the local RC cache so the tier updates.
    if (result.entitlement === 'extended_trial' || result.entitlement === 'lifetime') {
      const refreshed = await refreshRcEntitlements();
      if (refreshed) {
        try {
          const info = await Purchases.getCustomerInfo();
          _hydrateFromRC(info, REVENUECAT_ENTITLEMENT);
        } catch {
          // Non-fatal; tier will update next time RC refreshes
        }
      }
    }

    setStatus('success');
    setSuccessMsg(
      result.entitlement === 'extended_trial'
        ? `${result.label} activated! Your 3-month trial starts now.`
        : result.entitlement === 'lifetime'
          ? `${result.label} activated! Enjoy Hertz Labs for life.`
          : `${result.label} applied! Your discount will appear at checkout.`,
    );
  }, [code, applyPromo, _hydrateFromRC]);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Redeem Promo Code</Text>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.hint}>
            Enter your promo code below. Codes are case-insensitive and single-use.
          </Text>

          {/* Input */}
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              status === 'error' && styles.inputError,
              status === 'success' && styles.inputSuccess,
            ]}
            value={code}
            onChangeText={v => {
              setCode(v.toUpperCase());
              if (status !== 'idle') {
                setStatus('idle');
              }
            }}
            placeholder="e.g. HZ-ABCD12"
            placeholderTextColor={MUTED}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void handleRedeem()}
            editable={status !== 'loading' && status !== 'success'}
          />

          {/* Error */}
          {status === 'error' && (
            <View style={styles.messageBand}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Success */}
          {status === 'success' && (
            <View style={[styles.messageBand, styles.messageBandSuccess]}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          )}

          {/* Redeem / Done button */}
          {status === 'success' ? (
            <Pressable style={[styles.redeemBtn, styles.redeemBtnSuccess]} onPress={dismiss}>
              <Text style={[styles.redeemBtnText, styles.redeemBtnTextSuccess]}>Done</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.redeemBtn,
                (code.trim().length === 0 || status === 'loading') && styles.redeemBtnDisabled,
              ]}
              onPress={() => void handleRedeem()}
              disabled={code.trim().length === 0 || status === 'loading'}>
              {status === 'loading' ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Text style={styles.redeemBtnText}>Redeem</Text>
              )}
            </Pressable>
          )}

          <Text style={styles.legalNote}>
            Codes are single-use. See the Promos screen to earn codes for free.
          </Text>
          <Pressable
            onPress={() => setActiveModal('promos')}
            accessibilityRole="button">
            <Text style={styles.promosLink}>Browse earn opportunities →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    zIndex: 110,
  },
  sheet: {
    backgroundColor: '#0D0E18',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  body: {
    padding: 20,
    gap: 14,
    paddingBottom: 36,
  },
  hint: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: HertzTheme.mono,
  },
  inputError: {
    borderColor: ERROR_BORDER,
    backgroundColor: ERROR_DIM,
  },
  inputSuccess: {
    borderColor: SUCCESS_BORDER,
    backgroundColor: SUCCESS_DIM,
  },
  messageBand: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: ERROR_DIM,
    borderWidth: 1,
    borderColor: ERROR_BORDER,
  },
  messageBandSuccess: {
    backgroundColor: SUCCESS_DIM,
    borderColor: SUCCESS_BORDER,
  },
  errorText: {
    fontSize: 13,
    color: ERROR,
    fontWeight: '500',
    lineHeight: 18,
  },
  successText: {
    fontSize: 13,
    color: SUCCESS,
    fontWeight: '600',
    lineHeight: 18,
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
    opacity: 0.45,
  },
  redeemBtnSuccess: {
    borderColor: SUCCESS_BORDER,
    backgroundColor: SUCCESS_DIM,
  },
  redeemBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.3,
  },
  redeemBtnTextSuccess: {
    color: SUCCESS,
  },
  legalNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 16,
    textAlign: 'center',
  },
  promosLink: {
    fontSize: 12,
    color: HertzTheme.neon.cyan,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
