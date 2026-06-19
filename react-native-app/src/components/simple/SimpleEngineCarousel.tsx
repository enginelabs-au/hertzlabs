import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
      <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.2}>
        Engines
      </Text>
      <View style={styles.engineList}>
        {SIMPLE_ENGINE_ORDER.map(({mode, label}) => {
          const active = engineType === mode && !isEngineModeComingSoon(mode);
          const locked = !isEngineModeSelectable(mode, tier) && !isEngineModeComingSoon(mode);
          const soon = isEngineModeComingSoon(mode);
          const meta = ENGINE_CATALOG.find(e => e.mode === mode);
          const selected = selection.kind === 'engine' && selection.mode === mode;

          if (soon && meta != null) {
            return (
              <Pressable
                key={mode}
                style={styles.comingSoonCard}
                onPress={() => setSelection({kind: 'engine', mode})}
                accessibilityRole="button"
                accessibilityLabel={`${label} coming soon`}>
                <View style={styles.comingSoonHeader}>
                  <View style={styles.comingSoonIcon}>
                    <Text style={styles.comingSoonIconText}>♪</Text>
                  </View>
                  <View style={styles.comingSoonInfo}>
                    <Text style={styles.comingSoonTitle} maxFontSizeMultiplier={1.3}>
                      {label}
                      <Text style={styles.engineRowTag}> · {meta.tag}</Text>
                    </Text>
                    <Text style={styles.comingSoonSubtitle} maxFontSizeMultiplier={1.3}>
                      {meta.shortDesc}
                    </Text>
                  </View>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText} maxFontSizeMultiplier={1.0}>
                      SOON
                    </Text>
                  </View>
                </View>
                {selected && (
                  <View style={styles.comingSoonBody}>
                    <Text style={styles.comingSoonBodyText} maxFontSizeMultiplier={1.3}>
                      {meta.deepDive}
                    </Text>
                    <Text style={styles.comingSoonNote} maxFontSizeMultiplier={1.2}>
                      This engine is in development and will be available in a future update.
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }

          return (
            <Pressable
              key={mode}
              style={[
                styles.engineRow,
                (active || selected) && styles.engineRowActive,
                locked && styles.engineRowLocked,
              ]}
              onPress={() => onSelectEngine(mode)}
              accessibilityRole="radio"
              accessibilityState={{selected: active, disabled: locked}}>
              <View style={styles.engineRowBody}>
                <Text
                  style={[styles.engineRowTitle, (active || selected) && styles.engineRowTitleActive]}
                  maxFontSizeMultiplier={1.3}>
                  {label}
                  {meta != null && (
                    <Text style={styles.engineRowTag}> · {meta.tag}</Text>
                  )}
                </Text>
                {meta != null && (
                  <Text style={styles.engineRowDesc} maxFontSizeMultiplier={1.3} numberOfLines={2}>
                    {meta.shortDesc}
                    {soon ? ' · Coming soon' : locked ? ' · Premium' : ''}
                  </Text>
                )}
              </View>
              {active && <View style={styles.activeDot} accessibilityLabel="Selected" />}
              {locked && !active && <Text style={styles.lockIcon}>🔒</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, styles.noiseSectionLabel]} maxFontSizeMultiplier={1.2}>
        Ambient noise
      </Text>
      <View style={styles.noiseWrap}>
        {NOISE_LAYER_CATALOG.map(meta => {
          const active = noiseLayers[meta.id];
          const selected = selection.kind === 'noise' && selection.id === meta.id;
          return (
            <Pressable
              key={meta.id}
              style={[
                styles.noiseChip,
                (active || selected) && {borderColor: meta.accent, backgroundColor: `${meta.accent}22`},
              ]}
              onPress={() => onSelectNoise(meta.id)}
              accessibilityRole="switch"
              accessibilityState={{checked: active}}>
              <Text
                style={[styles.noiseChipText, (active || selected) && {color: meta.accent}]}
                maxFontSizeMultiplier={1.2}>
                {meta.label.replace(' Noise', '')}
                {active ? ' · ON' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selection.kind === 'engine' && engineMeta != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            {engineMeta.label}
            <Text style={styles.cardTag}> · {engineMeta.tag}</Text>
          </Text>
          <Text style={styles.cardDesc} maxFontSizeMultiplier={1.3}>
            {engineMeta.shortDesc}
          </Text>
          {engineMeta.comingSoon && (
            <Text style={styles.soonNote} maxFontSizeMultiplier={1.2}>
              In development — preview only.
            </Text>
          )}
        </View>
      )}

      {selection.kind === 'noise' && noiseMeta != null && (
        <View style={[styles.card, {borderColor: `${noiseMeta.accent}55`}]}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            {noiseMeta.label}
            <Text style={styles.cardTag}> · {noiseMeta.tag}</Text>
          </Text>
          <Text style={styles.cardDesc} maxFontSizeMultiplier={1.3}>
            {noiseMeta.deepDive}
          </Text>
          {noiseLayers[noiseMeta.id] && (
            <View style={styles.noiseLevelRow}>
              <Text style={styles.noiseLevelLabel} maxFontSizeMultiplier={1.2}>
                Level
              </Text>
              <View style={styles.noiseSlider}>
                <NeonSlider
                  value={noiseMixToSliderNorm(noiseMix, beatSliderScale)}
                  onChange={onNoiseMixChange}
                  accent={noiseMeta.accent}
                />
              </View>
              <Text style={styles.noiseLevelPct} maxFontSizeMultiplier={1.2}>
                {Math.round(noiseMix * 100)}%
              </Text>
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
  noiseSectionLabel: {
    marginTop: 14,
  },
  engineList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  engineRowActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.08)',
  },
  engineRowLocked: {
    opacity: 0.78,
  },
  engineRowBody: {
    flex: 1,
    gap: 4,
  },
  engineRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  engineRowTitleActive: {
    color: HertzTheme.neon.cyan,
  },
  engineRowTag: {
    fontWeight: '500',
    color: HertzTheme.text.secondary,
  },
  engineRowDesc: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    lineHeight: 16,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: HertzTheme.neon.cyan,
    flexShrink: 0,
  },
  lockIcon: {
    fontSize: 14,
    flexShrink: 0,
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
    gap: 10,
  },
  comingSoonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  comingSoonIconText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  comingSoonInfo: {
    flex: 1,
    gap: 2,
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  comingSoonSubtitle: {
    fontSize: 11,
    color: HertzTheme.text.muted,
    lineHeight: 16,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(147,197,253,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.3)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
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
    gap: 8,
  },
  comingSoonBodyText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.55)',
  },
  comingSoonNote: {
    fontSize: 11,
    color: HertzTheme.neon.amber,
  },
  noiseWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  noiseChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noiseChipText: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.4,
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
