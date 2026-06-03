import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {CircularController} from '../components/CircularController/CircularController';
import {EngineSelector} from '../components/EngineSelector/EngineSelector';
import {useHertzStore} from '../state/store';
import {useKineticModulation} from '../hooks/useKineticModulation';

const BG = '#000000';
const ACCENT = '#4ADE80';
const WARN = '#FBBF24';
const MUTED = 'rgba(255,255,255,0.38)';
const MONO = 'JetBrainsMono-Regular';

type PlayerTab = 'player' | 'engines';

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
 * Primary Engines tab — shows the holographic dial + readout on the 'Player'
 * sub-tab and the engine selector on the 'Engines' sub-tab.
 */
export function PlayerScreen() {
  const [activeTab, setActiveTab] = useState<PlayerTab>('player');
  const highVolumeWarning = useHertzStore(s => s.highVolumeWarningTriggered);
  const isKineticModeEnabled = useHertzStore(s => s.isKineticModeEnabled);
  const updateSettings = useHertzStore(s => s.updateSettings);
  const isPlaying = useHertzStore(s => s.isPlaying);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const requestPause = useHertzStore(s => s.requestPause);

  // Activate kinematic modulation when enabled
  useKineticModulation();

  return (
    <View style={styles.screen}>
      {/* Volume warning */}
      {highVolumeWarning && <VolumeWarningBanner />}

      {/* Sub-tab switcher */}
      <View style={styles.subTabBar}>
        <Pressable
          style={[styles.subTab, activeTab === 'player' && styles.subTabActive]}
          onPress={() => setActiveTab('player')}>
          <Text style={[styles.subTabText, activeTab === 'player' && styles.subTabTextActive]}>
            Player
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTab, activeTab === 'engines' && styles.subTabActive]}
          onPress={() => setActiveTab('engines')}>
          <Text style={[styles.subTabText, activeTab === 'engines' && styles.subTabTextActive]}>
            Engines
          </Text>
        </Pressable>
      </View>

      {activeTab === 'player' ? (
        <View style={styles.playerContainer}>
          <CircularController />

          {/* Play / Pause button */}
          <Pressable
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={() => isPlaying ? requestPause() : requestPlay()}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
            <Text style={styles.playBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
            <Text style={styles.playBtnLabel}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
          </Pressable>

          {/* Bottom controls */}
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
      ) : (
        <EngineSelector />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
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
    color: WARN,
    textAlign: 'center',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
  },
  subTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: ACCENT,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.3,
  },
  subTabTextActive: {
    color: ACCENT,
  },
  playerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(74,222,128,0.4)',
    backgroundColor: 'rgba(74,222,128,0.07)',
  },
  playBtnActive: {
    borderColor: 'rgba(74,222,128,0.7)',
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  playBtnIcon: {
    fontSize: 18,
    color: ACCENT,
  },
  playBtnLabel: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 2,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  kineticBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(147,197,253,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
  },
  kineticText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(147,197,253,0.9)',
    letterSpacing: 1,
  },
  kineticToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  kineticToggleActive: {
    backgroundColor: 'rgba(147,197,253,0.12)',
    borderColor: 'rgba(147,197,253,0.35)',
  },
  kineticToggleText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.5,
  },
  kineticToggleTextActive: {
    color: 'rgba(147,197,253,0.9)',
  },
});
