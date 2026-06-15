import React, {useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {AIGuideChatSection} from '../ai/AIGuideChatSection';
import {ChatBorderProgress} from './ChatBorderProgress';
import {HertzTheme} from '../../theme/hertzTheme';

const BOX_W = 228;
const BOX_H = 168;

/** Opaque top-layer AI chat — mic, input, Go only. */
export function HomeAIChatBox() {
  const inputRef = useRef<TextInput>(null);
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const onMicPress = () => {
    setListening(v => !v);
    inputRef.current?.focus();
    Animated.sequence([
      Animated.timing(pulse, {toValue: 1.12, duration: 120, useNativeDriver: true}),
      Animated.timing(pulse, {toValue: 1, duration: 180, useNativeDriver: true}),
    ]).start();
  };

  return (
    <View style={styles.outer}>
      <ChatBorderProgress width={BOX_W + 10} height={BOX_H + 10} />
      <View style={styles.opaqueCard}>
        <Text style={styles.title}>What do you need right now?</Text>
        <Pressable style={styles.micRow} onPress={onMicPress} accessibilityRole="button">
          <Animated.View
            style={[
              styles.micBtn,
              listening && styles.micBtnActive,
              {transform: [{scale: pulse}]},
            ]}>
            <Text style={styles.micIcon}>🎙</Text>
          </Animated.View>
          <Text style={styles.micHint}>
            {listening ? 'Listening… speak or type' : 'Tap to speak or type'}
          </Text>
        </Pressable>
        <AIGuideChatSection layoutMode="home" inputRef={inputRef} foldStyle={styles.chatFold} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: BOX_W + 10,
    height: BOX_H + 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  opaqueCard: {
    width: BOX_W,
    minHeight: BOX_H,
    borderRadius: 18,
    backgroundColor: 'rgba(8,10,18,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.28)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  micRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  micBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(92,225,255,0.14)',
    borderWidth: 2,
    borderColor: HertzTheme.neon.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: 'rgba(92,225,255,0.26)',
  },
  micIcon: {
    fontSize: 24,
  },
  micHint: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 5,
  },
  chatFold: {
    marginHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});
