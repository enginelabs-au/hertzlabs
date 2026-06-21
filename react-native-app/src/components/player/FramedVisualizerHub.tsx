import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {
  beatHzFreeCapNorm,
  beatHzInteractionLimitsForTier,
  beatHzSliderTrackLimits,
  beatHzToSliderNorm,
  beatSliderScaleToWorklet,
  sliderNormToBeatHz,
} from '../../audio/beatHzSlider';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {quantizeBeatForDisplayWorklet} from '../../audio/beatHzSliderWorklet';
import {BeatSliderScaleToggle} from './BeatSliderScaleToggle';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {commitBeatHzSelection} from '../../audio/commitBeatHzSelection';
import {
  AUDIBLE_CEILING_HZ,
  AUDIBLE_FLOOR_HZ,
  DEFAULT_BEAT_HZ,
  DEFAULT_CARRIER_HZ,
} from '../../audio/paramMapping';
import {useHubLayout} from '../../hooks/useHubLayout';
import type {DialValues} from '../CircularController/useDialSharedValues';
import type {useDialGestures} from '../CircularController/useDialGestures';
import {
  BRAINWAVE_BANDS,
  EXPERIMENTAL_BAND_INDEX,
  formatBeatDisplay,
  formatBeatUnit,
  getBand,
} from '../ReadoutPanel/brainwaveBands';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {macScaledFont} from '../../platform/macTypography';
import {AdvancedHubHorizontalBands} from '../home/HomeFreqControls';
import {HubOscilloscopeCanvas} from '../waveforms';
import {ExperimentalDial} from './ExperimentalDial';
import {GlassCard} from './GlassCard';
import {NeonSlider} from './NeonSlider';
import {NeonVerticalSlider} from './NeonVerticalSlider';

const EXPERIMENTAL_COLOR = BRAINWAVE_BANDS[EXPERIMENTAL_BAND_INDEX].hexColor;

/** Split point between the LOW Ω− (pitch) dial and the HIGH Ω+ (pitch) dial. */
const EXP_PITCH_SPLIT_HZ = 500;

type FramedVisualizerHubProps = {
  dialValues: DialValues;
  gesture: ReturnType<typeof useDialGestures>['composedGesture'];
};

/**
 * Beat-Hz label under the slider that follows the live UI-thread value during a
 * drag. Isolated into its own component so per-frame updates re-render only this
 * text node — not the oscilloscope canvas or the sliders.
 */
function HubDockBeatLabel({
  beatSV,
  fallback,
}: {
  beatSV: SharedValue<number>;
  fallback: number;
}) {
  const [beat, setBeat] = useState(fallback);
  useEffect(() => setBeat(fallback), [fallback]);
  useAnimatedReaction(
    () => {
      'worklet';
      return quantizeBeatForDisplayWorklet(beatSV.value);
    },
    (curr, prev) => {
      if (curr !== prev) {
        runOnJS(setBeat)(curr);
      }
    },
    [],
  );
  return (
    <Text style={[styles.beatLabel, {color: getBand(beat).hexColor}]}>
      {formatBeatDisplay(beat)} {formatBeatUnit(beat)}
    </Text>
  );
}

