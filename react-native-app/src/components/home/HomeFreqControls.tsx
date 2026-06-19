import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  beatHzFreeCapNorm,
  beatHzInteractionLimitsForTier,
  beatHzToSliderNorm,
  sliderNormToBeatHz,
} from '../../audio/beatHzSlider';
import {MAX_BEAT_HZ} from '../../audio/paramMapping';
import type {BeatSliderScale} from '../../audio/beatHzSlider';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {
  formatBeatDisplay,
  formatBeatUnit,
  getBand,
  simpleHomeRailBands,
} from '../ReadoutPanel/brainwaveBands';
import {NeonSlider} from '../player/NeonSlider';
import {useHertzStore} from '../../state/store';
import type {SubscriptionTier} from '../../state/types';
import {HertzTheme} from '../../theme/hertzTheme';

function midHzForBand(
  band: ReturnType<typeof simpleHomeRailBands>[number],
): number {
  const max = Math.min(Number.isFinite(band.maxHz) ? band.maxHz : band.minHz + 1, MAX_BEAT_HZ);
  if (band.minHz === 0 && max <= 0.5) {
    return 0.25;
  }
  return Math.min((band.minHz + max) / 2, MAX_BEAT_HZ);
}

function normToHomeBeatHz(
  norm: number,
  tier: SubscriptionTier,
  scale: BeatSliderScale,
): number {
  return Math.min(sliderNormToBeatHz(norm, tier, scale), MAX_BEAT_HZ);
}

/** Beat Hz slider — above the band strip (Home) or under volume (Engines). */
export function HomeBeatSlider({compact = false}: {compact?: boolean}) {
  const beatHz = useHertzStore(s => s.beatHz);
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const beatSliderScale = useHertzStore(s => s.beatSliderScale);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const premiumUnlocked = isPremiumUnlocked(tier);
  const band = getBand(beatHz);
  const beatNorm = beatHzToSliderNorm(beatHz, tier, beatSliderScale);
  const lockedNormStart = premiumUnlocked ? undefined : beatHzFreeCapNorm(beatSliderScale);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  const onSliderChange = useCallback(
    (norm: number) => {
      const hz = normToHomeBeatHz(norm, tier, beatSliderScale);
      if (!premiumUnlocked && hz > beatHzInteractionLimitsForTier(tier).max) {
        openPaywall();
        return;
      }
      setParam('beatHz', hz);
    },
    [setParam, tier, beatSliderScale, premiumUnlocked, openPaywall],
  );

  return (
    <View style={[styles.sliderWrap, compact && styles.sliderWrapCompact]}>
      {!compact && <Text style={styles.heading}>Target frequency</Text>}
      <View style={[styles.readoutRow, compact && styles.readoutRowCompact]}>
        <Text style={[styles.readoutHz, compact && styles.readoutHzCompact, {color: band.hexColor}]} maxFontSizeMultiplier={1.2}>
          {formatBeatDisplay(beatHz)}
        </Text>
        <Text style={[styles.readoutUnit, compact && styles.readoutUnitCompact]} maxFontSizeMultiplier={1.2}>{formatBeatUnit(beatHz)}</Text>
        {!compact && (
          <Text style={[styles.readoutBand, {color: band.hexColor}]} maxFontSizeMultiplier={1.2}>{band.scientific.toUpperCase()}</Text>
        )}
      </View>
      <NeonSlider
        value={beatNorm}
        onChange={onSliderChange}
        onChangeComplete={onSliderChange}
        accent={band.hexColor}
        lockedNormStart={lockedNormStart}
        onLockedZonePress={premiumUnlocked ? undefined : openPaywall}
      />
    </View>
  );
}

/** Alias for Simple Mode Engines screen. */
export const SimpleBeatSlider = HomeBeatSlider;

/** Compact horizontal band strip — all bands fit on one row. */
export function HomeHorizontalBands() {
  const beatHz = useHertzStore(s => s.beatHz);
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const premiumUnlocked = isPremiumUnlocked(tier);
  const {max: interactMax} = beatHzInteractionLimitsForTier(tier);
  const activeBand = getBand(beatHz);
  const bands = simpleHomeRailBands();

  const onSelect = useCallback(
    (hz: number) => {
      if (!premiumUnlocked && hz > interactMax) {
        setActiveModal('paywall');
        return;
      }
      setParam('beatHz', hz);
    },
    [setParam, premiumUnlocked, interactMax, setActiveModal],
  );

  return (
    <View style={styles.stripWrap}>
      <Text style={styles.heading}>Frequency bands</Text>
      <View style={styles.stripRow}>
        {bands.map(band => {
          const active = band.label === activeBand.label;
          const hex = band.hexColor;
          return (
            <Pressable
              key={band.label}
              onPress={() => onSelect(midHzForBand(band))}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              accessibilityLabel={`${band.scientific} ${band.rangeLabel}`}
              style={[
                styles.chip,
                {
                  borderTopColor: hex,
                  backgroundColor: active ? `${hex}40` : `${hex}14`,
                },
                active && {borderColor: hex},
              ]}>
              <Text style={[styles.chipLabel, {color: hex}]} numberOfLines={1} adjustsFontSizeToFit>
                {band.label}
              </Text>
              <Text style={[styles.chipRange, {color: hex}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                {band.rangeLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderWrap: {
    width: '100%',
    marginBottom: 10,
  },
  sliderWrapCompact: {
    marginBottom: 0,
    width: '100%',
  },
  stripWrap: {
    width: '100%',
    marginBottom: 12,
  },
  heading: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '800',
    color: HertzTheme.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  readoutRowCompact: {
    marginBottom: 4,
    gap: 3,
  },
  readoutHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 22,
    fontWeight: '700',
  },
  readoutHzCompact: {
    fontSize: 14,
  },
  readoutUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
  },
  readoutUnitCompact: {
    fontSize: 8,
  },
  readoutBand: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 4,
  },
  stripRow: {
    flexDirection: 'row',
    gap: 3,
    width: '100%',
  },
  chip: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    borderTopWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 2,
    paddingVertical: 5,
    alignItems: 'center',
  },
  chipLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 6,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  chipRange: {
    fontFamily: HertzTheme.mono,
    fontSize: 5,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
    textAlign: 'center',
  },
});
