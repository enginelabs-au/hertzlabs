import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';

type MathFoldSectionProps = {
  icon: string;
  title: string;
  tag?: string;
  blurb: string;
  deepDive?: string;
  isActive?: boolean;
  isLocked?: boolean;
  onUpgrade?: () => void;
  defaultExpanded?: boolean;
  /** Inset sub-fold inside a parent mode menu — not a top-level mode card. */
  embedded?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
};

export function MathFoldSection({
  icon,
  title,
  tag,
  blurb,
  deepDive,
  isActive = false,
  isLocked = false,
  onUpgrade,
  defaultExpanded = false,
  embedded = false,
  style,
  children,
}: MathFoldSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleHeaderPress = () => {
    if (isLocked) {
      onUpgrade?.();
      return;
    }
    setExpanded(v => !v);
  };

  return (
    <View
      style={[
        embedded ? styles.embeddedCard : styles.card,
        isActive && (embedded ? styles.embeddedCardActive : styles.cardActive),
        isLocked && styles.cardLocked,
        style,
      ]}>
      <Pressable
        style={embedded ? styles.embeddedHeader : styles.header}
        onPress={handleHeaderPress}
        accessibilityRole="button">
        <Text style={[styles.chevron, embedded && styles.embeddedChevron, expanded && !isLocked && styles.chevronOpen]}>›</Text>
        {embedded ? (
          <Text style={styles.embeddedIcon}>{icon}</Text>
        ) : (
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        )}
        <View style={styles.textCol}>
          <Text style={[embedded ? styles.embeddedTitle : styles.title, isLocked && styles.textMuted]}>
            {title}
            {tag != null && <Text style={styles.tag}> · {tag}</Text>}
          </Text>
          <Text style={embedded ? styles.embeddedBlurb : styles.blurb}>{blurb}</Text>
          {expanded && !isLocked && deepDive != null && (
            <Text style={embedded ? styles.embeddedDeepDive : styles.deepDive}>{deepDive}</Text>
          )}
          {isLocked && (
            <Text style={styles.lockedHint}>🔒 Premium — tap to upgrade</Text>
          )}
        </View>
        {isActive && !isLocked && <View style={[styles.activeDot, embedded && styles.embeddedActiveDot]} />}
      </Pressable>

      {expanded && !isLocked && (
        <View style={embedded ? styles.embeddedBody : styles.body}>{children}</View>
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
  cardActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  cardLocked: {
    opacity: 0.72,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  chevron: {
    fontSize: 18,
    color: HertzTheme.text.muted,
    marginTop: 2,
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
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  tag: {
    fontWeight: '500',
    color: HertzTheme.text.secondary,
  },
  blurb: {
    fontSize: 12,
    color: HertzTheme.text.secondary,
  },
  deepDive: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    lineHeight: 17,
    color: HertzTheme.neon.cyan,
    opacity: 0.9,
    marginTop: 4,
  },
  lockedHint: {
    fontSize: 11,
    color: HertzTheme.neon.amber,
    marginTop: 4,
  },
  textMuted: {
    color: HertzTheme.text.muted,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HertzTheme.neon.cyan,
    marginTop: 6,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  embeddedCard: {
    marginHorizontal: 0,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  embeddedCardActive: {
    borderColor: 'rgba(92,225,255,0.35)',
    backgroundColor: 'rgba(92,225,255,0.04)',
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
  },
  embeddedChevron: {
    marginTop: 1,
    fontSize: 16,
    width: 10,
  },
  embeddedIcon: {
    fontSize: 14,
    marginTop: 1,
    width: 18,
    textAlign: 'center',
  },
  embeddedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: HertzTheme.text.primary,
  },
  embeddedBlurb: {
    fontSize: 11,
    color: HertzTheme.text.muted,
  },
  embeddedDeepDive: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    lineHeight: 15,
    color: HertzTheme.neon.cyan,
    opacity: 0.85,
    marginTop: 3,
  },
  embeddedActiveDot: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
  embeddedBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 2,
  },
});
