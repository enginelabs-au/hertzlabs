import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  normalizePromoEntitlement,
  type PromoEntitlement,
} from '../state/slices/promo';
import {formatPromoCodeDisplay, normalizePromoCode} from '../monetization/promoCodeFormat';
import {PromoCodeCopyButton} from '../components/monetization/PromoCodeCopyButton';
import {refreshRcEntitlements, validatePromoCode} from '../monetization/promoCodeService';
import Purchases from 'react-native-purchases';
import type {CustomerInfo, Package} from 'react-native-purchases';
import {
  summarizeActiveSubscription,
  type ActiveSubscriptionSummary,
} from '../monetization/activeSubscriptionSummary';
import {REVENUECAT_ENTITLEMENT} from '../monetization/iapCatalog';
import {loadPaywallPackages, type PaywallPlan} from '../monetization/loadPaywallPackages';
import {useHertzStore} from '../state/store';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import {HertzTheme} from '../theme/hertzTheme';

const ENTITLEMENT_ID = REVENUECAT_ENTITLEMENT;

const PAYWALL_STORE = Platform.select({
  ios: {
    legalDisclaimer:
      'Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Settings → Apple ID → Subscriptions. Payment is charged to your Apple ID at confirmation of purchase. Free trials convert to paid plans at the end of the trial period.',
    manageFallbackMessage:
      'Open Settings → Apple ID → Subscriptions on your iPhone to manage billing.',
    manageButtonLabel: 'Manage in App Store',
    manageAccessibilityLabel: 'Manage subscription in App Store',
    restoreEmptyMessage: 'No active Premium subscription found on this Apple ID.',
  },
  default: {
    legalDisclaimer:
      'Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current billing period. Manage or cancel in Google Play → Payments & subscriptions → Subscriptions. Payment is charged to your Google Play account at confirmation of purchase. Free trials convert to paid plans at the end of the trial period.',
    manageFallbackMessage:
      'Open Google Play → Payments & subscriptions → Subscriptions to manage billing.',
    manageButtonLabel: 'Manage in Google Play',
    manageAccessibilityLabel: 'Manage subscription in Google Play',
    restoreEmptyMessage: 'No active Premium subscription found on this Google account.',
  },
})!;

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

function isPurchasable(plan: PaywallPlan): boolean {
  return plan.pkg != null || plan.storeProduct != null;
}

function StoreUnavailableCard({
  detail,
  onRetry,
  retrying,
}: {
  detail: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorText}>
        {Platform.OS === 'android'
          ? 'Google Play products not available yet'
          : 'App Store products not available yet'}
      </Text>
      <Text style={styles.errorHint}>{detail}</Text>
      <Pressable
        style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Retry loading subscription plans">
        {retrying ? (
          <ActivityIndicator size="small" color={GOLD} />
        ) : (
          <Text style={styles.retryBtnText}>Retry loading plans</Text>
        )}
      </Pressable>
    </View>
  );
}

