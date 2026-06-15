import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {ENGINE_CATALOG, type EngineMeta} from '../../audio/engineModes';
import type {EngineMode} from '../../state/types';
import type {EngineCategoryId} from '../layout/CategoryTabBar';
import {ENGINE_CATEGORIES} from '../layout/CategoryTabBar';
import {ProtocolSequencesSection} from '../protocol/ProtocolSequencesSection';
import {HertzTheme} from '../../theme/hertzTheme';

function HeadphonePill({required}: {required: boolean}) {
  return (
    <View style={[styles.hpPill, required ? styles.hpRequired : styles.hpSpeaker]}>
      <Text style={styles.hpText}>{required ? '🎧 Headphones Required' : '🔊 Speaker OK'}</Text>
    </View>
  );
}

interface EngineRowProps {
  meta: EngineMeta;
  isActive: boolean;
  isLocked: boolean;
  isComingSoon: boolean;
  onSelect: (mode: EngineMode) => void;
  onUpgrade: () => void;
}

function EngineRow({meta, isActive, isLocked, isComingSoon, onSelect, onUpgrade}: EngineRowProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (isComingSoon) {
    return (
      <View style={styles.comingSoonCard}>
        <Pressable
          style={styles.comingSoonHeader}
          onPress={() => setExpanded(v => !v)}
          accessibilityRole="button">
          <View style={styles.comingSoonIcon}>
            <Text style={styles.comingSoonIconText}>♪</Text>
          </View>
          <View style={styles.comingSoonInfo}>
            <Text style={styles.comingSoonTitle}>
              {meta.label}
              <Text style={styles.engineTag}> · {meta.tag}</Text>
            </Text>
            <Text style={styles.comingSoonSubtitle}>{meta.shortDesc}</Text>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>SOON</Text>
          </View>
        </Pressable>
        {expanded && (
          <View style={styles.comingSoonBody}>
            <HeadphonePill required={meta.requiresHeadphones} />
            <Text style={styles.comingSoonBodyText}>{meta.deepDive}</Text>
            <Text style={styles.comingSoonNote}>
              This engine is in development and will be available in a future update.
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.engineCard, isActive && styles.engineCardActive, isLocked && styles.engineCardLocked]}>
      <Pressable
        style={styles.engineHeader}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button">
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
        <View style={styles.headerBody}>
          <Text style={[styles.engineTitle, isLocked && styles.textMuted]}>
            {meta.label}
            <Text style={styles.engineTag}> · {meta.tag}</Text>
          </Text>
          <HeadphonePill required={meta.requiresHeadphones} />
          {expanded && (
            <Text style={styles.deepDive}>{meta.deepDive}</Text>
          )}
        </View>
        {isActive && <View style={styles.activeDot} />}
      </Pressable>

      {!isLocked && (
        <Pressable
          style={[styles.selectBtn, isActive && styles.selectBtnActive]}
          onPress={() => onSelect(meta.mode)}
          accessibilityRole="radio"
          accessibilityState={{selected: isActive}}>
          <Text style={[styles.selectBtnText, isActive && styles.selectBtnTextActive]}>
            {isActive ? '● Active' : '○ Select'}
          </Text>
        </Pressable>
      )}
      {isLocked && (
        <Pressable style={styles.lockedCta} onPress={onUpgrade} accessibilityRole="button">
          <Text style={styles.lockedCtaText}>🔒 LOCKED — Upgrade to Premium</Text>
        </Pressable>
      )}

      {expanded && (
        <View style={styles.seqWrap}>
          <ProtocolSequencesSection foldStyle={styles.seqFold} engineMode={meta.mode} />
        </View>
      )}
    </View>
  );
}

type EngineSelectorProps = {
  category: EngineCategoryId;
};

export function EngineSelector({category}: EngineSelectorProps) {
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const engineType = useHertzStore(s => s.engineType);
  const setEngineType = useHertzStore(s => s.setEngineType);
  const unlocked = isPremiumUnlocked(tier);

  const openPaywall = React.useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  const catConfig = ENGINE_CATEGORIES.find(c => c.id === category);
  const groupNames = catConfig?.groups ?? [];
  const engines = ENGINE_CATALOG.filter(e => groupNames.includes(e.group));

  return (
    <View style={styles.list}>
      {engines.map(meta => (
        <EngineRow
          key={meta.mode}
          meta={meta}
          isActive={engineType === meta.mode}
          isLocked={meta.isPremium && !unlocked && !meta.comingSoon}
          isComingSoon={Boolean(meta.comingSoon)}
          onSelect={setEngineType}
          onUpgrade={openPaywall}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  engineCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
    overflow: 'hidden',
  },
  engineCardActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  engineCardLocked: {
    opacity: 0.72,
  },
  engineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 8,
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
  headerBody: {
    flex: 1,
    gap: 8,
  },
  engineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  engineTag: {
    fontWeight: '500',
    color: HertzTheme.text.secondary,
  },
  deepDive: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    lineHeight: 17,
    color: HertzTheme.neon.cyan,
    opacity: 0.9,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HertzTheme.neon.cyan,
    marginTop: 6,
  },
  hpPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  hpRequired: {
    borderColor: 'rgba(92,225,255,0.35)',
    backgroundColor: 'rgba(92,225,255,0.08)',
  },
  hpSpeaker: {
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hpText: {
    fontSize: 10,
    fontWeight: '600',
    color: HertzTheme.text.secondary,
  },
  selectBtn: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
  },
  selectBtnActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.1)',
  },
  selectBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.5,
  },
  selectBtnTextActive: {
    color: HertzTheme.neon.cyan,
  },
  seqWrap: {
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  seqFold: {
    marginHorizontal: 0,
    marginBottom: 4,
  },
  comingSoonCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  comingSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  comingSoonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonIconText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  comingSoonInfo: {
    flex: 1,
    gap: 2,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  comingSoonSubtitle: {
    fontSize: 12,
    color: HertzTheme.text.muted,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(147,197,253,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.3)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  comingSoonBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(147,197,253,0.8)',
    letterSpacing: 1,
  },
  comingSoonBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  comingSoonBodyText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.55)',
  },
  comingSoonNote: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(147,197,253,0.75)',
  },
  lockedCta: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  lockedCtaText: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.neon.amber,
    letterSpacing: 0.5,
  },
  textMuted: {
    color: HertzTheme.text.muted,
  },
});
