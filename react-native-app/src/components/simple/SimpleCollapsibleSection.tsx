import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';

type SimpleCollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  isActive?: boolean;
  defaultExpanded?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
};

/** Collapsible menu section for Simple Mode screens. */
export function SimpleCollapsibleSection({
  title,
  subtitle,
  isActive = false,
  defaultExpanded = false,
  style,
  children,
}: SimpleCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={[styles.card, isActive && styles.cardActive, style]}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {isActive && <View style={styles.activeDot} />}
      </Pressable>
      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  chevron: {
    fontSize: 18,
    color: HertzTheme.text.muted,
    width: 12,
  },
  chevronOpen: {
    transform: [{rotate: '90deg'}],
    color: HertzTheme.neon.cyan,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    lineHeight: 15,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HertzTheme.neon.cyan,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
});
