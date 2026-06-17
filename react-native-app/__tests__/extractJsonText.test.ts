import {describe, expect, it} from 'vitest';
import {extractJsonText, parseModelJson} from '../src/ai/geminiChatClient';

describe('parseModelJson', () => {
  it('repairs missing step closing brace from Gemini', () => {
    const broken = `{
  "steps": [
    {
      "startBeatHz": 10,
      "endBeatHz": 150,
      "durationSec": 30,
      "label": "Ramp up",
      "curve": "logarithmic"
    ,
    {
      "startBeatHz": 150,
      "endBeatHz": 10,
      "durationSec": 30,
      "label": "Ramp down",
      "curve": "logarithmic"
    }
  ]
}`;
    const parsed = parseModelJson(broken) as {steps: unknown[]};
    expect(parsed.steps).toHaveLength(2);
  });
});

describe('extractJsonText', () => {
  it('parses bare JSON arrays (not only objects)', () => {
    const raw = '[{"startBeatHz":2,"endBeatHz":10,"durationSec":60}]';
    expect(JSON.parse(extractJsonText(raw))).toEqual([
      {startBeatHz: 2, endBeatHz: 10, durationSec: 60},
    ]);
  });

  it('extracts arrays wrapped in prose', () => {
    const raw = 'Here is the plan:\n[{"a":1},{"b":2}]\nDone.';
    expect(JSON.parse(extractJsonText(raw))).toEqual([{a: 1}, {b: 2}]);
  });

  it('still extracts objects', () => {
    const raw = 'prefix {"steps":[]} suffix';
    expect(JSON.parse(extractJsonText(raw))).toEqual({steps: []});
  });
});
