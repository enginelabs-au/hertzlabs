import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {BlurView} from '@sbaiahmed1/react-native-blur';
import {AmbientNoiseSelector} from '../components/EngineSelector/AmbientNoiseSelector';
import {EngineSelector} from '../components/EngineSelector/EngineSelector';
import {EngineDialSection} from '../components/engines/EngineDialSection';
import {ChannelReadoutRow} from '../components/layout/ChannelReadoutRow';
import {CategoryTabBar, type EngineCategoryId} from '../components/layout/CategoryTabBar';
import {useDialSharedValues} from '../components/CircularController/useDialSharedValues';
import {useHertzStore} from '../state/store';
import {DEFAULT_CARRIER_HZ} from '../audio/paramMapping';
import {
  isExperimentalModeActive,
  isPremiumUnlocked,
} from '../monetization/isPremiumUnlocked';
import {HertzTheme} from '../theme/hertzTheme';

function VolumeWarningBanner() {
  return (
    <View style={styles.volWarningBanner}>
      <Text style={styles.volWarningText}>
        ⚠ Device volume above 75% — reduce volume to protect hearing
      </Text>
    </View>
  );
}

function KineticIndicator({active}: {active: boolean}) {
  if (!active) {
    return null;
  }
  return (
    <View style={styles.kineticBadge}>
      <Text style={styles.kineticText}>◎ KINETIC</Text>
    </View>
  );
}

/**
 * Engines tab — reference layout: L/TARGET/R readouts, dial hub, category tabs,
 * accordion engine list, play + kinetic controls.
 */
export function PlayerScreen() {
  const [category, setCategory] = useState<EngineCategoryId>('entrainment');
  const highVolumeWarning = useHertzStore(s => s.highVolumeWarningTriggered);
  const isKineticModeEnabled = useHertzStore(s => s.isKineticModeEnabled);
  const tier = useHertzStore(s => s.tier);
  const experimentalMode = useHertzStore(s => s.experimentalMode);
  const experimental = isExperimentalModeActive(tier, experimentalMode);
  const premiumUnlocked = isPremiumUnlocked(tier);
  const updateSettings = useHertzStore(s => s.updateSettings);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const setParam = useHertzStore(s => s.setParam);
  const isPlaying = useHertzStore(s => s.isPlaying);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const requestPause = useHertzStore(s => s.requestPause);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  const toggleExperimental = () => {
    if (!premiumUnlocked) {
      if (experimentalMode) {
        updateSettings({experimentalMode: false});
        setParam('carrierHz', DEFAULT_CARRIER_HZ);
      } else {
        openPaywall();
      }
      return;
    }
    const next = !experimentalMode;
    updateSettings({experimentalMode: next});
    setParam('carrierHz', DEFAULT_CARRIER_HZ);
  };

  // Own the dial shared values here so the TARGET / L / R readout row and the
  // dial hub share the same UI-thread values (readouts follow the slider live).
  const dialValues = useDialSharedValues();

  return (
    <View style={styles.screen}>
      {highVolumeWarning && <VolumeWarningBanner />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        <ChannelReadoutRow dialValues={dialValues} />
        <EngineDialSection dialValues={dialValues} />
        <CategoryTabBar active={category} onChange={setCategory} />
        {category === 'ambient' ? (
          <AmbientNoiseSelector />
        ) : (
          <EngineSelector category={category} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="systemChromeMaterialDark"
          blurAmount={22}
          overlayColor="rgba(8,10,18,0.28)"
          reducedTransparencyFallbackColor="#0A0C12"
        />
        <Pressable
          style={[styles.playBtn, isPlaying && styles.playBtnActive]}
          onPress={() => (isPlaying ? requestPause() : requestPlay())}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <Text style={styles.playBtnIcon}>▶</Text>
          )}
          <Text style={styles.playBtnLabel}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
        </Pressable>
        <View style={styles.bottomControls}>
          <KineticIndicator active={isKineticModeEnabled} />
          <Pressable
            style={[styles.kineticToggle, isKineticModeEnabled && styles.kineticToggleActive]}
            onPress={() => updateSettings({isKineticModeEnabled: !isKineticModeEnabled})}
            accessibilityRole="switch"
            accessibilityState={{checked: isKineticModeEnabled}}>
            <Text style={[styles.kineticToggleText, isKineticModeEnabled && styles.kineticToggleTextActive]}>
              {isKineticModeEnabled ? '◎ Kinetic ON' : '◎ Kinetic OFF'}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.kineticToggle,
              experimental && styles.expToggleActive,
              !premiumUnlocked && styles.expToggleLocked,
            ]}
            onPress={toggleExperimental}
            accessibilityRole="switch"
            accessibilityState={{checked: experimental, disabled: !premiumUnlocked && !experimentalMode}}
            accessibilityLabel="Experimental mode">
            <Text
              style={[
                styles.kineticToggleText,
                experimental && styles.expToggleTextActive,
                !premiumUnlocked && !experimental && styles.expToggleTextLocked,
              ]}>
              {!premiumUnlocked && !experimentalMode
                ? '🔒 Experimental'
                : experimental
                  ? '⚗ Experimental ON'
                  : '⚗ Experimental OFF'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 124,
  },
  volWarningBanner: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251,191,36,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  volWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: HertzTheme.neon.amber,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  playBtnActive: {
    borderColor: HertzTheme.neon.lime,
    backgroundColor: 'rgba(190,246,100,0.15)',
  },
  playBtnIcon: {
    fontSize: 18,
    lineHeight: 20,
    height: 20,
    width: 20,
    textAlign: 'center',
    color: HertzTheme.neon.lime,
  },
  pauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
    width: 20,
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 15,
    borderRadius: 2,
    backgroundColor: HertzTheme.neon.lime,
  },
  playBtnLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 13,
    fontWeight: '700',
    color: HertzTheme.neon.lime,
    letterSpacing: 2,
    width: 54,
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  kineticBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(92,225,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.35)',
  },
  kineticText: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 1,
  },
  kineticToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  kineticToggleActive: {
    backgroundColor: 'rgba(92,225,255,0.12)',
    borderColor: 'rgba(92,225,255,0.35)',
  },
  kineticToggleText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    letterSpacing: 0.5,
  },
  kineticToggleTextActive: {
    color: HertzTheme.neon.cyan,
  },
  expToggleActive: {
    backgroundColor: 'rgba(234,247,255,0.14)',
    borderColor: 'rgba(234,247,255,0.55)',
  },
  expToggleTextActive: {
    color: '#EAF7FF',
  },
  expToggleLocked: {
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  expToggleTextLocked: {
    color: 'rgba(251,191,36,0.85)',
  },
});
