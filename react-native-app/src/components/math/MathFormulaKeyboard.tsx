import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';
import {MATH_FORMULA_SYMBOLS} from './evaluateMathFormula';

type MathFormulaKeyboardProps = {
  onInsert: (token: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onApply: () => void;
  liveHint?: string;
};

type KeyDef = {
  token: string;
  label: string;
  variant?: 'accent' | 'action' | 'wide';
  flex?: number;
};

const VARIABLE_KEYS: KeyDef[] = MATH_FORMULA_SYMBOLS.filter(s =>
  ['f_L', 'f_R', 'f_beat', 'f_c'].includes(s.token),
).map(s => ({token: s.token, label: s.label, variant: 'accent' as const}));

const SYMBOL_KEYS: KeyDef[] = MATH_FORMULA_SYMBOLS.filter(s =>
  ['|', 'φ', 'π', 'sqrt(', '(', ')', '+', '-', '*', '/', '**', '.'].includes(s.token),
).map(s => ({
  token: s.token,
  label: s.label,
  variant: ['|', 'φ', 'π', 'sqrt('].includes(s.token) ? ('accent' as const) : undefined,
}));

const NUMBER_ROWS: KeyDef[][] = [
  [
    {token: '7', label: '7'},
    {token: '8', label: '8'},
    {token: '9', label: '9'},
    {token: '/', label: '÷'},
    {token: 'backspace', label: '⌫', variant: 'action'},
  ],
  [
    {token: '4', label: '4'},
    {token: '5', label: '5'},
    {token: '6', label: '6'},
    {token: '*', label: '×'},
    {token: '(', label: '('},
  ],
  [
    {token: '1', label: '1'},
    {token: '2', label: '2'},
    {token: '3', label: '3'},
    {token: '-', label: '−'},
    {token: ')', label: ')'},
  ],
  [
    {token: '0', label: '0', flex: 2},
    {token: '.', label: '.'},
    {token: '+', label: '+'},
    {token: '**', label: 'x^y'},
  ],
];

function KeyButton({
  keyDef,
  onPress,
}: {
  keyDef: KeyDef;
  onPress: () => void;
}) {
  const variant = keyDef.variant;
  return (
    <Pressable
      style={({pressed}) => [
        styles.key,
        keyDef.flex != null && {flex: keyDef.flex},
        variant === 'accent' && styles.keyAccent,
        variant === 'action' && styles.keyAction,
        pressed && styles.keyPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={keyDef.label}>
      <Text
        style={[
          styles.keyLabel,
          variant === 'accent' && styles.keyLabelAccent,
          variant === 'action' && styles.keyLabelAction,
        ]}>
        {keyDef.label}
      </Text>
    </Pressable>
  );
}

export function MathFormulaKeyboard({
  onInsert,
  onBackspace,
  onClear,
  onApply,
  liveHint,
}: MathFormulaKeyboardProps) {
  const handleKey = useCallback(
    (keyDef: KeyDef) => {
      if (keyDef.token === 'backspace') {
        onBackspace();
        return;
      }
      onInsert(keyDef.token);
    },
    [onBackspace, onInsert],
  );

  return (
    <View style={styles.root}>
      {liveHint != null && liveHint.length > 0 && (
        <Text style={styles.liveHint}>{liveHint}</Text>
      )}

      <View style={styles.row}>
        {VARIABLE_KEYS.map(keyDef => (
          <KeyButton
            key={keyDef.token}
            keyDef={keyDef}
            onPress={() => handleKey(keyDef)}
          />
        ))}
      </View>

      <View style={styles.row}>
        {SYMBOL_KEYS.filter(s => ['|', 'φ', 'π', 'sqrt('].includes(s.token)).map(
          keyDef => (
            <KeyButton
              key={keyDef.token}
              keyDef={keyDef}
              onPress={() => handleKey(keyDef)}
            />
          ),
        )}
      </View>

      {NUMBER_ROWS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map(keyDef => (
            <KeyButton
              key={keyDef.token}
              keyDef={keyDef}
              onPress={() => handleKey(keyDef)}
            />
          ))}
        </View>
      ))}

      <View style={styles.footerRow}>
        <Pressable
          style={({pressed}) => [styles.footerBtn, styles.clearBtn, pressed && styles.keyPressed]}
          onPress={onClear}
          accessibilityRole="button">
          <Text style={styles.footerBtnText}>Clear</Text>
        </Pressable>
        <Pressable
          style={({pressed}) => [styles.footerBtn, styles.applyBtn, pressed && styles.keyPressed]}
          onPress={onApply}
          accessibilityRole="button">
          <Text style={[styles.footerBtnText, styles.applyBtnText]}>Apply →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 6,
  },
  liveHint: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.neon.cyan,
    textAlign: 'center',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  key: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  keyAccent: {
    borderColor: 'rgba(92,225,255,0.35)',
    backgroundColor: 'rgba(92,225,255,0.08)',
  },
  keyAction: {
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  keyPressed: {
    opacity: 0.65,
  },
  keyLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 13,
    color: HertzTheme.text.primary,
    fontWeight: '600',
  },
  keyLabelAccent: {
    color: HertzTheme.neon.cyan,
  },
  keyLabelAction: {
    color: HertzTheme.neon.amber,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  footerBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  clearBtn: {
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  applyBtn: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.15)',
  },
  footerBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.text.secondary,
  },
  applyBtnText: {
    color: HertzTheme.neon.cyan,
  },
});
