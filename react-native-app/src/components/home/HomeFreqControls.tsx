import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {
  beatHzFreeCapNorm,
  beatHzInteractionLimitsForTier,
  beatHzToSliderNorm,
  sliderNormToBeatHz,
} from '../../audio/beatHzSlider';
import {MAX_BEAT_HZ} from '../../audio/paramMapping';
import type {BeatSliderScale} from '../../audio/beatHzSlider';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {useLayoutProfile} from '../../platform/layoutProfile';
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

function BandChip({
  band,
  active,
  onSelect,
  labelSize,
  rangeSize,
  style,
}: {
  band: ReturnType<typeof simpleHomeRailBands>[number];
  active: boolean;
  onSelect: (hz: number) => void;
  labelSize: number;
  rangeSize: number;
  style?: object;
}) {
  const hex = band.hexColor;
  return (
    <Pressable
      onPress={() => onSelect(midHzForBand(band))}
      accessibilityRole="button"
      accessibilityState={{selected: active}}
      accessibilityLabel={`${band.scientific} ${band.rangeLabel}`}
      style={[
        styles.chip,
        style,
        {
          borderTopColor: hex,
          backgroundColor: active ? `${hex}40` : `${hex}14`,
        },
        active && {borderColor: hex},
      ]}>
      <Text
        style={[styles.chipLabel, {color: hex, fontSize: labelSize}]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}>
        {band.label}
      </Text>
      <Text
        style={[styles.chipRange, {color: hex, fontSize: rangeSize}]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}>
        {band.rangeLabel}
      </Text>
    </Pressable>
  );
}

/** Compact band strip — all bands visible without horizontal scroll. */
export function HomeHorizontalBands() {
  const beatHz = useHertzStore(s => s.beatHz);
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const premiumUnlocked = isPremiumUnlocked(tier);
  const {max: interactMax} = beatHzInteractionLimitsForTier(tier);
  const activeBand = getBand(beatHz);
  const bands = simpleHomeRailBands();
  const {width: screenWidth, fontScale} = useWindowDimensions();
  const {isMacWide} = useLayoutProfile();

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

  const layout = useMemo(() => {
    const available = Math.max(240, screenWidth - (isMacWide ? 64 : 32));
    const count = bands.length;
    const useTwoRows =
      !isMacWide && (count > 5 || available / count < 42 || fontScale > 1.15);
    const rowCount = useTwoRows ? 2 : 1;
    const cols = useTwoRows ? Math.ceil(count / rowCount) : count;
    const chipWidth = (available - (cols - 1) * 3) / cols;
    const labelSize = Math.min(6.5, Math.max(5, chipWidth * 0.14));
    const rangeSize = Math.min(5.5, Math.max(4, chipWidth * 0.11));
    const row1 = useTwoRows ? bands.slice(0, cols) : bands;
    const row2 = useTwoRows ? bands.slice(cols) : [];
    return {row1, row2, labelSize, rangeSize, chipFlex: useTwoRows ? undefined : 1};
  }, [bands, fontScale, isMacWide, screenWidth]);

  return (
    <View style={styles.stripWrap}>
      <Text style={styles.heading}>Frequency bands</Text>
      <View style={styles.stripRow}>
        {layout.row1.map(band => (
          <BandChip
            key={band.label}
            band={band}
            active={band.label === activeBand.label}
            onSelect={onSelect}
            labelSize={layout.labelSize}
            rangeSize={layout.rangeSize}
            style={layout.chipFlex != null ? {flex: layout.chipFlex} : {flex: 1, minWidth: 0}}
          />
        ))}
      </View>
      {layout.row2.length > 0 && (
        <View style={[styles.stripRow, styles.stripRowSecond]}>
          {layout.row2.map(band => (
            <BandChip
              key={band.label}
              band={band}
              active={band.label === activeBand.label}
              onSelect={onSelect}
              labelSize={layout.labelSize}
              rangeSize={layout.rangeSize}
              style={{flex: 1, minWidth: 0}}
            />
          ))}
        </View>
      )}
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
  stripRowSecond: {
    marginTop: 3,
  },
  chip: {
    minWidth: 0,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    borderTopWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: HertzTheme.mono,
    fontWeight: '800',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  chipRange: {
    fontFamily: HertzTheme.mono,
    fontWeight: '600',
    marginTop: 1,
    opacity: 0.85,
    textAlign: 'center',
  },
});
