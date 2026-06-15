import {BRAINWAVE_BANDS} from '../ReadoutPanel/brainwaveBands';

export const PHI = (1 + Math.sqrt(5)) / 2;

export type MathFormulaContext = {
  f_L: number;
  f_R: number;
  f_beat: number;
  f_c: number;
};

export type MathFormulaEvalResult =
  | {ok: true; hz: number; bandLabel: string}
  | {ok: false; error: string};

export const MATH_FORMULA_SYMBOLS = [
  {token: 'f_L', label: 'f_L', hint: 'Left ear tone (Hz)'},
  {token: 'f_R', label: 'f_R', hint: 'Right ear tone (Hz)'},
  {token: 'f_beat', label: 'f_beat', hint: 'Current beat differential (Hz)'},
  {token: 'f_c', label: 'f_c', hint: 'Carrier / center pitch (Hz)'},
  {token: '|', label: '|', hint: 'Absolute value brackets'},
  {token: 'φ', label: 'φ', hint: 'Golden ratio ≈ 1.618'},
  {token: 'π', label: 'π', hint: 'Pi ≈ 3.14159'},
  {token: 'sqrt(', label: '√', hint: 'Square root'},
  {token: '(', label: '(', hint: 'Open group'},
  {token: ')', label: ')', hint: 'Close group'},
  {token: '+', label: '+', hint: 'Add'},
  {token: '-', label: '−', hint: 'Subtract'},
  {token: '*', label: '×', hint: 'Multiply'},
  {token: '/', label: '÷', hint: 'Divide'},
  {token: '**', label: 'x^y', hint: 'Power'},
  {token: '.', label: '.', hint: 'Decimal'},
] as const;

export const MATH_FORMULA_HELP =
  'f_target = |f_L − f_R| · φ ≈ 1.618 · π ≈ 3.14159 · sqrt(x) · ** power';

function bandLabelForHz(hz: number): string {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band.label;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1].label;
}

/** Strip optional assignment prefixes users may type or tap. */
function stripAssignmentPrefixes(expr: string): string {
  return expr
    .replace(/f_beat\s*=\s*/gi, '')
    .replace(/f_L\s*=\s*/gi, '')
    .replace(/f_R\s*=\s*/gi, '')
    .replace(/f_c\s*=\s*/gi, '')
    .trim();
}

function replaceAbsPipes(expr: string): string {
  return expr.replace(/\|([^|]+)\|/g, (_, inner: string) => `Math.abs(${inner})`);
}

function substituteVariables(expr: string, ctx: MathFormulaContext): string {
  return expr
    .replace(/\bf_L\b/g, String(ctx.f_L))
    .replace(/\bf_R\b/g, String(ctx.f_R))
    .replace(/\bf_beat\b/g, String(ctx.f_beat))
    .replace(/\bf_c\b/g, String(ctx.f_c));
}

function substituteConstants(expr: string): string {
  return expr
    .replace(/φ/g, String(PHI))
    .replace(/π/g, String(Math.PI))
    .replace(/sqrt\s*\(/gi, 'Math.sqrt(');
}

function assertSafeNumericExpression(expr: string): void {
  if (!/^[\d+\-*/().\sMath.absPIsqrtEe]+$/.test(expr)) {
    throw new Error('Unsupported symbol or character.');
  }
}

export function evaluateMathFormula(
  rawExpr: string,
  ctx: MathFormulaContext,
): MathFormulaEvalResult {
  const trimmed = rawExpr.trim();
  if (!trimmed) {
    return {ok: false, error: 'Enter a formula first.'};
  }

  try {
    let expr = stripAssignmentPrefixes(trimmed);
    expr = replaceAbsPipes(expr);
    expr = substituteVariables(expr, ctx);
    expr = substituteConstants(expr);
    assertSafeNumericExpression(expr);

    const val = new Function(`return (${expr})`)() as number;
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return {ok: false, error: 'Result must be a finite number.'};
    }

    const hz = Math.abs(val);
    if (hz <= 0) {
      return {ok: false, error: 'Result must be a positive number.'};
    }

    return {ok: true, hz, bandLabel: bandLabelForHz(hz)};
  } catch {
    return {
      ok: false,
      error: 'Invalid expression. Try: |f_L - f_R| or φ ** 2',
    };
  }
}

export function previewMathFormula(
  rawExpr: string,
  ctx: MathFormulaContext,
): string | null {
  const result = evaluateMathFormula(rawExpr, ctx);
  if (!result.ok) {
    return null;
  }
  return `${result.hz.toFixed(4)} Hz (${result.bandLabel})`;
}

export function sanitizeFormulaInput(text: string): string {
  return text.replace(/[^0-9+\-*/().|φπ\s_a-zA-Z*]/g, '');
}
