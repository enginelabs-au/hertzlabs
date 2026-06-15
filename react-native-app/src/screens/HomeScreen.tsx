import React, {useRef} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AIGuideChatSection} from '../components/ai/AIGuideChatSection';
import {HomeBeatSlider, HomeHorizontalBands} from '../components/home/HomeFreqControls';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {HertzTheme} from '../theme/hertzTheme';

const H_PAD = 16;

/** Simple Mode Home — freq slider, bands, chat. No oscilloscope. */
export function HomeScreen() {
  const {top, bottom} = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={HertzTheme.bg} translucent={false} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: top + 8, paddingBottom: bottom + 12},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>HERTZ LABS</Text>

        <HomeBeatSlider />

        <HomeHorizontalBands />

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Ask the AI guide</Text>
          <AIGuideChatSection layoutMode="homeInline" inputRef={inputRef} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <LegalMenuBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
  },
  brand: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 2.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  inputCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(8,10,18,0.96)',
    borderWidth: 1.5,
    borderColor: 'rgba(92,225,255,0.4)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: HertzTheme.neon.cyan,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 0},
  },
  inputLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footer: {
    backgroundColor: HertzTheme.bg,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
  },
});
