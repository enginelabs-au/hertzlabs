import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import {channelFrequencies, clampDriftHz} from '../../audio/channelFrequencies';
import type {DialValues} from '../CircularController/useDialSharedValues';
import {formatBeatDisplay, formatBeatUnit, getBand} from '../ReadoutPanel/brainwaveBands';
import {quantizeBeatForDisplayWorklet} from '../../audio/beatHzSliderWorklet';
import {HubVolumeKnob} from '../hub/HubVolumeKnob';
import {DriftKnob} from '../player/DriftKnob';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

type ChannelReadoutRowProps = {
  /** When provided, TARGET / L / R follow the live UI-thread values during a drag. */
  dialValues?: DialValues;
};

/** LEFT · TARGET · RIGHT readouts with drift knobs under L/R and volume under TARGET. */
export function ChannelReadoutRow({dialValues}: ChannelReadoutRowProps = {}) {
  const carrierStore = useHertzStore(s => s.carrierHz);
  const beatStore = useHertzStore(s => s.beatHz);
  const gain = useHertzStore(s => s.gain);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));
  const setParam = useHertzStore(s => s.setParam);

  // Live carrier/beat follow the shared values during a drag (UI thread, no
  // bridge), and snap to the committed store value on release / when idle.
  const [carrier, setCarrier] = useState(carrierStore);
  const [beat, setBeat] = useState(beatStore);
  useEffect(() => setCarrier(carrierStore), [carrierStore]);
  useEffect(() => setBeat(beatStore), [beatStore]);

  const carrierSV = dialValues?.carrierHz;
  const beatSV = dialValues?.beatHz;
  useAnimatedReaction(
    () => (carrierSV ? Math.round(carrierSV.value * 10) / 10 : null),
    (curr, prev) => {
      if (curr != null && curr !== prev) {
        runOnJS(setCarrier)(curr);
      }
    },
    [carrierSV],
  );
  useAnimatedReaction(
    () => {
      'worklet';
      if (!beatSV) {
        return null;
      }
      return quantizeBeatForDisplayWorklet(beatSV.value);
    },
    (curr, prev) => {
      if (curr != null && curr !== prev) {
        runOnJS(setBeat)(curr);
      }
    },
    [beatSV],
  );

  const onLeftDrift = useCallback((hz: number) => setParam('leftDriftHz', hz), [setParam]);
  const onRightDrift = useCallback((hz: number) => setParam('rightDriftHz', hz), [setParam]);
  const onGainChange = useCallback((g: number) => setParam('gain', g), [setParam]);

  // L/R = carrier ± beat/2 in both modes. In Experimental the carrier is the
  // user-set pitch (up to 20 kHz via the Ω−/Ω+ dials), so L/R show that pitch.
  const {leftHz, rightHz} = channelFrequencies(carrier, beat, leftDriftHz, rightDriftHz);
  const band = getBand(beat);
  const bandColor = band.hexColor;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.sideCol}>
          <View style={styles.sideCard}>
            <Text style={styles.sideLabel}>LEFT</Text>
            <Text style={styles.sideHz} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {formatBeatDisplay(leftHz)}
            </Text>
            <Text style={[styles.sideUnit, {color: HertzTheme.channel.left}]}>{formatBeatUnit(leftHz)}</Text>
          </View>
          <DriftKnob
            label="DRIFT L"
            driftHz={leftDriftHz}
            onChange={onLeftDrift}
            accent={HertzTheme.channel.left}
          />
        </View>

        <View style={styles.targetCol}>
          <View style={[styles.targetCard, {borderColor: `${bandColor}66`}]}>
            <Text style={[styles.targetLabel, {color: bandColor}]}>TARGET</Text>
            <Text style={[styles.targetHz, {color: bandColor}]}>{formatBeatDisplay(beat)}</Text>
            <Text style={[styles.targetUnit, {color: bandColor}]}>{formatBeatUnit(beat)}</Text>
            <View style={[styles.bandPill, {borderColor: `${bandColor}99`, backgroundColor: `${bandColor}22`}]}>
              <Text
                style={[styles.bandPillText, {color: bandColor}]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {band.scientific.toUpperCase()}
              </Text>
            </View>
          </View>
          <HubVolumeKnob gain={gain} onChangeGain={onGainChange} />
        </View>

        <View style={styles.sideCol}>
          <View style={styles.sideCard}>
            <Text style={styles.sideLabel}>RIGHT</Text>
            <Text style={[styles.sideHz, styles.rightHz]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {formatBeatDisplay(rightHz)}
            </Text>
            <Text style={[styles.sideUnit, styles.rightUnit]}>{formatBeatUnit(rightHz)}</Text>
          </View>
          <DriftKnob
            label="DRIFT R"
            driftHz={rightDriftHz}
            onChange={onRightDrift}
            accent={HertzTheme.channel.right}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  sideCol: {
    flex: 1,
  },
  targetCol: {
    flex: 1.15,
    alignItems: 'center',
  },
  sideCard: {
    backgroundColor: HertzTheme.glassFill,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sideLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 1,
  },
  sideHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 22,
    fontWeight: '600',
    color: HertzTheme.channel.left,
    marginTop: 2,
  },
  rightHz: {
    color: HertzTheme.channel.right,
  },
  sideUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
  },
  rightUnit: {
    color: HertzTheme.channel.right,
  },
  targetCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  targetHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 2,
  },
  targetUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
  },
  bandPill: {
    marginTop: 6,
    alignSelf: 'stretch',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  bandPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
