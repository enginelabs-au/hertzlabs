export type ActiveFormulaDisplay = {
  primary: string;
  secondary: string;
  displayHz: number;
  source: 'ai' | 'manual';
};

export type FormulaAppliedPayload = {
  formula: string;
  explanation: string;
  hz: number;
  source: 'ai' | 'manual';
};
