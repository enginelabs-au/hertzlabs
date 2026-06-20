import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {BackgroundDopplerField} from '../components/background/BackgroundDopplerField';
import {ScreenScrollLayout} from '../components/layout/ScreenScrollLayout';
import {HertzTheme} from '../theme/hertzTheme';

const BG = HertzTheme.bg;
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#4ADE80';
const MUTED = 'rgba(255,255,255,0.38)';
const LOCK_COLOR = 'rgba(251,191,36,0.7)';

function SpotifyComingSoon() {
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
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonBadgeText}>SOON</Text>
        </View>
      </View>
      <View style={styles.spotifyComingSoonBody}>
        <Text style={styles.spotifyComingSoonText}>
          Native Spotify blending is in development. Once live, Premium users will be able to layer music directly under their entrainment frequencies with automatic level balancing.
        </Text>
        <View style={styles.tipRow}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            You can already play Spotify, Apple Music, or any other app alongside Hertz Labs — the audio sessions mix automatically. Just start your music in another app, then return here.
          </Text>
        </View>
      </View>
    </View>
  );
}

function BackgroundBehaviorSection({unlocked, onUpgrade}: {unlocked: boolean; onUpgrade: () => void}) {
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
        <Pressable style={styles.bgWarnRow} onPress={onUpgrade} accessibilityRole="button">
          <Text style={styles.bgWarnText}>
            🔒 Background playback requires Premium — tap to upgrade.
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function BackgroundAudioScreen() {
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const unlocked = isPremiumUnlocked(tier);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  return (
    <ScreenScrollLayout contentContainerStyle={styles.content}>
      <BackgroundDopplerField />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Background Audio</Text>
        <Text style={styles.headerSubtitle}>
          Background playback & music app compatibility
        </Text>
      </View>

      <SpotifyComingSoon />

      <BackgroundBehaviorSection unlocked={unlocked} onUpgrade={openPaywall} />

      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>ℹ</Text>
        <Text style={styles.infoText}>
          Hertz Labs uses <Text style={styles.infoBold}>mixWithOthers</Text> mode — your binaural beats will not interrupt music playing in other apps. Premium enables audio to continue when the app is minimised or the screen is locked.
        </Text>
      </View>
    </ScreenScrollLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
    gap: 4,
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
    lineHeight: 19,
  },
  sectionTitle: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  spotifyCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    overflow: 'hidden',
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  spotifyLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(29,185,84,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyLogoText: {
    fontSize: 20,
    color: '#1DB954',
  },
  spotifyInfo: {
    flex: 1,
    gap: 2,
  },
  spotifyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spotifySubtitle: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  comingSoonBadgeText: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    fontWeight: '800',
    color: LOCK_COLOR,
    letterSpacing: 0.8,
  },
  spotifyComingSoonBody: {
    padding: 16,
    gap: 12,
  },
  spotifyComingSoonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(92,225,255,0.06)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.15)',
  },
  tipIcon: {
    fontSize: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 17,
  },
  bgBehaviorCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16,
  },
  bgRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: 'rgba(74,222,128,0.25)',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
  },
  bgWarnRow: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  bgWarnText: {
    fontSize: 12,
    color: LOCK_COLOR,
    lineHeight: 17,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
    padding: 14,
  },
  infoIcon: {
    fontSize: 16,
    color: 'rgba(147,197,253,0.9)',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '700',
    color: 'rgba(147,197,253,0.9)',
  },
});
