import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {HertzTheme} from '../../theme/hertzTheme';

/** Background audio toggle for Simple Mode Engines page. Requires Premium. */
export function BackgroundAudioToggle() {
  const backgroundAudio = useHertzStore(s => s.backgroundAudio);
  const updateSettings = useHertzStore(s => s.updateSettings);
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const unlocked = isPremiumUnlocked(tier);

  const onToggle = useCallback(
    (value: boolean) => {
      if (!unlocked) {
        setActiveModal('paywall');
        return;
      }
      updateSettings({backgroundAudio: value});
    },
    [unlocked, updateSettings, setActiveModal],
  );

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <View style={styles.labelRow}>
          <Text style={styles.label} maxFontSizeMultiplier={1.3}>
            Keep Audio Playing in Background
          </Text>
          {!unlocked && (
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText} maxFontSizeMultiplier={1.0}>
                PREMIUM
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.hint} maxFontSizeMultiplier={1.3}>
          {unlocked
            ? 'Continue sessions when the app is minimized'
            : 'Upgrade to Premium to enable background playback'}
        </Text>
      </View>
      {unlocked ? (
        <Switch
          value={backgroundAudio}
          onValueChange={onToggle}
          trackColor={{false: '#3a3a4a', true: 'rgba(92,225,255,0.35)'}}
          thumbColor={backgroundAudio ? HertzTheme.neon.cyan : '#888'}
        />
      ) : (
        <Pressable
          style={styles.lockBtn}
          onPress={openPaywall}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to enable background audio">
          <Text style={styles.lockIcon}>🔒</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  textCol: {
    flex: 1,
    paddingRight: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: HertzTheme.text.primary,
  },
  lockBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 0.6,
  },
  hint: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginTop: 4,
  },
  lockBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 16,
  },
});
