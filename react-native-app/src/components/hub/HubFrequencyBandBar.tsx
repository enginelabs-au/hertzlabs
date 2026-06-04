import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BRAINWAVE_BANDS, getBandIndex} from '../ReadoutPanel/brainwaveBands';
import {HertzTheme} from '../../theme/hertzTheme';

type HubFrequencyBandBarProps = {
  beatHz: number;
  width: number;
  onSelectBand?: (midHz: number) => void;
  /** Full-width strip below the visualizer (high contrast). */
  standalone?: boolean;
  /** @deprecated Use standalone */
  compact?: boolean;
};

function segmentMidHz(index: number): number {
  const band = BRAINWAVE_BANDS[index];
  const max = band.maxHz === Infinity ? 65 : band.maxHz;
  if (band.minHz === 0 && max <= 0.5) {
    return 0.25;
  }
  return (band.minHz + max) / 2;
}

/** Coloured brainwave band strip; highlights the band for the current beat Hz. */
export function HubFrequencyBandBar({
  beatHz,
  width,
  onSelectBand,
  standalone = false,
  compact = false,
}: HubFrequencyBandBarProps) {
  const isStandalone = standalone || !compact;
  const activeIndex = getBandIndex(beatHz);
  const segmentW = width / BRAINWAVE_BANDS.length;

  const segments = useMemo(
    () =>
      BRAINWAVE_BANDS.map((band, i) => ({
        ...band,
        active: i === activeIndex,
      })),
    [activeIndex],
  );

  return (
    <View style={[styles.row, isStandalone && styles.rowStandalone, {width}]}>
      {segments.map((seg, i) => (
        <Pressable
          key={seg.label}
          style={[
            styles.segment,
            isStandalone && styles.segmentStandalone,
            {
              width: segmentW,
              backgroundColor: seg.hexColor,
              opacity: seg.active ? 1 : isStandalone ? 0.72 : 0.42,
            },
            i === 0 && styles.segmentFirst,
            i === segments.length - 1 && styles.segmentLast,
            seg.active && styles.segmentActive,
          ]}
          onPress={() => onSelectBand?.(segmentMidHz(i))}
          accessibilityRole="button"
          accessibilityLabel={`${seg.label} ${seg.rangeLabel}`}>
          <Text
            style={[styles.segLabel, isStandalone && styles.segLabelStandalone, seg.active && styles.segLabelActive]}
            numberOfLines={1}>
            {seg.label}
          </Text>
          <Text
            style={[styles.segRange, isStandalone && styles.segRangeStandalone, seg.active && styles.segRangeActive]}
            numberOfLines={1}>
            {seg.rangeLabel}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: 44,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  rowStandalone: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  segmentStandalone: {
    paddingVertical: 6,
  },
  segmentFirst: {
    borderBottomLeftRadius: 10,
    borderTopLeftRadius: 10,
  },
  segmentLast: {
    borderBottomRightRadius: 10,
    borderTopRightRadius: 10,
  },
  segmentActive: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  segLabel: {
    fontSize: 6,
    fontWeight: '800',
    letterSpacing: 0.15,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
  },
  segLabelStandalone: {
    fontSize: 7,
    letterSpacing: 0.05,
    color: 'rgba(0,0,0,0.72)',
  },
  segLabelActive: {
    color: 'rgba(0,0,0,0.88)',
  },
  segRange: {
    fontFamily: HertzTheme.mono,
    fontSize: 5,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.5)',
    marginTop: 2,
    textAlign: 'center',
  },
  segRangeStandalone: {
    fontSize: 6,
    marginTop: 1,
    color: 'rgba(0,0,0,0.58)',
  },
  segRangeActive: {
    color: 'rgba(0,0,0,0.78)',
  },
});
