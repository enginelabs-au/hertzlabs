import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {useCallback} from 'react';
import {BackgroundDopplerField} from '../components/background/BackgroundDopplerField';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
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
    <View style={styles.screen}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <BackgroundDopplerField />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Background Audio</Text>
        <Text style={styles.headerSubtitle}>
          Background playback & music app compatibility
        </Text>
      </View>

      {/* Spotify Coming Soon */}
      <SpotifyComingSoon />

      {/* Background Behavior */}
      <BackgroundBehaviorSection unlocked={unlocked} onUpgrade={openPaywall} />

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>ℹ</Text>
        <Text style={styles.infoText}>
          Hertz Labs uses <Text style={styles.infoBold}>mixWithOthers</Text> mode — your binaural beats will not interrupt music playing in other apps. Premium enables audio to continue when the app is minimised or the screen is locked.
        </Text>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
    <LegalMenuBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
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
  spotifyComingSoonBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  spotifyComingSoonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(147,197,253,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.3)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  comingSoonBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(147,197,253,0.8)',
    letterSpacing: 1,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
    padding: 10,
  },
  tipIcon: {
    fontSize: 14,
    paddingTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(74,222,128,0.85)',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
