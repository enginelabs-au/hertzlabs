import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {getStereoFrequencies} from '../../audio/paramMapping';
import {HertzTheme} from '../../theme/hertzTheme';
import {
  evaluateMathFormula,
  MATH_FORMULA_HELP,
  previewMathFormula,
  sanitizeFormulaInput,
  type MathFormulaContext,
} from './evaluateMathFormula';
import {MathFormulaKeyboard} from './MathFormulaKeyboard';
import type {FormulaAppliedPayload} from './activeFormulaDisplay';

type CustomFormulaInputProps = {
  embedded?: boolean;
  onFormulaApplied?: (payload: FormulaAppliedPayload) => void;
};

type Selection = {start: number; end: number};

function insertAtSelection(
  value: string,
  token: string,
  selection: Selection,
): {next: string; selection: Selection} {
  const start = selection.start;
  const end = selection.end;
  const next = value.slice(0, start) + token + value.slice(end);
  const cursor = start + token.length;
  return {next, selection: {start: cursor, end: cursor}};
}

function backspaceAtSelection(value: string, selection: Selection): {next: string; selection: Selection} {
  if (selection.start !== selection.end) {
    return insertAtSelection(value, '', selection);
  }
  if (selection.start === 0) {
    return {next: value, selection};
  }
  const next = value.slice(0, selection.start - 1) + value.slice(selection.start);
  const cursor = selection.start - 1;
  return {next, selection: {start: cursor, end: cursor}};
}

export function CustomFormulaInput({embedded = false, onFormulaApplied}: CustomFormulaInputProps) {
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const experimental = useHertzStore(s => s.experimentalMode);

  const [formula, setFormula] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({start: 0, end: 0});
  const inputRef = useRef<TextInput>(null);

  const formulaContext = useMemo((): MathFormulaContext => {
    const {leftHz, rightHz} = getStereoFrequencies(carrierHz, beatHz, tier, experimental);
    return {
      f_L: leftHz,
      f_R: rightHz,
      f_beat: beatHz,
      f_c: carrierHz,
    };
  }, [beatHz, carrierHz, experimental, tier]);

  const livePreview = useMemo(
    () => previewMathFormula(formula, formulaContext),
    [formula, formulaContext],
  );

  const liveHint = useMemo(
    () =>
      `Live f_L=${formulaContext.f_L.toFixed(1)} · f_R=${formulaContext.f_R.toFixed(1)} · f_beat=${formulaContext.f_beat.toFixed(2)}`,
    [formulaContext],
  );

  const applySelection = useCallback((nextSelection: Selection) => {
    setSelection(nextSelection);
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({selection: nextSelection});
    });
  }, []);

  const handleInsert = useCallback(
    (token: string) => {
      const {next, selection: nextSelection} = insertAtSelection(formula, token, selection);
      setFormula(next);
      applySelection(nextSelection);
      setResult(null);
    },
    [applySelection, formula, selection],
  );

  const handleBackspace = useCallback(() => {
    const {next, selection: nextSelection} = backspaceAtSelection(formula, selection);
    setFormula(next);
    applySelection(nextSelection);
    setResult(null);
  }, [applySelection, formula, selection]);

  const handleClear = useCallback(() => {
    setFormula('');
    applySelection({start: 0, end: 0});
    setResult(null);
  }, [applySelection]);

  const evaluateFormula = useCallback(() => {
    const evalResult = evaluateMathFormula(formula, formulaContext);
    if (!evalResult.ok) {
      setResult(`⚠ ${evalResult.error}`);
      return;
    }
    setResult(`→ ${evalResult.hz.toFixed(4)} Hz (${evalResult.bandLabel})`);
    setParam('beatHz', evalResult.hz);
    onFormulaApplied?.({
      formula,
      explanation: `Manual formula → ${evalResult.hz.toFixed(4)} Hz (${evalResult.bandLabel})`,
      hz: evalResult.hz,
      source: 'manual',
    });
  }, [formula, formulaContext, onFormulaApplied, setParam]);

  return (
    <View style={embedded ? styles.embedded : styles.standalone}>
      <TextInput
        ref={inputRef}
        style={styles.mathInput}
        value={formula}
        onChangeText={text => {
          setFormula(sanitizeFormulaInput(text));
          setResult(null);
        }}
        onSelectionChange={e => setSelection(e.nativeEvent.selection)}
        placeholder="|f_L - f_R| or φ ** 2"
        placeholderTextColor={HertzTheme.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
        showSoftInputOnFocus={false}
        caretHidden={false}
        onFocus={() => inputRef.current?.setNativeProps({selection})}
        onSubmitEditing={evaluateFormula}
      />
      <Text style={styles.helpText}>{MATH_FORMULA_HELP}</Text>
      {livePreview != null && formula.trim().length > 0 && (
        <Text style={styles.previewText}>Preview: {livePreview}</Text>
      )}
      <MathFormulaKeyboard
        onInsert={handleInsert}
        onBackspace={handleBackspace}
        onClear={handleClear}
        onApply={evaluateFormula}
        liveHint={liveHint}
      />
      {result != null && (
        <Text style={[styles.evalResult, result.startsWith('⚠') && styles.evalWarn]}>{result}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  embedded: {
    paddingTop: 4,
  },
  standalone: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
  },
  mathInput: {
    fontFamily: HertzTheme.mono,
    fontSize: 16,
    color: HertzTheme.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: HertzTheme.glassBorder,
    paddingVertical: 8,
    marginBottom: 6,
  },
  helpText: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
    lineHeight: 14,
    marginBottom: 4,
  },
  previewText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.neon.lime,
    marginBottom: 2,
  },
  evalResult: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    color: HertzTheme.neon.cyan,
    marginTop: 10,
  },
  evalWarn: {
    color: HertzTheme.neon.amber,
  },
});
