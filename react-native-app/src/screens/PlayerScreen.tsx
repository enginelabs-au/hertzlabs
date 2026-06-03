import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {EngineSelector} from '../components/EngineSelector/EngineSelector';
import {EngineDialSection} from '../components/engines/EngineDialSection';
import {ChannelReadoutRow} from '../components/layout/ChannelReadoutRow';
import {CategoryTabBar, type EngineCategoryId} from '../components/layout/CategoryTabBar';
import {useHertzStore} from '../state/store';
import {useEngineModeModulation} from '../hooks/useEngineModeModulation';
import {useKineticModulation} from '../hooks/useKineticModulation';
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
  const updateSettings = useHertzStore(s => s.updateSettings);
  const isPlaying = useHertzStore(s => s.isPlaying);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const requestPause = useHertzStore(s => s.requestPause);

  useKineticModulation();
  useEngineModeModulation();

  return (
    <View style={styles.screen}>
      {highVolumeWarning && <VolumeWarningBanner />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        <ChannelReadoutRow />
        <EngineDialSection />
        <CategoryTabBar active={category} onChange={setCategory} />
        <EngineSelector category={category} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.playBtn, isPlaying && styles.playBtnActive]}
          onPress={() => (isPlaying ? requestPause() : requestPlay())}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          <Text style={styles.playBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
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
    paddingBottom: 16,
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
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: HertzTheme.bg,
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
    color: HertzTheme.neon.lime,
  },
  playBtnLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 13,
    fontWeight: '700',
    color: HertzTheme.neon.lime,
    letterSpacing: 2,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
});
