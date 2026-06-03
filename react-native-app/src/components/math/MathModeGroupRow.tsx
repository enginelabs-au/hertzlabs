import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';
import {MATH_GROUP_META} from './mathModeMeta';

export type MathPresetItem = {
  id: string;
  label: string;
  beatHz: number;
  group: string;
  description: string;
  isPremium: boolean;
};

type MathModeGroupRowProps = {
  group: string;
  presets: MathPresetItem[];
  activePresetId: string | null;
  unlocked: boolean;
  onSelect: (preset: MathPresetItem) => void;
};

export function MathModeGroupRow({
  group,
  presets,
  activePresetId,
  unlocked,
  onSelect,
}: MathModeGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = MATH_GROUP_META[group] ?? {
    icon: '∑',
    title: group,
    blurb: 'Mathematical entrainment preset.',
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button">
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>{meta.icon}</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.blurb}>{meta.blurb}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {presets.map(preset => {
            const locked = preset.isPremium && !unlocked;
            const active = activePresetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                style={[styles.presetRow, active && styles.presetRowActive, locked && styles.presetLocked]}
                onPress={() => !locked && onSelect(preset)}
                disabled={locked}>
                <Text style={[styles.presetHz, active && styles.presetHzActive]}>{preset.label}</Text>
                <Text style={styles.presetDesc} numberOfLines={2}>
                  {preset.description}
                </Text>
                {locked && <Text style={styles.lock}>PRO</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  chevron: {
    fontSize: 18,
    color: HertzTheme.text.muted,
    transform: [{rotate: '0deg'}],
    width: 12,
  },
  chevronOpen: {
    transform: [{rotate: '90deg'}],
    color: HertzTheme.neon.cyan,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(92,225,255,0.1)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    color: HertzTheme.neon.cyan,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  blurb: {
    fontSize: 12,
    color: HertzTheme.text.secondary,
    marginTop: 3,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  presetRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  presetRowActive: {
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.08)',
  },
  presetLocked: {
    opacity: 0.55,
  },
  presetHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 14,
    fontWeight: '700',
    color: HertzTheme.neon.magenta,
  },
  presetHzActive: {
    color: HertzTheme.neon.cyan,
  },
  presetDesc: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginTop: 4,
    fontFamily: HertzTheme.mono,
  },
  lock: {
    position: 'absolute',
    right: 10,
    top: 10,
    fontSize: 9,
    fontWeight: '800',
    color: HertzTheme.neon.amber,
  },
});
