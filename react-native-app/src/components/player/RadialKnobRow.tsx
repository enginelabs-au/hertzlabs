import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {beatHzToSliderNorm, sliderNormToBeatHz} from '../../audio/beatHzSlider';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {RadialKnob} from './RadialKnob';

export function RadialKnobRow() {
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const beatSliderScale = useHertzStore(s => s.beatSliderScale);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);
  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);

  const onCarrierChange = useCallback((v: number) => setParam('carrierHz', v), [setParam]);
  const onBeatNormChange = useCallback(
    (norm: number) => setParam('beatHz', sliderNormToBeatHz(norm, tier, beatSliderScale)),
    [setParam, tier, beatSliderScale],
  );
  const onPhaseChange = useCallback((v: number) => setParam('phaseAngle', v), [setParam]);
  const onBalanceChange = useCallback((v: number) => setParam('balance', v), [setParam]);
  const onGainChange = useCallback((v: number) => setParam('gain', v), [setParam]);

  return (
    <View style={styles.row}>
      <RadialKnob
        label="Carrier Rate"
        value={carrierHz}
        min={20}
        max={1500}
        color={HertzTheme.neon.cyan}
        onChange={onCarrierChange}
        format={v => `${Math.round(v)}`}
      />
      <RadialKnob
        label="Beat Delta"
        value={beatHzToSliderNorm(beatHz, tier, beatSliderScale)}
        min={0}
        max={1}
        color={HertzTheme.neon.magenta}
        onChange={onBeatNormChange}
        format={() => beatHz.toFixed(beatHz >= 1 ? 1 : 2)}
      />
      <RadialKnob
        label="Phase Shift"
        value={phaseAngle}
        min={0}
        max={360}
        color={HertzTheme.neon.purple}
        onChange={onPhaseChange}
        format={v => `${Math.round(v)}°`}
      />
      <RadialKnob
        label="Spatial Pan"
        value={balance}
        min={-1}
        max={1}
        color={HertzTheme.neon.green}
        onChange={onBalanceChange}
        format={v => v.toFixed(2)}
      />
      <RadialKnob
        label="Wet / Dry"
        value={gain}
        min={0}
        max={1}
        color={HertzTheme.neon.amber}
        onChange={onGainChange}
        format={v => `${Math.round(v * 100)}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
