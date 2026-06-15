import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Canvas, Path, Skia} from '@shopify/react-native-skia';
import {computeProtocolTotalSec} from '../../protocol/interpolateProtocol';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

type ChatBorderProgressProps = {
  width: number;
  height: number;
};

/** Clockwise perimeter progress around the AI chat box. */
export function ChatBorderProgress({width, height}: ChatBorderProgressProps) {
  const protocolRunning = useHertzStore(s => s.protocolRunning);
  const activeProtocol = useHertzStore(s => s.activeProtocol);
  const elapsedSec = useHertzStore(s => s.elapsedSec);
  const durationSec = useHertzStore(s => s.durationSec);
  const isPlaying = useHertzStore(s => s.isPlaying);

  const progress = useMemo(() => {
    if (protocolRunning && activeProtocol != null) {
      const total = computeProtocolTotalSec(activeProtocol);
      return total > 0 ? Math.min(1, elapsedSec / total) : 0;
    }
    if (isPlaying && durationSec > 0) {
      return Math.min(1, elapsedSec / durationSec);
    }
    return 0;
  }, [protocolRunning, activeProtocol, elapsedSec, durationSec, isPlaying]);

  const borderPath = useMemo(() => {
    const p = Skia.Path.Make();
    const inset = 2;
    p.addRect({x: inset, y: inset, width: width - inset * 2, height: height - inset * 2});
    return p;
  }, [width, height]);

  const progressPath = useMemo(() => {
    const trimmed = borderPath.copy();
    trimmed.trim(0, progress, false);
    return trimmed;
  }, [borderPath, progress]);

  return (
    <View style={[styles.wrap, {width, height}]} pointerEvents="none">
      <Canvas style={{width, height}}>
        <Path path={borderPath} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.08)" />
        {progress > 0 && (
          <Path
            path={progressPath}
            style="stroke"
            strokeWidth={2.5}
            color={HertzTheme.neon.cyan}
            strokeCap="round"
          />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
