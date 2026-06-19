import React, {useCallback, useRef, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {MicIcon} from '../components/icons/MicIcon';
import {useSpeechToText} from '../hooks/useSpeechToText';
import {HertzTheme} from '../theme/hertzTheme';

const H_PAD = 16;
/** Space reserved below scroll content for the global TransportBar + tab bar. */
const BOTTOM_CHROME_PAD = 108;

/** Simple Mode Home — freq slider, bands, chat. No oscilloscope. */
export function HomeScreen() {
  const {top, bottom} = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const submitRef = useRef<((text: string) => void) | null>(null);
  const loadingRef = useRef<boolean>(false);
  const [prompt, setPrompt] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || loadingRef.current) {
      return;
    }
    submitRef.current?.(trimmed);
    setPrompt('');
    Keyboard.dismiss();
  }, [prompt]);

  const speech = useSpeechToText({
    onTranscript: text => setPrompt(text),
    onRecordingComplete: handleSubmit,
  });

  const scrollBottomPad = Math.max(bottom, 8) + BOTTOM_CHROME_PAD;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? top : 0}>
      <StatusBar barStyle="light-content" backgroundColor={HertzTheme.bg} translucent={false} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: top + 8, paddingBottom: scrollBottomPad},
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        <Text style={styles.brand} maxFontSizeMultiplier={1.2}>
          HERTZ LABS
        </Text>

        <HomeBeatSlider />

        <HomeHorizontalBands />

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.2}>
            Ask the AI guide
          </Text>
          <AIGuideChatSection
            layoutMode="homeInline"
            inputRef={inputRef}
            submitRef={submitRef}
            loadingRef={loadingRef}
          />
        </View>

        <View style={styles.inputStrip}>
          <Pressable
            style={[styles.micBtn, speech.isListening && styles.micBtnActive]}
            onPress={() => {
              inputRef.current?.blur();
              speech.toggleSpeech();
            }}
            disabled={loadingRef.current}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={speech.isListening ? 'Stop voice input' : 'Start voice input'}>
            <MicIcon
              size={18}
              color={speech.isListening ? HertzTheme.neon.magenta : HertzTheme.neon.cyan}
            />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={[styles.stripInput, speech.isListening && styles.stripInputListening]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={speech.isListening ? 'Listening…' : 'Describe your goal…'}
            placeholderTextColor={
              speech.isListening ? HertzTheme.neon.magenta : HertzTheme.text.muted
            }
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            maxFontSizeMultiplier={1.3}
          />
          <Pressable
            style={[styles.goBtn, (!prompt.trim() || loadingRef.current) && styles.goBtnDisabled]}
            onPress={handleSubmit}
            disabled={!prompt.trim() || loadingRef.current}>
            <Text style={styles.goBtnText} maxFontSizeMultiplier={1.2}>
              Go
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <LegalMenuBar />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    flexGrow: 1,
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
    marginBottom: 12,
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
  inputStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(92,225,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  micBtnActive: {
    backgroundColor: 'rgba(255,80,180,0.15)',
    borderColor: HertzTheme.neon.magenta,
  },
  stripInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    color: HertzTheme.text.primary,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stripInputListening: {
    borderColor: HertzTheme.neon.magenta,
    backgroundColor: 'rgba(255,80,180,0.06)',
  },
  goBtn: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(92,225,255,0.18)',
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  goBtnDisabled: {
    opacity: 0.4,
  },
  goBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '800',
    color: HertzTheme.neon.cyan,
  },
  footer: {
    backgroundColor: HertzTheme.bg,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    marginTop: 4,
  },
});
