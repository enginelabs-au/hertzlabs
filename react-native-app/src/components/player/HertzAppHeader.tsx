import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';

type HertzAppHeaderProps = {
  title?: string;
  onClose?: () => void;
};

export function HertzAppHeader({title = 'Hertz Labs', onClose}: HertzAppHeaderProps) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={12}>
        <Text style={styles.icon}>✕</Text>
      </Pressable>
      <Pressable style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Pressable style={styles.iconBtn} hitSlop={12}>
        <Text style={styles.menu}>☰</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 36,
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
    color: HertzTheme.text.secondary,
    fontWeight: '300',
  },
  menu: {
    fontSize: 20,
    color: HertzTheme.text.secondary,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: HertzTheme.text.primary,
  },
  chevron: {
    fontSize: 12,
    color: HertzTheme.text.muted,
    marginTop: 2,
  },
});
