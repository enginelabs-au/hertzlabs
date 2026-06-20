import React, {useCallback, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
import {ScreenScrollLayout} from '../components/layout/ScreenScrollLayout';
import {HertzTheme} from '../theme/hertzTheme';
import {SimplePlayerScreen} from './SimplePlayerScreen';

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
 * Engines tab — L/TARGET/R readouts, dial hub, category tabs, accordion engine list,
 * kinetic/experimental toggles. Playback lives in the global TransportBar above tabs.
 */
export function PlayerScreen() {
  const isAdvancedMode = useHertzStore(s => s.isAdvancedMode);
  if (!isAdvancedMode) {
    return <SimplePlayerScreen />;
  }
  return <AdvancedPlayerScreen />;
}

function AdvancedPlayerScreen() {
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

      <ScreenScrollLayout>
        <ChannelReadoutRow dialValues={dialValues} />
        <EngineDialSection dialValues={dialValues} />
        <CategoryTabBar active={category} onChange={setCategory} />
        {category === 'ambient' ? (
          <AmbientNoiseSelector />
        ) : (
          <EngineSelector category={category} />
        )}

        <View style={styles.engineControls}>
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
      </ScreenScrollLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
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
  engineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
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
