import {GEMINI_API_KEY} from '@env';
import type {ChatTurn} from './aiPromptParsing';
import {buildConversationContents} from './aiPromptParsing';
import {buildUserConversationText} from './parseProtocolFromPrompt';

const MODEL = 'gemini-1.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type GeminiSessionContext = {
  beatHz: number;
  carrierHz: number;
  gain: number;
  engineType: string;
  experimental: boolean;
};

type GeminiContentPart = {text: string};
type GeminiContent = {role?: string; parts: GeminiContentPart[]};

type GeminiCallOptions = {
  maxOutputTokens?: number;
  temperature?: number;
  systemSuffix?: string;
};

function getApiKey(): string | null {
  const key = (GEMINI_API_KEY ?? '').trim();
  return key.length > 10 && !key.startsWith('REPLACE_') ? key : null;
}

function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced != null) {
    return fenced[1].trim();
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw.trim();
}

async function callGeminiJson(
  systemPrompt: string,
  history: ChatTurn[],
  latestPrompt: string,
  sessionLine: string,
  options: GeminiCallOptions = {},
): Promise<unknown | null> {
  const apiKey = getApiKey();
  if (apiKey == null) {
    return null;
  }

  const contents: GeminiContent[] = buildConversationContents(history, latestPrompt).map(turn => ({
    role: turn.role,
    parts: [{text: turn.text}],
  }));

  const suffix =
    options.systemSuffix ??
    'Focus on the user\'s latest message. Honor explicit Hz and timing values from the conversation.';

  const body = {
    systemInstruction: {
      parts: [
        {
          text: `${systemPrompt}\n\nCurrent live session: ${sessionLine}\n\n${suffix}`,
        },
      ],
    },
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as {
      candidates?: {content?: {parts?: {text?: string}[]}}[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text == null || text.trim().length === 0) {
      return null;
    }
    return JSON.parse(extractJsonText(text)) as unknown;
  } catch {
    return null;
  }
}

export const AI_GUIDE_SYSTEM_PROMPT = `You are the AI Guide for a binaural beats wellness app.
Read the full conversation and interpret the user's latest intent — they may describe states, Hz targets, bands, duration, or follow-up refinements.
Respond with ONLY valid JSON (no markdown) matching:
{
  "brainwaveState": "Delta"|"Theta"|"Alpha"|"Beta"|"Gamma",
  "targetFrequencyHz": number between 0.5 and 50,
  "targetedBrainRegions": string[],
  "entrainmentStyle": "Binaural"|"Isochronic"|"Monaural",
  "intensityScale": number 0.0-1.0,
  "explanationShort": string
}
When the user names a specific Hz, use that exact targetFrequencyHz.
Band reference (approximate): delta 2.5, theta 6, alpha 10, beta 18, gamma 40.`;

export const AI_FORMULA_SYSTEM_PROMPT = `You are the AI Formula assistant for a binaural beats math lab.
Read the full conversation and derive a formula for the user's latest intent using f_L, f_R, f_beat, f_c, φ, π, sqrt(), **, |x|.
The user may ask about states, bands, phenomena, relative adjustments, or explicit Hz — interpret freely.
If they describe a timed multi-step journey (minutes/hours, ramps, "then", sequences), still return a single representative formula for the primary target Hz they seem to want — the app handles sequences separately.
Respond with ONLY valid JSON (no markdown) matching:
{
  "reply": string,
  "formula": string using f_L, f_R, f_beat, f_c, φ, π, sqrt(), **, |x|
}
When the user asks for a specific Hz, use a literal numeric formula like "14" or "7.83".`;

export const AI_PROTOCOL_SYSTEM_PROMPT = `You are the Protocol Sequencer for a binaural beats wellness app.
Interpret the user's natural language — they may describe journeys, ramps, holds, band names, explicit Hz, per-step timings, total duration, fade-out, or refinements across multiple messages.
Design a SessionProtocol that matches their intent. Each step glides continuously from startBeatHz→endBeatHz across its full durationSec.

Rules:
- Read ALL user turns; the latest message wins when values conflict.
- durationSec is ALWAYS in seconds (minutes × 60, hours × 3600).
- When the user gives per-step timings ("10 min then 20 min"), use those exact step lengths.
- When the user gives a TOTAL duration only, step durations must sum to that total.
- When the user gives explicit Hz values, use them exactly for startBeatHz/endBeatHz.
- Chain steps: endBeatHz of step N should equal startBeatHz of step N+1 for smooth transitions.
- Band → Hz reference: epsilon 0.5, delta 2.5, theta 6, alpha 10, smr 14, beta 18, gamma 40, lambda 100.
- fadeOutDurationSec / fadeOutStartGain / fadeOutEndGain when the user mentions fade-out or silence at the end.
- Use logarithmic curve for gradual sleep/calm descents; linear for abrupt holds.
- Do NOT copy canned templates when the user gave specific numbers or step structure.

Respond with ONLY valid JSON (no markdown) matching:
{
  "title": string,
  "description": string,
  "stopAfterPlayback": boolean,
  "fadeOutDurationSec": number,
  "fadeOutStartGain": number,
  "fadeOutEndGain": number,
  "steps": [
    {
      "id": string,
      "label": string,
      "durationSec": number,
      "startBeatHz": number,
      "endBeatHz": number,
      "curve": "linear"|"logarithmic",
      "engineMode": "binaural"|"isochronic"|"monaural"|"hemisphericSync"|"phaseModulated"|"pitchPanning",
      "startGain": number,
      "endGain": number
    }
  ]
}`;

export async function geminiGuideRecommendation(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext,
): Promise<unknown | null> {
  const sessionLine = `beat ${session.beatHz.toFixed(2)} Hz, carrier ${session.carrierHz.toFixed(1)} Hz, gain ${(session.gain * 100).toFixed(0)}%, engine ${session.engineType}${session.experimental ? ', experimental ON' : ''}`;
  return callGeminiJson(AI_GUIDE_SYSTEM_PROMPT, history, latestPrompt, sessionLine);
}

export async function geminiFormulaResponse(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext & {f_L: number; f_R: number; f_beat: number; f_c: number},
): Promise<unknown | null> {
  const sessionLine = `f_L=${session.f_L.toFixed(2)}, f_R=${session.f_R.toFixed(2)}, f_beat=${session.f_beat.toFixed(2)}, f_c=${session.f_c.toFixed(1)}, engine ${session.engineType}`;
  return callGeminiJson(AI_FORMULA_SYSTEM_PROMPT, history, latestPrompt, sessionLine, {
    temperature: 0.45,
  });
}

export async function geminiProtocolSequence(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext,
): Promise<unknown | null> {
  const sessionLine = `beat ${session.beatHz.toFixed(2)} Hz, gain ${(session.gain * 100).toFixed(0)}%, engine ${session.engineType}`;
  const userBrief = buildUserConversationText(history, latestPrompt);
  const enrichedPrompt = `${AI_PROTOCOL_SYSTEM_PROMPT}

USER REQUEST (all user turns, chronological):
${userBrief}`;

  return callGeminiJson(enrichedPrompt, history, latestPrompt, sessionLine, {
    temperature: 0.45,
    maxOutputTokens: 2048,
    systemSuffix:
      'Output JSON matching the schema only. Implement the sequence the user asked for — do not substitute unrelated presets.',
  });
}
