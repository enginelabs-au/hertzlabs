import React, {useCallback, useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {pushNoiseToNative} from '../../audio/pushNoiseToNative';
import {
  NOISE_LAYER_CATALOG,
  type NoiseLayerId,
  type NoiseLayerMeta,
} from '../../audio/noiseLayers';
import {noiseMixToSliderNorm, sliderNormToNoiseMix} from '../../audio/noiseMixSlider';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {NeonSlider} from '../player/NeonSlider';
import {BreathPacerSection} from '../breathPacer/BreathPacerSection';

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
  noiseMix,
  beatSliderScale,
  onSelect,
  onMixChange,
}: {
  meta: NoiseLayerMeta;
  isActive: boolean;
  noiseMix: number;
  beatSliderScale: 'linear' | 'exponential';
  onSelect: () => void;
  onMixChange: (mix: number) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const handleSliderChange = useCallback(
    (norm: number) => onMixChange(sliderNormToNoiseMix(norm, beatSliderScale)),
    [beatSliderScale, onMixChange],
  );

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

      {isActive && (
        <View style={styles.levelCard}>
          <Text style={styles.levelTitle}>Noise level</Text>
          <Text style={styles.levelHint}>
            {beatSliderScale === 'linear' ? 'Linear' : 'Exponential'} scrub — one noise at a time
          </Text>
          <View style={styles.levelRow}>
            <NeonSlider
              value={noiseMixToSliderNorm(noiseMix, beatSliderScale)}
              onChange={handleSliderChange}
              accent={meta.accent}
            />
            <Text style={styles.levelPct}>{Math.round(noiseMix * 100)}%</Text>
          </View>
        </View>
      )}

      <Pressable
        style={[styles.selectBtn, isActive && styles.selectBtnActive]}
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{selected: isActive}}>
        <Text style={[styles.selectBtnText, isActive && styles.selectBtnTextActive]}>
          {isActive ? '● Selected' : '○ Select noise'}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.nestedFold}>
          <BreathPacerSection foldStyle={styles.nestedFoldInner} />
        </View>
      )}
    </View>
  );
}

/** Ambient noise layers — select one at a time; level slider lives in each module. */
export function AmbientNoiseSelector() {
  const noiseLayers = useHertzStore(s => s.noiseLayers);
  const noiseMix = useHertzStore(s => s.noiseMix);
  const beatSliderScale = useHertzStore(s => s.beatSliderScale);
  const toggleNoiseLayer = useHertzStore(s => s.toggleNoiseLayer);
  const setNoiseMix = useHertzStore(s => s.setNoiseMix);

  useEffect(() => {
    pushNoiseToNative(noiseLayers, noiseMix);
  }, [noiseLayers, noiseMix]);

  return (
    <View style={styles.list}>
      {NOISE_LAYER_CATALOG.map(meta => (
        <NoiseRow
          key={meta.id}
          meta={meta}
          isActive={noiseLayers[meta.id as NoiseLayerId]}
          noiseMix={noiseMix}
          beatSliderScale={beatSliderScale}
          onSelect={() => toggleNoiseLayer(meta.id as NoiseLayerId)}
          onMixChange={setNoiseMix}
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
  levelCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  levelTitle: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    letterSpacing: 0.5,
  },
  levelHint: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 2,
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelPct: {
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
  nestedFold: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingTop: 8,
  },
  nestedFoldInner: {
    marginHorizontal: 0,
  },
});
