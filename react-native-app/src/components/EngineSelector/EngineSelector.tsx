import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useHertzStore} from '../../state/store';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {ENGINE_CATALOG, type EngineMeta} from '../../audio/engineModes';
import type {EngineMode} from '../../state/types';

const BG = '#000000';
const CARD = 'rgba(255,255,255,0.04)';
const CARD_ACTIVE = 'rgba(74,222,128,0.08)';
const BORDER = 'rgba(255,255,255,0.08)';
const BORDER_ACTIVE = 'rgba(74,222,128,0.35)';
const ACCENT = '#4ADE80';
const MUTED = 'rgba(255,255,255,0.38)';
const LOCK_COLOR = 'rgba(251,191,36,0.7)';

const GROUPS = ['Entrainment Engine', 'Acoustic Interference Engine', 'Modulated & Dynamic Engine'];

function HeadphoneIcon({required}: {required: boolean}) {
  return (
    <View
      style={[styles.iconPill, required ? styles.iconPillHeadphones : styles.iconPillSpeaker]}>
      <Text style={[styles.iconPillText, required ? styles.iconPillTextHP : styles.iconPillTextSP]}>
        {required ? '🎧 Headphones' : '🔊 Speaker OK'}
      </Text>
    </View>
  );
}

function LockBadge() {
  return (
    <View style={styles.lockBadge}>
      <Text style={styles.lockBadgeText}>PRO</Text>
    </View>
  );
}

interface EngineRowProps {
  meta: EngineMeta;
  isActive: boolean;
  isLocked: boolean;
  onSelect: (mode: EngineMode) => void;
}

function EngineRow({meta, isActive, isLocked, onSelect}: EngineRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.engineCard, isActive && styles.engineCardActive, isLocked && styles.engineCardLocked]}>
      {/* Header row — always visible */}
      <Pressable
        style={styles.engineHeader}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${meta.label} engine, tap to expand description`}>
        <View style={styles.engineHeaderLeft}>
          <View style={styles.engineTitleRow}>
            <Text style={[styles.engineLabel, isLocked && styles.engineLabelLocked]}>
              {meta.label}
            </Text>
            <Text style={styles.engineTag}> [{meta.tag}]</Text>
            {isLocked && <LockBadge />}
          </View>
          <Text style={[styles.engineShortDesc, isLocked && styles.textMuted]}>
            {meta.shortDesc}
          </Text>
          <View style={styles.engineMeta}>
            <HeadphoneIcon required={meta.requiresHeadphones} />
          </View>
        </View>
        <View style={styles.engineHeaderRight}>
          {isActive ? (
            <View style={styles.activeDot} />
          ) : (
            <Text style={[styles.expandChevron, expanded && styles.expandChevronOpen]}>›</Text>
          )}
        </View>
      </Pressable>

      {/* Expanded deep dive */}
      {expanded && (
        <View style={styles.deepDiveContainer}>
          <View style={styles.deepDiveDivider} />
          <Text style={styles.deepDiveText}>{meta.deepDive}</Text>
        </View>
      )}

      {/* Select button */}
      {!isLocked ? (
        <Pressable
          style={[styles.selectBtn, isActive && styles.selectBtnActive]}
          onPress={() => onSelect(meta.mode)}
          accessibilityRole="radio"
          accessibilityState={{selected: isActive}}>
          <Text style={[styles.selectBtnText, isActive && styles.selectBtnTextActive]}>
            {isActive ? '● Active' : '○ Select'}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.lockedCta}>
          <Text style={styles.lockedCtaText}>🔒 Upgrade to Premium</Text>
        </View>
      )}
    </View>
  );
}

export function EngineSelector() {
  const tier = useHertzStore(s => s.tier);
  const engineType = useHertzStore(s => s.engineType);
  const setEngineType = useHertzStore(s => s.setEngineType);
  const unlocked = isPremiumUnlocked(tier);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled>
      {GROUPS.map(group => {
        const engines = ENGINE_CATALOG.filter(e => e.group === group);
        return (
          <View key={group} style={styles.group}>
            <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
            {engines.map(meta => (
              <EngineRow
                key={meta.mode}
                meta={meta}
                isActive={engineType === meta.mode}
                isLocked={meta.isPremium && !unlocked}
                onSelect={setEngineType}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 24,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.5,
    marginBottom: 4,
    paddingLeft: 2,
  },
  engineCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  engineCardActive: {
    backgroundColor: CARD_ACTIVE,
    borderColor: BORDER_ACTIVE,
  },
  engineCardLocked: {
    opacity: 0.55,
  },
  engineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  engineHeaderLeft: {
    flex: 1,
    gap: 6,
  },
  engineHeaderRight: {
    paddingTop: 2,
    width: 20,
    alignItems: 'center',
  },
  engineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  engineLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  engineLabelLocked: {
    color: MUTED,
  },
  engineTag: {
    fontSize: 12,
    color: MUTED,
    fontStyle: 'italic',
  },
  engineShortDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },
  textMuted: {
    color: MUTED,
  },
  engineMeta: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  iconPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconPillHeadphones: {
    borderColor: 'rgba(147,197,253,0.4)',
    backgroundColor: 'rgba(147,197,253,0.08)',
  },
  iconPillSpeaker: {
    borderColor: 'rgba(134,239,172,0.4)',
    backgroundColor: 'rgba(134,239,172,0.08)',
  },
  iconPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iconPillTextHP: {
    color: 'rgba(147,197,253,0.9)',
  },
  iconPillTextSP: {
    color: 'rgba(134,239,172,0.9)',
  },
  lockBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: LOCK_COLOR,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: LOCK_COLOR,
    letterSpacing: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    marginTop: 4,
  },
  expandChevron: {
    fontSize: 18,
    color: MUTED,
    transform: [{rotate: '0deg'}],
    lineHeight: 20,
  },
  expandChevronOpen: {
    transform: [{rotate: '90deg'}],
    color: 'rgba(255,255,255,0.6)',
  },
  deepDiveContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  deepDiveDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 10,
  },
  deepDiveText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  selectBtn: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectBtnActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.3,
  },
  selectBtnTextActive: {
    color: ACCENT,
  },
  lockedCta: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  lockedCtaText: {
    fontSize: 12,
    color: LOCK_COLOR,
    fontWeight: '600',
  },
});