export function FramedVisualizerHub({dialValues, gesture}: FramedVisualizerHubProps) {
  const {hubW, frameH, canvasH, canvasW, beatSliderW, beatSliderH, experimental, isMacWide} =
    useHubLayout();

  const setParam = useHertzStore(s => s.setParam);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const tier = useHertzStore(s => s.tier);
  const beatSliderScale = useHertzStore(s => s.beatSliderScale);
  const premiumUnlocked = isPremiumUnlocked(tier);
  const storeBeat = useHertzStore(s => s.beatHz);
  const storeCarrier = useHertzStore(s => s.carrierHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));

  const bandHex = useMemo(() => getBand(storeBeat).hexColor, [storeBeat]);
  const beatNorm = beatHzToSliderNorm(storeBeat, tier, beatSliderScale);

  // Live band hue on the UI thread so the slider accent follows the drag (the
  // waveform + readouts already do). Snaps to the committed hue when idle.
  const liveAccent = useDerivedValue<string>(
    () => getBand(dialValues.beatHz.value).hexColor,
    [dialValues],
  );

  // Full premium track on the UI thread; free tier clamps interaction at 40 Hz.
  const {min: trackMin, max: trackMax} = beatHzSliderTrackLimits();
  const {min: interactMin, max: interactMax} = beatHzInteractionLimitsForTier(tier);
  const beatSliderMinHz = useSharedValue(trackMin);
  const beatSliderMaxHz = useSharedValue(trackMax);
  const beatSliderScaleSV = useSharedValue(beatSliderScaleToWorklet(beatSliderScale));
  const lockedNormStart = premiumUnlocked ? undefined : beatHzFreeCapNorm(beatSliderScale);
  useEffect(() => {
    beatSliderMinHz.value = trackMin;
    beatSliderMaxHz.value = trackMax;
    beatSliderScaleSV.value = beatSliderScaleToWorklet(beatSliderScale);
  }, [trackMin, trackMax, beatSliderScale, beatSliderMinHz, beatSliderMaxHz, beatSliderScaleSV]);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  const onBeatSliderChange = useCallback(
    (v: number) => {
      setParam('beatHz', sliderNormToBeatHz(v, tier, beatSliderScale));
    },
    [setParam, tier, beatSliderScale],
  );

  const onBeatSliderComplete = useCallback(
    (v: number) => {
      setParam('beatHz', sliderNormToBeatHz(v, tier, beatSliderScale));
    },
    [setParam, tier, beatSliderScale],
  );

  const onSelectBandBeat = useCallback(
    (hz: number) => {
      commitBeatHzSelection(dialValues, hz, setParam);
    },
    [dialValues, setParam],
  );

  // Tap-to-reset target for every beat control (slider + experimental dials).
  const onBeatReset = useCallback(() => {
    setParam('beatHz', DEFAULT_BEAT_HZ);
  }, [setParam]);

  // Experimental Ω−/Ω+ dials set the produced PITCH (carrier), not the beat.
  const onCarrierCommit = useCallback(
    (hz: number) => {
      setParam('carrierHz', hz);
    },
    [setParam],
  );

  const onHubDragBegin = useCallback(() => {
    dialValues.gestureActive.value = true;
  }, [dialValues.gestureActive]);

  const onHubDragEnd = useCallback(() => {
    dialValues.gestureActive.value = false;
  }, [dialValues.gestureActive]);

  const onPhaseComplete = useCallback(
    (deg: number) => {
      setParam('phaseAngle', deg);
    },
    [setParam],
  );

  const beatSlider = (
    <NeonSlider
      value={beatNorm}
      beatHzOut={dialValues.beatHz}
      beatSliderMinHz={beatSliderMinHz}
      beatSliderMaxHz={beatSliderMaxHz}
      beatSliderScale={beatSliderScaleSV}
      lockedNormStart={lockedNormStart}
      onLockedZonePress={premiumUnlocked ? undefined : openPaywall}
      onChange={onBeatSliderChange}
      onChangeComplete={onBeatSliderComplete}
      onDragBegin={onHubDragBegin}
      onDragEnd={onHubDragEnd}
      accent={bandHex}
      accentValue={liveAccent}
      resetBeatHz={DEFAULT_BEAT_HZ}
      onReset={onBeatReset}
    />
  );

  return (
    <View style={[styles.outer, isMacWide && styles.outerMac]}>
      <GlassCard style={[styles.frame, {width: hubW, height: frameH}]} padding={0}>
        <View style={[styles.hubInner, {width: hubW, height: frameH}]}>
          <View style={[styles.canvasColumn, {width: canvasW, height: frameH}]}>
            <GestureDetector gesture={gesture}>
              <View style={[styles.canvasBox, {width: canvasW, height: canvasH}]}>
                <HubOscilloscopeCanvas
                  width={canvasW}
                  height={canvasH}
                  dialValues={dialValues}
                  leftDriftHz={leftDriftHz}
                  rightDriftHz={rightDriftHz}
                  beatHz={storeBeat}
                  experimental={experimental}
                />
              </View>
            </GestureDetector>
            <View style={[styles.beatSliderDock, {width: canvasW, height: beatSliderH}]}>
              <View style={styles.beatDockHeader}>
                <HubDockBeatLabel beatSV={dialValues.beatHz} fallback={storeBeat} />
                <BeatSliderScaleToggle />
              </View>
              {experimental ? (
                <View style={styles.expRow}>
                  <ExperimentalDial
                    label="LOW Ω−"
                    caption="20–500 Hz"
                    color={EXPERIMENTAL_COLOR}
                    valueLive={dialValues.carrierHz}
                    committedValue={storeCarrier}
                    dialMin={AUDIBLE_FLOOR_HZ}
                    dialMax={EXP_PITCH_SPLIT_HZ}
                    absMin={AUDIBLE_FLOOR_HZ}
                    absMax={AUDIBLE_CEILING_HZ}
                    defaultValue={DEFAULT_CARRIER_HZ}
                    onCommit={onCarrierCommit}
                    gestureActive={dialValues.gestureActive}
                  />
                  <View style={styles.expSliderFlex}>{beatSlider}</View>
                  <ExperimentalDial
                    label="HIGH Ω+"
                    caption="0.5–20 kHz"
                    color={EXPERIMENTAL_COLOR}
                    valueLive={dialValues.carrierHz}
                    committedValue={storeCarrier}
                    dialMin={EXP_PITCH_SPLIT_HZ}
                    dialMax={AUDIBLE_CEILING_HZ}
                    absMin={AUDIBLE_FLOOR_HZ}
                    absMax={AUDIBLE_CEILING_HZ}
                    defaultValue={DEFAULT_CARRIER_HZ}
                    onCommit={onCarrierCommit}
                    gestureActive={dialValues.gestureActive}
                  />
                </View>
              ) : (
                <View style={{width: beatSliderW}}>{beatSlider}</View>
              )}
            </View>
          </View>
          <NeonVerticalSlider
            embedded
            valueDeg={phaseAngle}
            linkedPhaseDeg={dialValues.phaseAngle}
            onChangeDegComplete={onPhaseComplete}
            accent={HertzTheme.channel.phase}
            height={frameH}
          />
        </View>
      </GlassCard>
      <AdvancedHubHorizontalBands
        hubWidth={hubW}
        experimental={experimental}
        beatHzLive={dialValues.beatHz}
        gestureActive={dialValues.gestureActive}
        onSelectBeat={onSelectBandBeat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  outerMac: {
    alignItems: 'stretch',
    paddingHorizontal: 24,
  },
  frame: {
    overflow: 'hidden',
  },
  hubInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  canvasColumn: {
    flexDirection: 'column',
  },
  canvasBox: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  beatDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    gap: 8,
  },
  beatSliderDock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  expSliderFlex: {
    flex: 1,
  },
  beatLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: macScaledFont(10),
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
