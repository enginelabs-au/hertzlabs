import React, {useCallback, useEffect, useState} from 'react';
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
import type {CustomerInfo, Package, PurchasesOffering} from 'react-native-purchases';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const ENTITLEMENT_ID = 'premium';

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const MUTED = 'rgba(255,255,255,0.45)';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';

const FREE_FEATURES = [
  'Binaural & Monaural modes',
  'Beat range: 0.5 – 40 Hz',
  'Basic presets (Schumann 7.83, Alpha 10 Hz)',
  'AI Guide suggestions',
];

const PREMIUM_FEATURES = [
  'All 7 engine modes (+ Hemispheric Sync, Phase, Pitch, Music)',
  'Beat range: 0 – 500 Hz (supra-gamma, experimental)',
  'All Math Mode presets + custom formula input',
  'Background audio (continues when screen locked)',
  'Full Solfeggio, Fibonacci & Golden Ratio presets',
  '7-day free trial on monthly & annual plans',
];

type PackageItem = {
  pkg: Package;
  label: string;
  price: string;
  period: string;
  badge?: string;
  highlighted?: boolean;
};

function parsePackages(offering: PurchasesOffering): PackageItem[] {
  const items: PackageItem[] = [];

  if (offering.monthly) {
    items.push({
      pkg: offering.monthly,
      label: 'Monthly',
      price: offering.monthly.product.priceString,
      period: '/ month',
      badge: '7-day free trial',
    });
  }
  if (offering.annual) {
    items.push({
      pkg: offering.annual,
      label: 'Annual',
      price: offering.annual.product.priceString,
      period: '/ year',
      badge: 'Best value · 7-day free trial',
      highlighted: true,
    });
  }
  // lifetime / one-time
  const lifetime: Package | undefined = offering.lifetime ?? offering.availablePackages.find(
    (p: Package) => p.packageType === 'LIFETIME',
  );
  if (lifetime) {
    items.push({
      pkg: lifetime,
      label: 'Lifetime',
      price: lifetime.product.priceString,
      period: 'one-time',
      badge: 'Pay once, own forever',
    });
  }
  return items;
}

