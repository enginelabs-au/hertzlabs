import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';

export type EngineCategoryId = 'entrainment' | 'acoustic' | 'modulated';

export const ENGINE_CATEGORIES: {id: EngineCategoryId; label: string; groups: string[]}[] = [
  {id: 'entrainment', label: 'ENTRAINMENT', groups: ['Entrainment Engine']},
  {id: 'acoustic', label: 'ACOUSTIC', groups: ['Acoustic Interference Engine']},
  {id: 'modulated', label: 'MODULATED', groups: ['Modulated & Dynamic Engine']},
];

type CategoryTabBarProps = {
  active: EngineCategoryId;
  onChange: (id: EngineCategoryId) => void;
};

export function CategoryTabBar({active, onChange}: CategoryTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      style={styles.bar}>
      {ENGINE_CATEGORIES.map(cat => {
        const isActive = cat.id === active;
        return (
          <Pressable
            key={cat.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(cat.id)}>
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{cat.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    maxHeight: 44,
    marginBottom: 12,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.1)',
  },
  tabText: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: HertzTheme.neon.cyan,
  },
});
