import React from 'react';
import {StyleSheet, View} from 'react-native';

type MicIconProps = {
  size?: number;
  color?: string;
};

/** Standard outline microphone glyph (common AI chat input style). */
export function MicIcon({size = 20, color = '#FFFFFF'}: MicIconProps) {
  const stroke = Math.max(1.5, size * 0.09);
  const capsuleW = size * 0.44;
  const capsuleH = size * 0.58;
  const arcW = size * 0.68;
  const arcH = size * 0.38;

  return (
    <View style={[styles.root, {width: size, height: size}]}>
      <View
        style={{
          width: capsuleW,
          height: capsuleH,
          borderRadius: capsuleW / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.1,
          width: arcW,
          height: arcH,
          borderBottomLeftRadius: arcW / 2,
          borderBottomRightRadius: arcW / 2,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: stroke,
          height: size * 0.2,
          backgroundColor: color,
          borderRadius: stroke,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: size * 0.46,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
