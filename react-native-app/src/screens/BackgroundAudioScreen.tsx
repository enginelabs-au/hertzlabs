import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';

const BG = '#000000';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#4ADE80';
const MUTED = 'rgba(255,255,255,0.38)';
const LOCK_COLOR = 'rgba(251,191,36,0.7)';
const WARN = '#FBBF24';

function SpotifyPanel({unlocked}: {unlocked: boolean}) {
  const [connected, setConnected] = useState(false);

  if (!unlocked) {
    return (
      <View style={styles.spotifyCard}>
        <View style={styles.spotifyHeader}>
          <View style={styles.spotifyLogo}>
            <Text style={styles.spotifyLogoText}>♪</Text>
          </View>
          <View style={styles.spotifyInfo}>
            <Text style={styles.spotifyTitle}>Spotify Integration</Text>
            <Text style={styles.spotifySubtitle}>
              Layer Spotify playback under your binaural beats
            </Text>
          </View>
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>PRO</Text>
          </View>
        </View>
        <View style={styles.spotifyLocked}>
          <Text style={styles.spotifyLockedText}>
            Connect Spotify Premium to blend music with entrainment frequencies.
            Background playback is maintained automatically.
          </Text>
          <View style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>🔒 Upgrade to Unlock</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.spotifyCard}>
      <View style={styles.spotifyHeader}>
        <View style={[styles.spotifyLogo, styles.spotifyLogoActive]}>
          <Text style={styles.spotifyLogoText}>♪</Text>
        </View>
        <View style={styles.spotifyInfo}>
          <Text style={styles.spotifyTitle}>Spotify</Text>
          <Text style={styles.spotifySubtitle}>
            {connected ? 'Connected — Hertz Labs Premium' : 'Not connected'}
          </Text>
        </View>
        {connected && (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedBadgeText}>● LIVE</Text>
          </View>
        )}
      </View>

      {connected ? (
        <View style={styles.spotifyPlaying}>
          <View style={styles.nowPlayingCard}>
            <View style={styles.albumArtPlaceholder}>
              <Text style={styles.albumArtIcon}>♫</Text>
            </View>
            <View style={styles.nowPlayingInfo}>
              <Text style={styles.nowPlayingTrack}>Ambient Soundscape</Text>
              <Text style={styles.nowPlayingArtist}>Music Modulation Active</Text>
            </View>
            <Pressable style={styles.pauseBtn} onPress={() => {}}>
              <Text style={styles.pauseBtnText}>⏸</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.disconnectBtn}
            onPress={() => setConnected(false)}>
            <Text style={styles.disconnectBtnText}>Disconnect Spotify</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.connectBtn}
          onPress={() => setConnected(true)}
          accessibilityRole="button">
          <Text style={styles.connectBtnText}>Connect Spotify</Text>
        </Pressable>
      )}
    </View>
  );
}

