import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {GlassCard} from '../player/GlassCard';
import {HertzTheme} from '../../theme/hertzTheme';

type CommandLineCardProps = {
  onClose?: () => void;
};

export function CommandLineCard({onClose}: CommandLineCardProps) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Command line</Text>
        {onClose != null && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.formula}>f_target = |f_L − f_R|</Text>
      <Text style={styles.sub}>
        π · φ · √available · f_target = (f_L + f_R) / 2
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
    letterSpacing: 0.5,
  },
  close: {
    fontSize: 18,
    color: HertzTheme.text.muted,
    lineHeight: 20,
  },
  formula: {
    fontFamily: HertzTheme.mono,
    fontSize: 22,
    color: HertzTheme.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