function PremiumFeatureList() {
  return (
    <View style={styles.featureList}>
      <Text style={styles.featureGroupLabel}>PREMIUM UNLOCKS</Text>
      {PREMIUM_FEATURES.map(f => (
        <View key={f} style={styles.featureRow}>
          <Text style={styles.featureCheck}>✓</Text>
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <Text style={styles.featureGroupLabel}>ALWAYS FREE</Text>
      {FREE_FEATURES.map(f => (
        <View key={f} style={styles.featureRow}>
          <Text style={styles.featureCheckFree}>○</Text>
          <Text style={[styles.featureText, styles.featureTextMuted]}>{f}</Text>
        </View>
      ))}
    </View>
  );
}

function PackageCard({
  item,
  onPurchase,
  purchasing,
}: {
  item: PackageItem;
  onPurchase: (pkg: Package) => void;
  purchasing: boolean;
}) {
  return (
    <View style={[styles.packageCard, item.highlighted && styles.packageCardHighlighted]}>
      {item.badge != null && (
        <View style={[styles.badgeRow, item.highlighted && styles.badgeRowHighlighted]}>
          <Text style={[styles.badgeText, item.highlighted && styles.badgeTextHighlighted]}>
            {item.badge}
          </Text>
        </View>
      )}
      <View style={styles.packageBody}>
        <View style={styles.packageInfo}>
          <Text style={styles.packageLabel}>{item.label}</Text>
          <Text style={styles.packagePrice}>
            {item.price}
            <Text style={styles.packagePeriod}> {item.period}</Text>
          </Text>
        </View>
        <Pressable
          style={[styles.buyBtn, item.highlighted && styles.buyBtnHighlighted, purchasing && styles.buyBtnDisabled]}
          onPress={() => onPurchase(item.pkg)}
          disabled={purchasing}
          accessibilityRole="button"
          accessibilityLabel={`Purchase ${item.label} plan`}>
          {purchasing ? (
            <ActivityIndicator size="small" color={item.highlighted ? '#000' : GOLD} />
          ) : (
            <Text style={[styles.buyBtnText, item.highlighted && styles.buyBtnTextHighlighted]}>
              {item.label === 'Monthly' || item.label === 'Annual' ? 'Start Free Trial' : 'Buy Now'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function PaywallScreen() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const _hydrateFromRC = useHertzStore(s => s._hydrateFromRC);

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        setOffering(offerings.current);
      } catch (e) {
        setFetchError(
          e instanceof Error ? e.message : 'Could not load offerings. Check your connection.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const handlePurchase = useCallback(
    async (pkg: Package) => {
      if (purchasing) {
        return;
      }
      setPurchasing(true);
      try {
        const result = await Purchases.purchasePackage(pkg);
        _hydrateFromRC(result.customerInfo, ENTITLEMENT_ID);
        // If purchase succeeded and entitlement is now active, close
        const isActive = Object.keys(result.customerInfo.entitlements.active).includes(
          ENTITLEMENT_ID,
        );
        if (isActive) {
          dismiss();
        }
      } catch (e) {
        // RevenueCat throws with code; user-cancelled is not an error to alert
        const msg = e instanceof Error ? e.message : String(e);
        const userCancelled = msg.toLowerCase().includes('cancel') || msg.includes('1');
        if (!userCancelled) {
          Alert.alert('Purchase Failed', msg, [{text: 'OK'}]);
        }
      } finally {
        setPurchasing(false);
      }
    },
    [purchasing, _hydrateFromRC, dismiss],
  );

  const handleRestore = useCallback(async () => {
    if (restoring) {
      return;
    }
    setRestoring(true);
    try {
      const info: CustomerInfo = await Purchases.restorePurchases();
      _hydrateFromRC(info, ENTITLEMENT_ID);
      const isActive = Object.keys(info.entitlements.active).includes(ENTITLEMENT_ID);
      Alert.alert(
        isActive ? 'Restored' : 'Nothing to Restore',
        isActive
          ? 'Your Premium subscription has been restored.'
          : 'No active Premium subscription found on this Apple ID.',
        [{text: 'OK', onPress: isActive ? dismiss : undefined}],
      );
    } catch (e) {
      Alert.alert('Restore Failed', e instanceof Error ? e.message : 'Please try again.', [
        {text: 'OK'},
      ]);
    } finally {
      setRestoring(false);
    }
  }, [restoring, _hydrateFromRC, dismiss]);

  const packages = offering ? parsePackages(offering) : [];

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Hertz Labs Premium</Text>
            <Text style={styles.subtitle}>Unlock the full frequency spectrum</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close paywall">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Feature comparison */}
          <PremiumFeatureList />

          {/* Packages */}
          <View style={styles.packagesSection}>
            <Text style={styles.sectionLabel}>CHOOSE A PLAN</Text>

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={GOLD} />
                <Text style={styles.loadingText}>Loading plans…</Text>
              </View>
            )}

            {!loading && fetchError != null && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{fetchError}</Text>
                <Text style={styles.errorHint}>
                  Check your internet connection and try again.
                </Text>
              </View>
            )}

            {!loading && fetchError == null && packages.length === 0 && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>No plans available in this region.</Text>
                <Text style={styles.errorHint}>
                  Make sure products are configured in RevenueCat and App Store Connect.
                </Text>
              </View>
            )}

            {packages.map(item => (
              <PackageCard
                key={item.pkg.identifier}
                item={item}
                onPurchase={handlePurchase}
                purchasing={purchasing}
              />
            ))}
          </View>

          {/* Restore */}
          <Pressable
            style={styles.restoreBtn}
            onPress={() => void handleRestore()}
            disabled={restoring}
            accessibilityRole="button">
            {restoring ? (
              <ActivityIndicator size="small" color={MUTED} />
            ) : (
              <Text style={styles.restoreText}>Restore Previous Purchase</Text>
            )}
          </Pressable>

          {/* Legal */}
          <Text style={styles.legalText}>
            Subscriptions auto-renew unless cancelled at least 24 hours before the end of the
            current period. Manage or cancel in your App Store account settings. Payment is charged
            to your Apple ID at confirmation of purchase. Free trials convert to paid plans at the
            end of the trial period.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheet: {
    backgroundColor: '#0D0E18',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '92%',
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
    gap: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: MUTED,
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
    paddingBottom: 40,
  },
  featureList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  featureGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 7,
  },
  featureCheck: {
    fontSize: 13,
    color: HertzTheme.neon.lime,
    width: 16,
    lineHeight: 19,
  },
  featureCheckFree: {
    fontSize: 13,
    color: MUTED,
    width: 16,
    lineHeight: 19,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 19,
  },
  featureTextMuted: {
    color: MUTED,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  packagesSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  packageCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  packageCardHighlighted: {
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
  },
  badgeRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  badgeRowHighlighted: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderBottomColor: GOLD_BORDER,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.3,
  },
  badgeTextHighlighted: {
    color: GOLD,
  },
  packageBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  packageInfo: {
    flex: 1,
    gap: 2,
  },
  packageLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  packagePeriod: {
    fontSize: 12,
    fontWeight: '400',
    color: MUTED,
  },
  buyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    minWidth: 110,
    alignItems: 'center',
  },
  buyBtnHighlighted: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  buyBtnDisabled: {
    opacity: 0.5,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.2,
  },
  buyBtnTextHighlighted: {
    color: '#000000',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: MUTED,
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
  },
  errorHint: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  restoreText: {
    fontSize: 13,
    color: MUTED,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    lineHeight: 15,
    paddingHorizontal: 20,
    paddingBottom: 8,
    textAlign: 'center',
  },
});