function MixingControls({unlocked}: {unlocked: boolean}) {
  const [beatVolume, setBeatVolume] = useState(0.7);
  const [musicVolume, setMusicVolume] = useState(0.4);

  if (!unlocked) {
    return (
      <View style={[styles.mixingCard, styles.lockedCard]}>
        <Text style={styles.sectionTitle}>Mixing Controls</Text>
        <Text style={styles.lockedText}>
          🔒 Premium — Adjust the balance between binaural beats and background audio.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mixingCard}>
      <Text style={styles.sectionTitle}>Mixing Controls</Text>
      <View style={styles.mixRow}>
        <Text style={styles.mixLabel}>Binaural Beats</Text>
        <View style={styles.mixBar}>
          <View style={[styles.mixFill, {width: `${beatVolume * 100}%` as `${number}%`, backgroundColor: ACCENT}]} />
        </View>
        <Pressable
          style={styles.mixAdj}
          onPress={() => setBeatVolume(v => Math.max(0, v - 0.05))}>
          <Text style={styles.mixAdjText}>−</Text>
        </Pressable>
        <Text style={styles.mixValue}>{(beatVolume * 100).toFixed(0)}%</Text>
        <Pressable
          style={styles.mixAdj}
          onPress={() => setBeatVolume(v => Math.min(1, v + 0.05))}>
          <Text style={styles.mixAdjText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.mixRow}>
        <Text style={styles.mixLabel}>Background Music</Text>
        <View style={styles.mixBar}>
          <View style={[styles.mixFill, {width: `${musicVolume * 100}%` as `${number}%`, backgroundColor: '#93C5FD'}]} />
        </View>
        <Pressable
          style={styles.mixAdj}
          onPress={() => setMusicVolume(v => Math.max(0, v - 0.05))}>
          <Text style={styles.mixAdjText}>−</Text>
        </Pressable>
        <Text style={styles.mixValue}>{(musicVolume * 100).toFixed(0)}%</Text>
        <Pressable
          style={styles.mixAdj}
          onPress={() => setMusicVolume(v => Math.min(1, v + 0.05))}>
          <Text style={styles.mixAdjText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BackgroundBehaviorSection({unlocked}: {unlocked: boolean}) {
  const backgroundAudio = useHertzStore(s => s.backgroundAudio);
  const updateSettings = useHertzStore(s => s.updateSettings);

  return (
    <View style={styles.bgBehaviorCard}>
      <Text style={styles.sectionTitle}>Background Behavior</Text>
      <View style={styles.bgRow}>
        <View style={styles.bgRowLeft}>
          <Text style={styles.bgRowLabel}>Continue playing when minimised</Text>
          <Text style={styles.bgRowDesc}>
            {unlocked
              ? 'Premium: audio maintains background playback via audio session.'
              : 'Free: audio stops when the app is minimised. Upgrade for background playback.'}
          </Text>
        </View>
        <Pressable
          style={[styles.toggle, backgroundAudio && unlocked && styles.toggleOn]}
          onPress={() => {
            if (unlocked) {
              updateSettings({backgroundAudio: !backgroundAudio});
            }
          }}
          disabled={!unlocked}>
          <View style={[styles.toggleThumb, backgroundAudio && unlocked && styles.toggleThumbOn]} />
        </Pressable>
      </View>
      {!unlocked && (
        <View style={styles.bgWarnRow}>
          <Text style={styles.bgWarnText}>
            🔒 Background playback requires Premium.
          </Text>
        </View>
      )}
    </View>
  );
}

export function BackgroundAudioScreen() {
  const tier = useHertzStore(s => s.tier);
  const unlocked = isPremiumUnlocked(tier);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Background Audio</Text>
        <Text style={styles.headerSubtitle}>
          Spotify integration & background playback settings
        </Text>
      </View>

      {/* Spotify Panel */}
      <SpotifyPanel unlocked={unlocked} />

      {/* Mixing Controls */}
      <MixingControls unlocked={unlocked} />

      {/* Background Behavior */}
      <BackgroundBehaviorSection unlocked={unlocked} />

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>ℹ</Text>
        <Text style={styles.infoText}>
          Audio sessions are managed by{' '}
          <Text style={styles.infoBold}>AVAudioSession</Text> on iOS.
          Enable <Text style={styles.infoBold}>Background Modes → Audio</Text> in
          Xcode capabilities for background playback to persist after screen lock.
        </Text>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    gap: 4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: MUTED,
  },
  spotifyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  spotifyLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyLogoActive: {
    backgroundColor: '#1DB954',
  },
  spotifyLogoText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  spotifyInfo: {
    flex: 1,
  },
  spotifyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spotifySubtitle: {
    fontSize: 12,
    color: MUTED,
    marginTop: 1,
  },
  spotifyLocked: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  spotifyLockedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
  },
  spotifyPlaying: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  nowPlayingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  albumArtPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArtIcon: {
    fontSize: 18,
    color: '#000',
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingTrack: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nowPlayingArtist: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  pauseBtn: {
    padding: 8,
  },
  pauseBtnText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  disconnectBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  disconnectBtnText: {
    fontSize: 12,
    color: 'rgba(239,68,68,0.8)',
    fontWeight: '600',
  },
  connectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(29,185,84,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.4)',
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1DB954',
    letterSpacing: 0.5,
  },
  connectBtn: {
    backgroundColor: '#1DB954',
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  lockBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: LOCK_COLOR,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: LOCK_COLOR,
    letterSpacing: 1,
  },
  upgradeBtn: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1,
    borderColor: LOCK_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: WARN,
  },
  mixingCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 14,
  },
  lockedCard: {
    opacity: 0.6,
    borderColor: 'rgba(251,191,36,0.15)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lockedText: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mixLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    width: 110,
  },
  mixBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  mixFill: {
    height: '100%',
    borderRadius: 2,
  },
  mixAdj: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixAdjText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 16,
    fontWeight: '700',
  },
  mixValue: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    width: 30,
    textAlign: 'right',
  },
  bgBehaviorCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  bgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bgRowLeft: {
    flex: 1,
    gap: 4,
  },
  bgRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bgRowDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: ACCENT,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  bgWarnRow: {
    paddingTop: 4,
  },
  bgWarnText: {
    fontSize: 12,
    color: LOCK_COLOR,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(147,197,253,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.15)',
    padding: 12,
    gap: 10,
  },
  infoIcon: {
    fontSize: 14,
    color: 'rgba(147,197,253,0.8)',
    paddingTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(147,197,253,0.7)',
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '700',
    color: 'rgba(147,197,253,0.9)',
  },
  bottomPad: {
    height: 20,
  },
});
