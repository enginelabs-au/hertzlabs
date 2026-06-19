import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import {activateWelcomePremium} from '../monetization/welcomePremiumService';
import {parseRcExpirationMs} from '../monetization/premiumGiftReminders';
import {REVENUECAT_ENTITLEMENT} from '../monetization/iapCatalog';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const BORDER = 'rgba(255,255,255,0.08)';

/** One-time 7-day Premium gift for new and existing users. */
export function WelcomePremiumModal() {
  const scrollInsets = useModalScrollInsets(32);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const markWelcomePremiumClaimed = useHertzStore(s => s.markWelcomePremiumClaimed);
  const setWelcomePremiumExpiresAtMs = useHertzStore(s => s.setWelcomePremiumExpiresAtMs);
  const _hydrateFromRC = useHertzStore(s => s._hydrateFromRC);
  const setSubscription = useHertzStore(s => s.setSubscription);
  const [loading, setLoading] = useState(false);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const handleActivate = useCallback(async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const result = await activateWelcomePremium();
      if (!result.ok) {
        Alert.alert('Could not activate', result.error, [{text: 'OK'}]);
        return;
      }

      markWelcomePremiumClaimed();

      let tierAfterGrant = useHertzStore.getState().tier;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await Purchases.invalidateCustomerInfoCache();
          const info = await Purchases.getCustomerInfo();
          _hydrateFromRC(info, REVENUECAT_ENTITLEMENT);
          const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT] as
            | {expirationDate?: string | null}
            | undefined;
          const expiryMs = parseRcExpirationMs(ent?.expirationDate);
          if (expiryMs != null) {
            setWelcomePremiumExpiresAtMs(expiryMs);
          } else {
            setWelcomePremiumExpiresAtMs(Date.now() + 7 * 86_400_000);
          }
          tierAfterGrant = useHertzStore.getState().tier;
          if (tierAfterGrant === 'premium') {
            break;
          }
        } catch {
          /* retry */
        }
        if (attempt < 2) {
          await new Promise<void>(resolve => setTimeout(resolve, 800));
        }
      }

      if (tierAfterGrant !== 'premium' && __DEV__) {
        setSubscription('premium', ['welcome_dev']);
      }

      Alert.alert(
        'Premium activated',
        tierAfterGrant === 'premium' || __DEV__
          ? 'You now have 7 days of full Premium access — all engines, extended frequency range, background audio, and more.'
          : 'Your Premium access is being applied. If features are still locked, fully close and reopen the app.',
        [{text: 'Start exploring', onPress: dismiss}],
      );
    } finally {
      setLoading(false);
    }
  }, [loading, markWelcomePremiumClaimed, setWelcomePremiumExpiresAtMs, _hydrateFromRC, setSubscription, dismiss]);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>WELCOME GIFT</Text>
            <Text style={styles.title}>7 Days of Premium, Free</Text>
            <Text style={styles.subtitle}>
              Every Hertz Labs member gets a complimentary week of Premium — on us.
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}>
          <View style={styles.heroCard}>
            <Text style={styles.heroIcon}>✦</Text>
            <Text style={styles.heroText}>
              Tap Activate Premium below to unlock every engine mode, the full 0–500 Hz range,
              background playback, and advanced controls for the next 7 days.
            </Text>
          </View>

          <View style={styles.perks}>
            {[
              'All 7 engine modes',
              'Full frequency spectrum (0–500 Hz)',
              'Background audio while minimised',
              'Math Mode presets + custom formulas',
            ].map(item => (
              <View key={item} style={styles.perkRow}>
                <Text style={styles.perkCheck}>✓</Text>
                <Text style={styles.perkText}>{item}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.activateBtn, loading && styles.activateBtnDisabled]}
            onPress={() => void handleActivate()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Activate Premium for 7 days free">
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.activateBtnText}>Activate Premium</Text>
            )}
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.laterBtnText}>Maybe later</Text>
          </Pressable>

          <Text style={styles.finePrint}>
            One-time offer per account. No payment required. Premium features revert to the free tier
            after 7 days unless you subscribe.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
    zIndex: 110,
  },
  sheet: {
    backgroundColor: '#0D0E18',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 22,
    color: GOLD,
    lineHeight: 26,
  },
  heroText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.88)',
  },
  perks: {
    gap: 8,
    marginBottom: 20,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  perkCheck: {
    fontSize: 14,
    color: HertzTheme.neon.lime,
    width: 16,
    lineHeight: 20,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  activateBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  activateBtnDisabled: {
    opacity: 0.7,
  },
  activateBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  laterBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'underline',
  },
  finePrint: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'center',
    marginTop: 8,
  },
});
