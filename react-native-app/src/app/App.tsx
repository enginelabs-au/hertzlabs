import React, {Component, type ErrorInfo, type ReactNode, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {useHertzStore} from '../state/store';
import {SafetyOnboardingScreen} from '../screens/SafetyOnboardingScreen';
import {useRevenueCatBoot} from './hooks/useRevenueCatBoot';
import {MainTabs} from '../navigation/MainTabs';
import {installAudioSync} from '../state/middleware/audioSync';
import {HertzAudioClient} from '../audio/HertzAudioClient';
import {isHertzAudioTurboModuleLinked} from '../audio/nativeAudioLink';
import {HertzTheme} from '../theme/hertzTheme';

const BG = HertzTheme.bg;

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
  const hasAcceptedSafetyTerms = useHertzStore(s => s.hasAcceptedSafetyTerms);

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
    const bufferMs = __DEV__ && Platform.OS === 'ios' ? 23 : 10;
    // Request the highest sample rate the hardware will grant (Nyquist up to
    // ~96 kHz) so Experimental-mode ultrasonic tones render instead of aliasing
    // back down. The OS negotiates down to 48 kHz on devices that cap there.
    HertzAudioClient.configure(192000, bufferMs);
    const uninstall = installAudioSync(useHertzStore);
    return uninstall;
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={HertzTheme.neon.cyan} size="large" />
        <Text style={styles.bootText}>Loading Hertz Labs…</Text>
      </View>
    );
  }

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
      {hasAcceptedSafetyTerms ? <MainTabs /> : <SafetyOnboardingScreen />}
    </>
  );
}

export function App(): React.JSX.Element {
  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <SafeAreaView style={styles.safe}>
          <AppContent />
        </SafeAreaView>
      </GestureHandlerRootView>
    </RootErrorBoundary>
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
