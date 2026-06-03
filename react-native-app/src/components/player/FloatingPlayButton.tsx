import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

export function FloatingPlayButton() {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const requestPlay = useHertzStore(s => s.requestPlay);
  const requestPause = useHertzStore(s => s.requestPause);

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <Pressable
        style={[styles.btn, isPlaying ? styles.btnPlaying : styles.btnIdle]}
        onPress={() => (isPlaying ? requestPause() : requestPlay())}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
        <Text style={[styles.icon, isPlaying && styles.iconPause]}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    zIndex: 100,
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: HertzTheme.neon.lime,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  btnIdle: {
    backgroundColor: HertzTheme.play.idle,
  },
  btnPlaying: {
    backgroundColor: HertzTheme.play.playing,
  },
  icon: {
    fontSize: 22,
    color: '#1a1a2e',
    marginLeft: 3,
  },
  iconPause: {
    marginLeft: 0,
    color: HertzTheme.play.pause,
  },
});
