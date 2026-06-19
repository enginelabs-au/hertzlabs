import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BlurView} from '@sbaiahmed1/react-native-blur';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/**
 * Persistent playback strip — fixed above tab navigation, isolated from scroll content.
 */
export function TransportBar() {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const requestPause = useHertzStore(s => s.requestPause);

  return (
    <View style={styles.bar}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="systemChromeMaterialDark"
        blurAmount={20}
        overlayColor="rgba(8,10,18,0.32)"
        reducedTransparencyFallbackColor="#0A0C12"
      />
      <View style={styles.inner}>
        <View style={styles.sideSlot}>
          {isPlaying ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveDot} maxFontSizeMultiplier={1.0}>●</Text>
              <Text style={styles.liveLabel} maxFontSizeMultiplier={1.0}>LIVE</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[styles.transportBtn, isPlaying && styles.transportBtnActive]}
          onPress={() => (isPlaying ? requestPause() : requestPlay())}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause playback' : 'Play playback'}
          accessibilityState={{selected: isPlaying}}>
          {isPlaying ? (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <Text style={styles.playIcon} maxFontSizeMultiplier={1.0}>▶</Text>
          )}
          <Text style={[styles.transportLabel, isPlaying && styles.transportLabelActive]} maxFontSizeMultiplier={1.0}>
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </Text>
        </Pressable>

        <View style={styles.sideSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  sideSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    fontSize: 8,
    color: HertzTheme.neon.lime,
    lineHeight: 10,
  },
  liveLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '700',
    color: HertzTheme.neon.lime,
    letterSpacing: 1.2,
  },
  transportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.1)',
  },
  transportBtnActive: {
    borderColor: HertzTheme.neon.lime,
    backgroundColor: 'rgba(190,246,100,0.18)',
    shadowColor: HertzTheme.neon.lime,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 14,
    elevation: 10,
  },
  playIcon: {
    fontSize: 14,
    lineHeight: 16,
    height: 16,
    width: 16,
    textAlign: 'center',
    color: HertzTheme.neon.purple,
  },
  pauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 16,
    width: 16,
    gap: 3,
  },
  pauseBar: {
    width: 3,
    height: 13,
    borderRadius: 1.5,
    backgroundColor: HertzTheme.neon.lime,
  },
  transportLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.purple,
    letterSpacing: 1.8,
    width: 46,
    textAlign: 'center',
  },
  transportLabelActive: {
    color: HertzTheme.neon.lime,
  },
});
