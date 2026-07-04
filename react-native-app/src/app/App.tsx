import React, {Component, Suspense, type ErrorInfo, type ReactNode, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {useHertzStore} from '../state/store';
import {SafetyOnboardingScreen} from '../screens/SafetyOnboardingScreen';
import {useRevenueCatBoot} from './hooks/useRevenueCatBoot';
import {usePromoRewardBoot} from './hooks/usePromoRewardBoot';
import {MainTabs} from '../navigation/MainTabs';
import {useGrowthEngagement} from '../hooks/useGrowthEngagement';
import {useFocusChallengeEngagement} from '../hooks/useFocusChallengeEngagement';
import {useStreakNotificationSchedule} from '../hooks/useStreakNotificationSchedule';
import {useStreakNotificationPress} from '../hooks/useStreakNotificationPress';
import {streakEngagementHandlers, useStreakEngagement} from '../hooks/useStreakEngagement';
import {FocusChallengeSessionBar} from '../components/promos/FocusChallengeSessionBar';
import {shouldShowForceUpdateOverlay} from '../state/slices/growth';
import {subscribeToReferralLinks} from '../services/referralLinkService';
import {reportReferralInstall} from '../services/referralTrackingService';
import {installAudioSync} from '../state/middleware/audioSync';
import {installBreathPacerSync} from '../state/middleware/breathPacerSync';
import {installProtocolSync} from '../state/middleware/protocolSync';
import {HertzAudioClient} from '../audio/HertzAudioClient';
import {isHertzAudioTurboModuleLinked} from '../audio/nativeAudioLink';
import {HertzTheme} from '../theme/hertzTheme';
import {summarizeActiveSubscription} from '../monetization/activeSubscriptionSummary';
import Purchases from 'react-native-purchases';

const BG = HertzTheme.bg;

const LegalScreen = React.lazy(() =>
  import('../screens/LegalScreen').then(m => ({default: m.LegalScreen})),
);
const PaywallScreen = React.lazy(() =>
  import('../screens/PaywallScreen').then(m => ({default: m.PaywallScreen})),
);
const FeedbackScreen = React.lazy(() =>
  import('../screens/FeedbackScreen').then(m => ({default: m.FeedbackScreen})),
);
const PromoRedemptionModal = React.lazy(() =>
  import('../screens/PromoRedemptionModal').then(m => ({default: m.PromoRedemptionModal})),
);
const PromosScreen = React.lazy(() =>
  import('../screens/PromosScreen').then(m => ({default: m.PromosScreen})),
);
const WellnessCheckinModal = React.lazy(() =>
  import('../screens/WellnessCheckinModal').then(m => ({default: m.WellnessCheckinModal})),
);
const WelcomePremiumModal = React.lazy(() =>
  import('../screens/WelcomePremiumModal').then(m => ({default: m.WelcomePremiumModal})),
);
const RequiredUpdateModal = React.lazy(() =>
  import('../screens/RequiredUpdateModal').then(m => ({default: m.RequiredUpdateModal})),
);
const PremiumGiftExpiryModal = React.lazy(() =>
  import('../screens/PremiumGiftExpiryModal').then(m => ({default: m.PremiumGiftExpiryModal})),
);
const CancellationWinbackModal = React.lazy(() =>
  import('../screens/CancellationWinbackModal').then(m => ({default: m.CancellationWinbackModal})),
);
const StreakRestoreModal = React.lazy(() =>
  import('../screens/StreakRestoreModal').then(m => ({default: m.StreakRestoreModal})),
);
const LapsedWinbackModal = React.lazy(() =>
  import('../screens/LapsedWinbackModal').then(m => ({default: m.LapsedWinbackModal})),
);
const FocusChallengeBriefingModal = React.lazy(() =>
  import('../screens/FocusChallengeBriefingModal').then(m => ({default: m.FocusChallengeBriefingModal})),
);
const FocusChallengeReflectionModal = React.lazy(() =>
  import('../screens/FocusChallengeReflectionModal').then(m => ({default: m.FocusChallengeReflectionModal})),
);
const TheScienceScreen = React.lazy(() =>
  import('../screens/TheScienceScreen').then(m => ({default: m.TheScienceScreen})),
);

function ModalLayer({activeModal}: {activeModal: string | null}) {
  const streakDays = useHertzStore(s => s.streakDays);
  const peakStreakDays = useHertzStore(s => s.peakStreakDays);

  if (activeModal == null) {
    return null;
  }

  const streakHandlers = streakEngagementHandlers();

  return (
    <Suspense fallback={null}>
      {activeModal === 'legal' && <LegalScreen />}
      {activeModal === 'paywall' && <PaywallScreen />}
      {activeModal === 'feedback' && <FeedbackScreen />}
      {activeModal === 'science' && <TheScienceScreen />}
      {activeModal === 'promos' && <PromosScreen />}
      {activeModal === 'promo' && <PromoRedemptionModal />}
      {activeModal === 'wellnessCheckin' && <WellnessCheckinModal />}
      {activeModal === 'welcomePremium' && <WelcomePremiumModal />}
      {activeModal === 'premiumGiftExpiry' && <PremiumGiftExpiryModal />}
      {activeModal === 'streakRestore' && (
        <StreakRestoreModal
          streakDays={streakDays}
          peakStreakDays={peakStreakDays}
          shieldsRemaining={streakHandlers.shieldsRemaining}
          onAccept={streakHandlers.onAcceptRestore}
          onDecline={streakHandlers.onDeclineRestore}
          onUseShield={streakHandlers.onUseShield}
        />
      )}
      {activeModal === 'lapsedWinback7' && (
        <LapsedWinbackModal
          peakStreakDays={peakStreakDays}
          includePremiumOffer={false}
          onRestore={streakHandlers.onLapsed7Restore}
          onDecline={streakHandlers.onLapsed7Decline}
        />
      )}
      {activeModal === 'lapsedWinback30' && (
        <LapsedWinbackModal
          peakStreakDays={peakStreakDays}
          includePremiumOffer
          onRestore={streakHandlers.onLapsed30Restore}
          onDecline={streakHandlers.onLapsed30Decline}
        />
      )}
      {activeModal === 'focusChallengeBriefing' && <FocusChallengeBriefingModal />}
      {activeModal === 'focusChallengeReflection' && <FocusChallengeReflectionModal />}
      {activeModal === 'cancellationWinback' && <PaywallCancellationWinback />}
    </Suspense>
  );
}

function PaywallCancellationWinback() {
  const [summary, setSummary] = React.useState<
    import('../monetization/activeSubscriptionSummary').ActiveSubscriptionSummary | null
  >(null);
  React.useEffect(() => {
    void Purchases.getCustomerInfo().then(info => {
      setSummary(summarizeActiveSubscription(info));
    });
  }, []);
  if (summary == null) {
    return null;
  }
  return <CancellationWinbackModal summary={summary} />;
}

type BoundaryState = {error: Error | null};

/**
 * Surfaces silent JS-thread crashes (Skia, TurboModule, store) on screen.
 */
class RootErrorBoundary extends Component<{children: ReactNode}, BoundaryState> {
  state: BoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    const {error} = this.state;
    if (error != null) {
      return (
        <SafeAreaView style={styles.errorRoot}>
          <Text style={styles.errorTitle}>Hertz Labs — runtime error</Text>
          <Text style={styles.errorMessage} selectable>
            {error.message}
          </Text>
          {error.stack != null && (
            <Text style={styles.errorStack} selectable>
              {error.stack}
            </Text>
          )}
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useHertzStore.persist.hasHydrated());

  useEffect(() => {
    if (useHertzStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useHertzStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    void Promise.resolve(useHertzStore.persist.rehydrate()).catch((err: unknown) => {
      console.warn('[App] store rehydrate failed, continuing with defaults:', err);
      setHydrated(true);
    });
    const safety = setTimeout(() => setHydrated(true), 2500);
    return () => {
      unsub();
      clearTimeout(safety);
    };
  }, []);

  return hydrated;
}

function AppContent(): React.JSX.Element {
  useRevenueCatBoot();
  const hydrated = useStoreHydrated();
  usePromoRewardBoot();
  const hasAcceptedSafetyTerms = useHertzStore(s => s.hasAcceptedSafetyTerms);
  const forceUpdateRequired = useHertzStore(s => s.forceUpdateRequired);
  const forceUpdateDismissedAtLaunch = useHertzStore(s => s.forceUpdateDismissedAtLaunch);
  const appLaunchCount = useHertzStore(s => s.appLaunchCount);
  const activeModal = useHertzStore(s => s.activeModal);

  useGrowthEngagement(hydrated, hydrated && hasAcceptedSafetyTerms);
  useStreakEngagement(hydrated, hydrated && hasAcceptedSafetyTerms);
  useStreakNotificationSchedule(hydrated && hasAcceptedSafetyTerms);
  useStreakNotificationPress(hydrated && hasAcceptedSafetyTerms);
  useFocusChallengeEngagement(hydrated, hydrated && hasAcceptedSafetyTerms);

  // Legacy referral deep links — analytics only (v3 rewards use manual HZ codes on Plans).
  useEffect(() => {
    const setPendingReferrerCode = useHertzStore.getState().setPendingReferrerCode;
    return subscribeToReferralLinks(referralCode => {
      if (__DEV__) {
        console.log('[Referral] Incoming link, referrer code:', referralCode);
      }
      setPendingReferrerCode(referralCode);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const pendingReferrerCode = useHertzStore.getState().pendingReferrerCode;
    if (pendingReferrerCode == null) {
      return;
    }
    void reportReferralInstall(pendingReferrerCode).then(reported => {
      if (reported) {
        useHertzStore.getState().clearPendingReferrerCode();
      }
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || hasAcceptedSafetyTerms) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [hydrated, hasAcceptedSafetyTerms]);

  // Wire Zustand state → native audio engine.  Runs once after hydration.
  useEffect(() => {
    if (!hydrated) { return; }
    // Configure native engine with default settings before subscribing.
    // 5 ms I/O on Simulator often crackles; use a safer buffer (still low-latency on device).
    const bufferMs =
      __DEV__ && Platform.OS === 'ios' ? 23 : Platform.OS === 'android' ? 23 : 10;
    // Request the highest sample rate the hardware will grant (Nyquist up to
    // ~96 kHz) so Experimental-mode ultrasonic tones render instead of aliasing
    // back down. The OS negotiates down to 48 kHz on devices that cap there.
    HertzAudioClient.configure(192000, bufferMs);
    const uninstallAudio = installAudioSync(useHertzStore);
    const uninstallProtocol = installProtocolSync(useHertzStore);
    const uninstallBreath = installBreathPacerSync({
      getState: useHertzStore.getState,
      setState: partial => {
        useHertzStore.setState(partial);
      },
      subscribe: useHertzStore.subscribe,
    });
    return () => {
      uninstallAudio();
      uninstallProtocol();
      uninstallBreath();
    };
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={HertzTheme.neon.cyan} size="large" />
        <Text style={styles.bootText}>Loading Hertz Labs…</Text>
      </View>
    );
  }

  const showForceUpdateOverlay = shouldShowForceUpdateOverlay({
    forceUpdateRequired,
    forceUpdateDismissedAtLaunch,
    appLaunchCount,
  });

  const nativeAudioLinked = isHertzAudioTurboModuleLinked();

  return (
    <>
      {__DEV__ && !nativeAudioLinked && (
        <View style={styles.audioWarn}>
          <Text style={styles.audioWarnText}>
            Native HertzAudio module not linked — rebuild iOS app (pod install + xcodebuild).
          </Text>
        </View>
      )}
      <View style={styles.shell}>
        <FocusChallengeSessionBar />
        {hasAcceptedSafetyTerms ? <MainTabs /> : <SafetyOnboardingScreen />}
      </View>
      <ModalLayer activeModal={activeModal} />
      {showForceUpdateOverlay && (
        <Suspense fallback={null}>
          <RequiredUpdateModal />
        </Suspense>
      )}
    </>
  );
}

export function App(): React.JSX.Element {
  const isMacDesktop = Platform.OS === 'ios' && Platform.isMacCatalyst === true;

  return (
    <SafeAreaProvider>
      <RootErrorBoundary>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar barStyle="light-content" backgroundColor={BG} translucent={false} />
          <SafeAreaView
            style={styles.safe}
            edges={isMacDesktop ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}>
            <AppContent />
          </SafeAreaView>
        </GestureHandlerRootView>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  shell: {
    flex: 1,
  },
  boot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bootText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
  },
  errorRoot: {
    flex: 1,
    backgroundColor: '#1a0a0a',
    padding: 20,
    justifyContent: 'center',
  },
  errorTitle: {
    color: '#F87171',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 16,
  },
  errorStack: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
  audioWarn: {
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioWarnText: {
    color: '#fecaca',
    fontSize: 12,
    textAlign: 'center',
  },
});
