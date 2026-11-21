import React, {useCallback} from 'react';
import {Alert, Linking, Platform, StyleSheet, Switch, Text, View} from 'react-native';
import {usePostHog} from 'posthog-react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {requestStreakNotificationPermission} from '../../notifications/streakNotifications';

/** Opt-in daily local reminders to keep a playback streak alive. Off by default. */
export function StreakRemindersToggle() {
  const posthog = usePostHog();
  const streakRemindersEnabled = useHertzStore(s => s.streakRemindersEnabled);
  const updateSettings = useHertzStore(s => s.updateSettings);

  const onToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        updateSettings({streakRemindersEnabled: false});
        posthog?.capture('streak reminders toggled', {enabled: false, source: 'promos'});
        return;
      }

      const granted = await requestStreakNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications off',
          Platform.OS === 'ios'
            ? 'Turn on notifications for Hertz Labs in Settings to receive daily streak reminders.'
            : 'Allow notifications for Hertz Labs to receive daily streak reminders.',
          [
            {text: 'Not now', style: 'cancel'},
            {text: 'Open Settings', onPress: () => void Linking.openSettings()},
          ],
        );
        return;
      }

      updateSettings({streakRemindersEnabled: true});
      posthog?.capture('streak reminders toggled', {enabled: true, source: 'promos'});
    },
    [updateSettings, posthog],
  );

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.label} maxFontSizeMultiplier={1.3}>
          Daily streak reminders
        </Text>
        <Text style={styles.hint} maxFontSizeMultiplier={1.3}>
          Evening local reminder if you have not yet logged 2 minutes of playback today
        </Text>
      </View>
      <Switch
        value={streakRemindersEnabled}
        onValueChange={onToggle}
        trackColor={{false: '#3a3a4a', true: 'rgba(92,225,255,0.35)'}}
        thumbColor={streakRemindersEnabled ? HertzTheme.neon.cyan : '#888'}
        accessibilityLabel="Daily streak reminders"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
