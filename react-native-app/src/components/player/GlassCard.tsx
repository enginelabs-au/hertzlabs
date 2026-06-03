import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';

type GlassCardProps = ViewProps & {
  children: React.ReactNode;
  padding?: number;
};

export function GlassCard({children, style, padding = 16, ...rest}: GlassCardProps) {
  return (
    <View style={[styles.card, {padding}, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HertzTheme.glassFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    overflow: 'hidden',
  },
});
