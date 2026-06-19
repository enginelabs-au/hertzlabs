import React, {useCallback} from 'react';
import {Linking, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {APP_STORE_URL, PLAY_STORE_URL} from '../constants/appInfo';
import {HertzTheme} from '../theme/hertzTheme';

const GOLD = '#FBBF24';

/** Full-screen blocking prompt when a mandatory store update is required. */
export function RequiredUpdateModal() {
  const openStore = useCallback(() => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    void Linking.openURL(url);
  }, []);

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>UPDATE REQUIRED</Text>
        <Text style={styles.title}>Please update Hertz Labs</Text>
        <Text style={styles.body}>
          A newer version of the app is required to continue. Update from the{' '}
          {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} to keep using Hertz Labs without
          interruption.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={openStore}
          accessibilityRole="button"
          accessibilityLabel="Update now">
          <Text style={styles.primaryBtnText}>Update Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050508',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 200,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0D0E18',
    padding: 24,
    gap: 14,
  },
  eyebrow: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
  },
  primaryBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});
