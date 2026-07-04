import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {FOCUS_CHALLENGE_MIN_PLAY_SEC} from '../../focusChallenge/dayTemplates';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

export function FocusChallengeSessionBar() {
  const focusChallengeSessionActive = useHertzStore(s => s.focusChallengeSessionActive);
  const playbackSec = useHertzStore(s => s.focusChallengeSessionPlaybackSec);
  const requiredSec = useHertzStore(s => s.focusChallengeSessionRequiredSec);
  const endFocusChallengeSessionEarly = useHertzStore(s => s.endFocusChallengeSessionEarly);

  const canEnd = playbackSec >= FOCUS_CHALLENGE_MIN_PLAY_SEC;
  const pct = requiredSec > 0 ? Math.min(playbackSec / requiredSec, 1) : 0;

  const endSession = useCallback(() => {
    endFocusChallengeSessionEarly();
  }, [endFocusChallengeSessionEarly]);

  if (!focusChallengeSessionActive) {
    return null;
  }

  return (
    <View style={styles.bar}>
      <View style={styles.copy}>
        <Text style={styles.title}>Focus challenge session</Text>
        <Text style={styles.sub}>
          {Math.floor(playbackSec / 60)}m / {Math.ceil(requiredSec / 60)}m
        </Text>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, {width: `${pct * 100}%`}]} />
      </View>
      <Pressable
        style={[styles.endBtn, !canEnd && styles.endBtnDisabled]}
        onPress={endSession}
        disabled={!canEnd}>
        <Text style={styles.endBtnText}>{canEnd ? 'End session' : 'Keep playing…'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(92,225,255,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92,225,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  copy: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title: {fontSize: 12, fontWeight: '600', color: HertzTheme.neon.cyan},
  sub: {fontSize: 11, color: HertzTheme.text.muted},
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {height: 4, backgroundColor: HertzTheme.neon.cyan},
  endBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
  },
  endBtnDisabled: {opacity: 0.45},
  endBtnText: {fontSize: 11, fontWeight: '600', color: HertzTheme.neon.cyan},
});
