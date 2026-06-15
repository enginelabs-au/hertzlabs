import React, {useCallback} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {SimpleTopControls} from '../components/simple/SimpleTopControls';
import {SimpleEngineCarousel} from '../components/simple/SimpleEngineCarousel';
import {BackgroundAudioToggle} from '../components/simple/BackgroundAudioToggle';
import {SimpleSessionAutomationMenu} from '../components/simple/SimpleSessionAutomationMenu';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

/** Streamlined Engines dashboard for Simple Mode. */
export function SimplePlayerScreen() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <SimpleTopControls />
        <SimpleEngineCarousel onUpgrade={openPaywall} />
        <BackgroundAudioToggle />
        <SimpleSessionAutomationMenu />
        <LegalMenuBar />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
});
