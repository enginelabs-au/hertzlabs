import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {pushNoiseToNative} from '../../audio/pushNoiseToNative';
import {
  NOISE_LAYER_CATALOG,
  anyNoiseActive,
  type NoiseLayerId,
  type NoiseLayerMeta,
} from '../../audio/noiseLayers';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {NeonSlider} from '../player/NeonSlider';

function DescriptorTags({tags}: {tags: string[]}) {
  return (
    <View style={styles.tags}>
      {tags.map(tag => (
        <Text key={tag} style={styles.tag}>
          {tag}
        </Text>
      ))}
    </View>
  );
}

function NoiseRow({
  meta,
  isActive,
  onToggle,
}: {
  meta: NoiseLayerMeta;
  isActive: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = React.useState(isActive);

  return (
    <View style={[styles.engineCard, isActive && styles.engineCardActive]}>
      <Pressable
        style={styles.engineHeader}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button">
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
        <View style={styles.headerBody}>
          <Text style={styles.engineTitle}>
            {meta.label}
            <Text style={styles.engineTag}> · {meta.tag}</Text>
          </Text>
          {expanded && (
            <>
              <DescriptorTags tags={meta.descriptors} />
              <Text style={styles.deepDive}>{meta.deepDive}</Text>
            </>
          )}
        </View>
        {isActive && <View style={[styles.activeDot, {backgroundColor: meta.accent}]} />}
      </Pressable>

      <Pressable
        style={[styles.selectBtn, isActive && styles.selectBtnActive]}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{checked: isActive}}>
        <Text style={[styles.selectBtnText, isActive && styles.selectBtnTextActive]}>
          {isActive ? '● Active' : '○ Add layer'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Ambient noise layers — same accordion pattern as Binaural / Hemispheric Sync. */
export function AmbientNoiseSelector() {
  const noiseLayers = useHertzStore(s => s.noiseLayers);
  const noiseMix = useHertzStore(s => s.noiseMix);
  const toggleNoiseLayer = useHertzStore(s => s.toggleNoiseLayer);
  const setNoiseMix = useHertzStore(s => s.setNoiseMix);

  useEffect(() => {
    pushNoiseToNative(noiseLayers, noiseMix);
  }, [noiseLayers, noiseMix]);

  const showMix = anyNoiseActive(noiseLayers);

  return (
    <View style={styles.list}>
      {showMix && (
        <View style={styles.mixCard}>
          <Text style={styles.mixTitle}>Noise mix</Text>
          <Text style={styles.mixHint}>Blend level for all active layers</Text>
          <View style={styles.mixRow}>
            <NeonSlider value={noiseMix} onChange={setNoiseMix} accent={HertzTheme.neon.cyan} />
            <Text style={styles.mixPct}>{Math.round(noiseMix * 100)}%</Text>
          </View>
        </View>
      )}
      {NOISE_LAYER_CATALOG.map(meta => (
        <NoiseRow
          key={meta.id}
          meta={meta}
          isActive={noiseLayers[meta.id as NoiseLayerId]}
          onToggle={() => toggleNoiseLayer(meta.id as NoiseLayerId)}
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
  mixCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.06)',
    padding: 14,
    marginBottom: 4,
  },
  mixTitle: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    letterSpacing: 0.6,
  },
  mixHint: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginTop: 2,
    marginBottom: 10,
  },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mixPct: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
    minWidth: 36,
    textAlign: 'right',
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
    marginTop: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92, 225, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
});