function ActiveSubscriptionCard({summary}: {summary: ActiveSubscriptionSummary}) {
  const openManagement = useCallback(() => {
    if (!summary.managementURL) {
      Alert.alert(
        'Manage Subscription',
        PAYWALL_STORE.manageFallbackMessage,
        [{text: 'OK'}],
      );
      return;
    }
    void Linking.openURL(summary.managementURL);
  }, [summary.managementURL]);

  return (
    <View style={[styles.activeCard, summary.isPremium && styles.activeCardPremium]}>
      <Text style={styles.activeCardLabel}>
        {summary.isPremium ? 'YOUR ACTIVE PLAN' : 'CURRENT STATUS'}
      </Text>
      <Text style={styles.activePlanName}>{summary.planLabel}</Text>
      <Text style={styles.activeStatus}>{summary.statusLine}</Text>
      {summary.detailLines.map(line => (
        <Text key={line} style={styles.activeDetail}>
          {line}
        </Text>
      ))}
      {summary.isPremium && !summary.isPromotionalGift && summary.managementURL ? (
        <Pressable
          style={styles.manageBtn}
          onPress={openManagement}
          accessibilityRole="button"
          accessibilityLabel={PAYWALL_STORE.manageAccessibilityLabel}>
          <Text style={styles.manageBtnText}>{PAYWALL_STORE.manageButtonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
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

function planProductId(plan: PaywallPlan): string | null {
  return plan.pkg?.product.productIdentifier ?? plan.storeProduct?.productIdentifier ?? null;
}

function PackageCard({
  item,
  onPurchase,
  purchasing,
  isCurrentPlan,
}: {
  item: PaywallPlan;
  onPurchase: (plan: PaywallPlan) => void;
  purchasing: boolean;
  isCurrentPlan: boolean;
}) {
  const ready = isPurchasable(item);
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
          style={[
            styles.buyBtn,
            item.highlighted && ready && !isCurrentPlan && styles.buyBtnHighlighted,
            (purchasing || !ready || isCurrentPlan) && styles.buyBtnDisabled,
            isCurrentPlan && styles.buyBtnCurrent,
          ]}
          onPress={() => onPurchase(item)}
          disabled={purchasing || !ready || isCurrentPlan}
          accessibilityRole="button"
          accessibilityLabel={
            isCurrentPlan ? `${item.label} is your current plan` : `Purchase ${item.label} plan`
          }>
          {purchasing ? (
            <ActivityIndicator size="small" color={item.highlighted ? '#000' : GOLD} />
          ) : (
            <Text
              style={[
                styles.buyBtnText,
                item.highlighted && ready && !isCurrentPlan && styles.buyBtnTextHighlighted,
                isCurrentPlan && styles.buyBtnTextCurrent,
              ]}>
              {isCurrentPlan
                ? 'Current Plan'
                : !ready
                  ? 'Not Ready'
                  : item.label === 'Monthly' || item.label === 'Annual'
                    ? 'Start Free Trial'
                    : 'Buy Now'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const DISCOUNT_LABELS: Record<PromoEntitlement, string> = {
  extended_trial: '3-month trial',
  lifetime: 'Lifetime',
  discount_2mo: '2 months free',
  discount_6mo: '6 months free',
};

type DiscountPromoEntitlement = 'discount_2mo' | 'discount_6mo';

/**
 * Offer IDs created in App Store Connect (underscores) and Google Play (hyphens).
 * Keyed by entitlement → plan type → platform offer ID.
 */
const PROMO_OFFER_IDS: Record<
  DiscountPromoEntitlement,
  {monthly: {ios: string; android: string}; annual: {ios: string; android: string}}
> = {
  discount_2mo: {
    monthly: {ios: 'hz_2mo_free_monthly', android: 'hz-2mo-free-monthly'},
    annual: {ios: 'hz_2mo_free_annual', android: 'hz-2mo-free-annual'},
  },
  discount_6mo: {
    monthly: {ios: 'hz_6mo_free_monthly', android: 'hz-6mo-free-monthly'},
    annual: {ios: 'hz_6mo_free_annual', android: 'hz-6mo-free-annual'},
  },
};

function planTypeKey(pkg: Package): 'monthly' | 'annual' | null {
  if (pkg.packageType === 'MONTHLY') return 'monthly';
  if (pkg.packageType === 'ANNUAL') return 'annual';
  return null;
}

/**
 * Attempt to purchase with a promotional offer applied.
 * Falls back to a standard purchase if the offer cannot be resolved.
 */
async function purchaseWithOffer(
  pkg: Package,
  entitlement: DiscountPromoEntitlement,
): Promise<Awaited<ReturnType<typeof Purchases.purchasePackage>>> {
  const planKey = planTypeKey(pkg);
  const offerMap = planKey ? PROMO_OFFER_IDS[entitlement][planKey] : null;

  if (offerMap == null) {
    return Purchases.purchasePackage(pkg);
  }

  if (Platform.OS === 'ios') {
    const offerId = offerMap.ios;
    const discount = pkg.product.discounts?.find(d => d.identifier === offerId);
    if (discount != null) {
      try {
        const promoOffer = await Purchases.getPromotionalOffer(pkg.product, discount);
        if (promoOffer != null) {
          return Purchases.purchaseDiscountedPackage(pkg, promoOffer);
        }
      } catch {
        // offer fetch failed — fall through to standard purchase
      }
    }
  } else if (Platform.OS === 'android') {
    const offerId = offerMap.android;
    const option = pkg.product.subscriptionOptions?.find(o => o.id.endsWith(`:${offerId}`));
    if (option != null) {
      try {
        return Purchases.purchaseSubscriptionOption(option);
      } catch {
        // option unavailable — fall through to standard purchase
      }
    }
  }

  return Purchases.purchasePackage(pkg);
}

function ActivePromoBar({
  code,
  entitlement,
  onClear,
}: {
  code: string;
  entitlement: PromoEntitlement;
  onClear: () => void;
}) {
  return (
    <View style={styles.promoBanner}>
      <Text style={styles.promoBannerIcon}>🎟</Text>
      <View style={styles.promoBannerInfo}>
        <Text style={styles.promoBannerLabel}>PROMO ACTIVE</Text>
        <Text style={styles.promoBannerCode}>
          {formatPromoCodeDisplay(code)} — {DISCOUNT_LABELS[entitlement]}
        </Text>
      </View>
      <PromoCodeCopyButton code={code} label="Copy" compact />
      <Pressable onPress={onClear} accessibilityLabel="Remove promo code" style={styles.promoRemove}>
        <Text style={styles.promoRemoveText}>✕</Text>
      </Pressable>
    </View>
  );
}

function PromoCodeInput({
  onApplied,
}: {
  onApplied: (entitlement: PromoEntitlement) => void;
}) {
  const applyPromo = useHertzStore(s => s.applyPromo);
  const appliedPromoCode = useHertzStore(s => s.appliedPromoCode);
  const clipboardPromoCode = useHertzStore(s => s.clipboardPromoCode);
  const _hydrateFromRC = useHertzStore(s => s._hydrateFromRC);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (code.length === 0 && clipboardPromoCode != null && clipboardPromoCode.length > 0) {
      setCode(clipboardPromoCode);
    }
  }, [clipboardPromoCode, code.length]);

  const handleApply = useCallback(async () => {
    const trimmed = normalizePromoCode(code);
    if (trimmed.length < 4) {
      setError('Enter a valid promo code.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    const result = await validatePromoCode(trimmed);
    setLoading(false);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    applyPromo(trimmed, result.entitlement);
    if (
      result.entitlement === 'one_month' ||
      result.entitlement === 'extended_trial' ||
      result.entitlement === 'lifetime'
    ) {
      const info = await refreshRcEntitlements().then(async ok => {
        if (ok) {
          try {
            const Purchases_ = (await import('react-native-purchases')).default;
            return Purchases_.getCustomerInfo();
          } catch {
            return null;
          }
        }
        return null;
      });
      if (info != null) {
        _hydrateFromRC(info, ENTITLEMENT_ID);
      }
    }
    setSuccess(true);
    setCode('');
    inputRef.current?.blur();
    onApplied(result.entitlement);
  }, [code, applyPromo, _hydrateFromRC, onApplied]);

  if (appliedPromoCode != null) {
    return null;
  }

  return (
    <View style={styles.promoInputWrapper}>
      <Text style={styles.promoInputLabel}>PROMO CODE</Text>
      <View style={styles.promoInputRow}>
        <TextInput
          ref={inputRef}
          style={styles.promoInput}
          placeholder="Enter code"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={code}
          onChangeText={t => {
            setCode(t.toUpperCase());
            setError(null);
            setSuccess(false);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void handleApply()}
          editable={!loading}
          maxLength={20}
          includeFontPadding={false}
        />
        <Pressable
          style={[styles.promoApplyBtn, (loading || code.trim().length < 4) && styles.promoApplyBtnDisabled]}
          onPress={() => void handleApply()}
          disabled={loading || code.trim().length < 4}
          accessibilityRole="button"
          accessibilityLabel="Apply promo code">
          {loading ? (
            <ActivityIndicator size="small" color={GOLD} />
          ) : (
            <Text style={styles.promoApplyText}>Apply</Text>
          )}
        </Pressable>
      </View>
      {error != null && <Text style={styles.promoInputError}>{error}</Text>}
      {success && <Text style={styles.promoInputSuccess}>Code applied!</Text>}
    </View>
  );
}

export function PaywallScreen() {
  const scrollInsets = useModalScrollInsets(24);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const _hydrateFromRC = useHertzStore(s => s._hydrateFromRC);
  const appliedPromoCode = useHertzStore(s => s.appliedPromoCode);
  const appliedPromoEntitlement = useHertzStore(s => s.appliedPromoEntitlement);
  const clearPromo = useHertzStore(s => s.clearPromo);

  const [plans, setPlans] = useState<PaywallPlan[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeUnavailableDetail, setStoreUnavailableDetail] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const subscriptionSummary = useMemo(
    () => summarizeActiveSubscription(customerInfo, ENTITLEMENT_ID),
    [customerInfo],
  );

  const loadCustomerInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      _hydrateFromRC(info, ENTITLEMENT_ID);
      return info;
    } catch {
      return null;
    }
  }, [_hydrateFromRC]);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    setPlans([]);
    setFetchError(null);
    setStoreUnavailableDetail(null);

    void loadCustomerInfo();
    const result = await loadPaywallPackages();

    if (__DEV__) {
      console.log('[Paywall] load result:', result.status);
    }

    switch (result.status) {
      case 'ready':
        setPlans(result.plans);
        break;
      case 'not_configured':
        setFetchError(
          Platform.OS === 'android'
            ? 'RevenueCat Android API key missing. Add REVENUECAT_API_KEY_ANDROID (goog_…) to react-native-app/.env, rebuild the app, then reopen the paywall.'
            : 'RevenueCat API key missing. Add REVENUECAT_API_KEY_IOS to react-native-app/.env, rebuild the app, then reopen the paywall.',
        );
        break;
      case 'store_unavailable':
        setPlans(result.plans ?? []);
        setStoreUnavailableDetail(result.detail);
        break;
      case 'error':
        setFetchError(result.message);
        break;
      default:
        break;
    }

    setLoading(false);
  }, [loadCustomerInfo]);

  React.useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const handlePurchase = useCallback(
    async (plan: PaywallPlan) => {
      if (purchasing) {
        return;
      }
      if (!isPurchasable(plan)) {
        Alert.alert(
          'Not Available Yet',
          storeUnavailableDetail ??
            'Plans are still being configured. Please check back shortly or contact support.',
          [{text: 'OK'}],
        );
        return;
      }
      setPurchasing(true);
      try {
        const discountEntitlement = normalizePromoEntitlement(appliedPromoEntitlement);
        const isDiscountPromo =
          discountEntitlement === 'discount_2mo' || discountEntitlement === 'discount_6mo';
        const result =
          isDiscountPromo && plan.pkg != null
            ? await purchaseWithOffer(plan.pkg, discountEntitlement)
            : plan.pkg != null
              ? await Purchases.purchasePackage(plan.pkg)
              : await Purchases.purchaseStoreProduct(plan.storeProduct!);
        setCustomerInfo(result.customerInfo);
        _hydrateFromRC(result.customerInfo, ENTITLEMENT_ID);
        if (isDiscountPromo) {
          clearPromo();
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
    [purchasing, storeUnavailableDetail, _hydrateFromRC, dismiss, appliedPromoEntitlement, clearPromo],
  );

  const handleRestore = useCallback(async () => {
    if (restoring) {
      return;
    }
    setRestoring(true);
    try {
      const info: CustomerInfo = await Purchases.restorePurchases();
      setCustomerInfo(info);
      _hydrateFromRC(info, ENTITLEMENT_ID);
      const isActive = Object.keys(info.entitlements.active).includes(ENTITLEMENT_ID);
      Alert.alert(
        isActive ? 'Restored' : 'Nothing to Restore',
        isActive
          ? 'Your Premium subscription has been restored.'
          : PAYWALL_STORE.restoreEmptyMessage,
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

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Hertz Labs Premium</Text>
            <Text style={styles.subtitle}>
              {subscriptionSummary.isPremium
                ? 'View your plan or switch subscriptions'
                : 'Unlock the full frequency spectrum'}
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close paywall">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          keyboardShouldPersistTaps="handled">
          <ActiveSubscriptionCard summary={subscriptionSummary} />

          {/* Active promo banner */}
          {appliedPromoCode != null && appliedPromoEntitlement != null && (
            <ActivePromoBar
              code={appliedPromoCode}
              entitlement={appliedPromoEntitlement}
              onClear={clearPromo}
            />
          )}

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

            {!loading && storeUnavailableDetail != null && (
              <StoreUnavailableCard
                detail={storeUnavailableDetail}
                onRetry={() => void loadOfferings()}
                retrying={loading}
              />
            )}

            {!loading && storeUnavailableDetail == null && fetchError != null && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>Could not load plans</Text>
                <Text style={styles.errorHint}>{fetchError}</Text>
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => void loadOfferings()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading subscription plans">
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {plans.map(item => (
              <PackageCard
                key={item.key}
                item={item}
                onPurchase={handlePurchase}
                purchasing={purchasing}
                isCurrentPlan={
                  subscriptionSummary.planKey === item.key ||
                  planProductId(item) === subscriptionSummary.productId
                }
              />
            ))}
          </View>

          {/* Inline promo code input */}
          <PromoCodeInput onApplied={() => {}} />

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
          <Text style={styles.legalText}>{PAYWALL_STORE.legalDisclaimer}</Text>

          <LegalMenuBar />
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
  activeCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    gap: 4,
  },
  activeCardPremium: {
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
  },
  activeCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
  },
  activePlanName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  activeStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  activeDetail: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },
  manageBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
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
  buyBtnCurrent: {
    opacity: 1,
    borderColor: 'rgba(92,225,255,0.35)',
    backgroundColor: 'rgba(92,225,255,0.1)',
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
  buyBtnTextCurrent: {
    color: HertzTheme.neon.cyan,
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
  checklistItem: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 17,
    marginTop: 6,
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
  },
  retryBtnDisabled: {
    opacity: 0.6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
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
  promoInputWrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    gap: 8,
  },
  promoInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    minWidth: 0,
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
  },
  promoApplyBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  promoApplyBtnDisabled: {
    opacity: 0.4,
  },
  promoApplyText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  promoInputError: {
    fontSize: 12,
    color: '#F87171',
  },
  promoInputSuccess: {
    fontSize: 12,
    color: HertzTheme.neon.lime,
    fontWeight: '600',
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    gap: 10,
  },
  promoBannerIcon: {
    fontSize: 20,
  },
  promoBannerInfo: {
    flex: 1,
    gap: 2,
  },
  promoBannerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.2,
  },
  promoBannerCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  promoRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoRemoveText: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '600',
  },
});
