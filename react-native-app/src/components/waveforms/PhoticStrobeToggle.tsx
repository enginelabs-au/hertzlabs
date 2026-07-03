import React, {useCallback} from 'react';
import {Alert, StyleSheet, Switch, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {macScaledFont} from '../../platform/macTypography';

const PHOTIC_CONSENT_TITLE = 'Photosensitive epilepsy warning';
const PHOTIC_CONSENT_MESSAGE =
  'Photic Strobe flashes the screen at your selected entrainment frequency. ' +
  'Rapid, rhythmic light can trigger seizures in people with photosensitive epilepsy or ' +
  'related conditions.\n\n' +
  'Do not use this feature if you have ever experienced seizures, unexplained blackouts, ' +
  'or sensitivity to flashing lights. Stop immediately if you feel dizzy, nauseous, or unwell.\n\n' +
  'By continuing, you confirm you understand these risks.';

export function PhoticStrobeToggle() {
  const enabled = useHertzStore(s => s.photicStrobeEnabled);
  const consentGiven = useHertzStore(s => s.photicStrobeConsentGiven);
  const setEnabled = useHertzStore(s => s.setPhoticStrobeEnabled);
  const setConsentGiven = useHertzStore(s => s.setPhoticStrobeConsentGiven);

  const enableAfterConsent = useCallback(() => {
    setConsentGiven(true);
    setEnabled(true);
  }, [setConsentGiven, setEnabled]);

  const onToggle = useCallback(
    (next: boolean) => {
      if (!next) {
        setEnabled(false);
        return;
      }
      if (consentGiven) {
        setEnabled(true);
        return;
      }
      Alert.alert(PHOTIC_CONSENT_TITLE, PHOTIC_CONSENT_MESSAGE, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'I Agree', style: 'destructive', onPress: enableAfterConsent},
      ]);
    },
    [consentGiven, enableAfterConsent, setEnabled],
  );

  return (
    <View style={styles.row}>
      <View style={styles.labelCol}>
        <Text style={styles.label}>Photic Strobe</Text>
        <Text style={styles.hint}>Trace colours flash at beat frequency (photic palette)</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{false: HertzTheme.glassBorder, true: HertzTheme.neon.magenta}}
        thumbColor={enabled ? HertzTheme.neon.magenta : HertzTheme.text.muted}
        accessibilityLabel="Photic strobe toggle"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  labelCol: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontSize: macScaledFont(10),
    fontWeight: '700',
    letterSpacing: 0.6,
    color: HertzTheme.text.primary,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 10,
    lineHeight: 14,
    color: HertzTheme.text.muted,
  },
});
