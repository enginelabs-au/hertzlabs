import React, {useCallback} from 'react';
import {StyleSheet, Switch, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Background audio toggle for Simple Mode Engines page. */
export function BackgroundAudioToggle() {
  const backgroundAudio = useHertzStore(s => s.backgroundAudio);
  const updateSettings = useHertzStore(s => s.updateSettings);

  const onToggle = useCallback(
    (value: boolean) => updateSettings({backgroundAudio: value}),
    [updateSettings],
  );

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.label}>Keep Audio Playing in Background</Text>
        <Text style={styles.hint}>Continue sessions when the app is minimized</Text>
      </View>
      <Switch
        value={backgroundAudio}
        onValueChange={onToggle}
        trackColor={{false: '#3a3a4a', true: 'rgba(92,225,255,0.35)'}}
        thumbColor={backgroundAudio ? HertzTheme.neon.cyan : '#888'}
      />
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: HertzTheme.text.primary,
  },
  hint: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginTop: 4,
  },
});
