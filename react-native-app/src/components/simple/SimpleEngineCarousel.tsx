import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  ENGINE_CATALOG,
  isEngineModeComingSoon,
  isEngineModeSelectable,
} from '../../audio/engineModes';
import {NOISE_LAYER_CATALOG, type NoiseLayerId} from '../../audio/noiseLayers';
import {noiseMixToSliderNorm, sliderNormToNoiseMix} from '../../audio/noiseMixSlider';
import type {EngineMode} from '../../state/types';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {NeonSlider} from '../player/NeonSlider';

const SIMPLE_ENGINE_ORDER: {mode: EngineMode; label: string}[] = [
  {mode: 'binaural', label: 'Binaural'},
  {mode: 'hemisphericSync', label: 'Hemispheric Sync'},
  {mode: 'phaseModulated', label: 'Phase Alignment'},
  {mode: 'pitchPanning', label: 'Pitch Modulation'},
  {mode: 'monaural', label: 'Acoustic Resonance'},
  {mode: 'isochronic', label: 'Ambient Modulation'},
  {mode: 'musicModulation', label: 'Music-Reactive'},
];

type Selection =
  | {kind: 'engine'; mode: EngineMode}
  | {kind: 'noise'; id: NoiseLayerId};

type SimpleEngineCarouselProps = {
  onUpgrade: () => void;
};

export function SimpleEngineCarousel({onUpgrade}: SimpleEngineCarouselProps) {
  const engineType = useHertzStore(s => s.engineType);
  const setEngineType = useHertzStore(s => s.setEngineType);
  const tier = useHertzStore(s => s.tier);
  const noiseLayers = useHertzStore(s => s.noiseLayers);
  const noiseMix = useHertzStore(s => s.noiseMix);
  const beatSliderScale = useHertzStore(s => s.beatSliderScale);
  const toggleNoiseLayer = useHertzStore(s => s.toggleNoiseLayer);
  const setNoiseMix = useHertzStore(s => s.setNoiseMix);

  const activeNoiseId = useMemo((): NoiseLayerId | null => {
    if (noiseLayers.white) return 'white';
    if (noiseLayers.pink) return 'pink';
    if (noiseLayers.brown) return 'brown';
    return null;
  }, [noiseLayers]);

  const [selection, setSelection] = useState<Selection>({kind: 'engine', mode: engineType});

  const onSelectEngine = useCallback(
    (mode: EngineMode) => {
      const selectable = isEngineModeSelectable(mode, tier);
      const comingSoon = isEngineModeComingSoon(mode);
      setSelection({kind: 'engine', mode});
      if (comingSoon) {
        return;
      }
      if (!selectable) {
        onUpgrade();
        return;
      }
      setEngineType(mode);
    },
    [onUpgrade, setEngineType, tier],
  );

  const onSelectNoise = useCallback(
    (id: NoiseLayerId) => {
      setSelection({kind: 'noise', id});
      toggleNoiseLayer(id);
    },
    [toggleNoiseLayer],
  );

  const onNoiseMixChange = useCallback(
    (norm: number) => setNoiseMix(sliderNormToNoiseMix(norm, beatSliderScale)),
    [beatSliderScale, setNoiseMix],
  );

  const engineMeta = ENGINE_CATALOG.find(e => e.mode === (selection.kind === 'engine' ? selection.mode : engineType));
  const noiseMeta =
    selection.kind === 'noise'
      ? NOISE_LAYER_CATALOG.find(n => n.id === selection.id)
      : activeNoiseId != null
        ? NOISE_LAYER_CATALOG.find(n => n.id === activeNoiseId)
        : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Modes</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {SIMPLE_ENGINE_ORDER.map(({mode, label}) => {
          const active = engineType === mode;
          const locked = !isEngineModeSelectable(mode, tier) && !isEngineModeComingSoon(mode);
          const soon = isEngineModeComingSoon(mode);
          const selected = selection.kind === 'engine' && selection.mode === mode;
          return (
            <Pressable
              key={mode}
              style={[
                styles.chip,
                (active || selected) && styles.chipActive,
                locked && styles.chipLocked,
              ]}
              onPress={() => onSelectEngine(mode)}>
              <Text style={[styles.chipText, (active || selected) && styles.chipTextActive]}>
                {label}
                {soon ? ' · SOON' : locked ? ' · 🔒' : ''}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.divider} />

        {NOISE_LAYER_CATALOG.map(meta => {
          const active = noiseLayers[meta.id];
          const selected = selection.kind === 'noise' && selection.id === meta.id;
          return (
            <Pressable
              key={meta.id}
              style={[
                styles.chip,
                styles.noiseChip,
                (active || selected) && {borderColor: meta.accent, backgroundColor: `${meta.accent}22`},
              ]}
              onPress={() => onSelectNoise(meta.id)}>
              <Text
                style={[
                  styles.chipText,
                  (active || selected) && {color: meta.accent},
                ]}>
                {meta.label.replace(' Noise', '')}
                {active ? ' · ON' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selection.kind === 'engine' && engineMeta != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {engineMeta.label}
            <Text style={styles.cardTag}> · {engineMeta.tag}</Text>
          </Text>
          <Text style={styles.cardDesc}>{engineMeta.shortDesc}</Text>
          {engineMeta.comingSoon && (
            <Text style={styles.soonNote}>In development — preview only.</Text>
          )}
        </View>
      )}

      {selection.kind === 'noise' && noiseMeta != null && (
        <View style={[styles.card, {borderColor: `${noiseMeta.accent}55`}]}>
          <Text style={styles.cardTitle}>
            {noiseMeta.label}
            <Text style={styles.cardTag}> · {noiseMeta.tag}</Text>
          </Text>
          <Text style={styles.cardDesc}>{noiseMeta.deepDive}</Text>
          {noiseLayers[noiseMeta.id] && (
            <View style={styles.noiseLevelRow}>
              <Text style={styles.noiseLevelLabel}>Level</Text>
              <View style={styles.noiseSlider}>
                <NeonSlider
                  value={noiseMixToSliderNorm(noiseMix, beatSliderScale)}
                  onChange={onNoiseMixChange}
                  accent={noiseMeta.accent}
                />
              </View>
              <Text style={styles.noiseLevelPct}>{Math.round(noiseMix * 100)}%</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  sectionLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '800',
    color: HertzTheme.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: HertzTheme.glassBorder,
    marginHorizontal: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noiseChip: {
    borderStyle: 'dashed',
  },
  chipActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.12)',
  },
  chipLocked: {
    opacity: 0.75,
  },
  chipText: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.4,
  },
  chipTextActive: {
    color: HertzTheme.neon.cyan,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: HertzTheme.glassFill,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  cardTag: {
    fontWeight: '500',
    color: HertzTheme.text.secondary,
  },
  cardDesc: {
    fontSize: 12,
    color: HertzTheme.text.muted,
    lineHeight: 18,
    marginTop: 8,
  },
  soonNote: {
    fontSize: 11,
    color: HertzTheme.neon.amber,
    marginTop: 8,
  },
  noiseLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  noiseLevelLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    width: 36,
  },
  noiseSlider: {
    flex: 1,
  },
  noiseLevelPct: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    width: 32,
    textAlign: 'right',
  },
});
