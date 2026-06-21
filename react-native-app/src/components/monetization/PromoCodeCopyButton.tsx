import React, {useCallback} from 'react';
import {Alert, Pressable, StyleSheet, Text} from 'react-native';
import {formatPromoCodeDisplay} from '../../monetization/promoCodeFormat';
import {copyPromoToClipboard} from '../../monetization/promoClipboard';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

type PromoCodeCopyButtonProps = {
  code: string;
  label?: string;
  compact?: boolean;
};

export function PromoCodeCopyButton({code, label = 'Copy', compact = false}: PromoCodeCopyButtonProps) {
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);
  const display = formatPromoCodeDisplay(code);

  const onCopy = useCallback(() => {
    void copyPromoToClipboard(display).then(method => {
      setClipboardPromoCode(display);
      if (method === 'clipboard') {
        Alert.alert('Copied', `${display} copied — paste it on the Plans screen.`);
      } else if (method === 'share') {
        Alert.alert('Copied', `${display} ready to share — paste it on the Plans screen.`);
      } else {
        Alert.alert('Copy failed', 'Could not copy the code. Try again or type it manually.');
      }
    });
  }, [display, setClipboardPromoCode]);

  return (
    <Pressable
      style={[styles.btn, compact && styles.btnCompact]}
      onPress={onCopy}
      accessibilityRole="button"
      accessibilityLabel={`Copy promo code ${display}`}>
      <Text style={[styles.btnText, compact && styles.btnTextCompact]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  btnCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  btnTextCompact: {
    fontSize: 9,
  },
});
