import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {BRAINWAVE_BANDS, getBandIndex, railBands} from '../ReadoutPanel/brainwaveBands';
import {HertzTheme} from '../../theme/hertzTheme';

type HubBandRailProps = {
  /** Committed beat Hz (store) — used for the initial / idle highlight. */
  beatHz: number;
  /** Live beat Hz (UI thread) — highlight follows the drag, not just the release. */
  beatHzLive?: SharedValue<number>;
  height: number;
  width: number;
  onSelectBand?: (midHz: number) => void;
  /** Experimental mode reveals the >500 Hz audible-range band cell. */
  experimental?: boolean;
  /** Override band list (e.g. Simple Home 0–40 Hz). */
  bands?: readonly (typeof BRAINWAVE_BANDS)[number][];
  /** Gap between band cells (default 2). */
  cellGap?: number;
  /** Clamp selected mid-Hz to this ceiling. */
  maxSelectHz?: number;
};

/** Representative Hz for a band (used when a cell is tapped). */
function midHzForBand(
  band: (typeof BRAINWAVE_BANDS)[number],
  maxSelectHz?: number,
): number {
  let max = Number.isFinite(band.maxHz) ? band.maxHz : band.minHz + 1;
  if (maxSelectHz != null) {
    max = Math.min(max, maxSelectHz);
  }
  if (band.minHz === 0 && max <= 0.5) {
    return 0.25;
  }
  const mid = (band.minHz + max) / 2;
  return maxSelectHz != null ? Math.min(mid, maxSelectHz) : mid;
}

/**
 * Vertical brainwave band rail down the left edge of the hub (mirrors the phase
 * slider on the right). All band cells are sized to fit the rail height — no
 * nested scroll so every band is visible at once.
 */
export function HubBandRail({
  beatHz,
  beatHzLive,
  height,
  width,
  onSelectBand,
  experimental = false,
  bands: bandsProp,
  cellGap = 2,
  maxSelectHz,
}: HubBandRailProps) {
  const [activeIndex, setActiveIndex] = useState(() => getBandIndex(beatHz));
  useEffect(() => setActiveIndex(getBandIndex(beatHz)), [beatHz]);
  useAnimatedReaction(
    () => (beatHzLive ? getBandIndex(beatHzLive.value) : -1),
    (idx, prev) => {
      if (idx >= 0 && idx !== prev) {
        runOnJS(setActiveIndex)(idx);
      }
    },
    [beatHzLive],
  );

  const bands = bandsProp ?? railBands(experimental);

  const {cellHeight, labelSize, rangeSize} = useMemo(() => {
    const verticalPad = 8;
    const gapTotal = cellGap * Math.max(0, bands.length - 1);
    const available = Math.max(0, height - verticalPad - gapTotal);
    const perCell = bands.length > 0 ? available / bands.length : 0;
    const h = Math.max(16, perCell);
    return {
      cellHeight: h,
      labelSize: Math.min(8, Math.max(5.5, h * 0.3)),
      rangeSize: Math.min(6.5, Math.max(4.5, h * 0.24)),
    };
  }, [bands.length, cellGap, height]);

  return (
    <View style={[styles.rail, {width, height}]}>
      <View style={[styles.railInner, {gap: cellGap}]}>
        {bands.map(band => {
          const globalIdx = BRAINWAVE_BANDS.findIndex(b => b.label === band.label);
          const active = globalIdx === activeIndex;
          const hex = band.hexColor;
          return (
            <Pressable
              key={band.label}
              onPress={() => onSelectBand?.(midHzForBand(band, maxSelectHz))}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              accessibilityLabel={`${band.scientific} (${band.label}) ${band.rangeLabel}`}
              style={[
                styles.cell,
                {height: cellHeight, borderLeftColor: hex, backgroundColor: active ? `${hex}33` : `${hex}12`},
                active && {
                  borderColor: hex,
                  borderWidth: 1,
                  shadowColor: hex,
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  shadowOffset: {width: 0, height: 0},
                  elevation: 4,
                },
              ]}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
                style={[styles.label, {color: hex, opacity: active ? 1 : 0.82, fontSize: labelSize}]}>
                {band.label}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
                style={[styles.range, {color: hex, opacity: active ? 0.9 : 0.55, fontSize: rangeSize}]}>
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
  rail: {
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  railInner: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  cell: {
    borderLeftWidth: 3,
    borderRadius: 5,
    paddingLeft: 4,
    paddingRight: 2,
    paddingVertical: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  range: {
    fontFamily: HertzTheme.mono,
    fontWeight: '600',
    marginTop: 0,
  },
});
