import {GEMINI_API_KEY} from '@env';
import type {ChatTurn} from './aiPromptParsing';
import {buildConversationContents} from './aiPromptParsing';

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
): Promise<unknown | null> {
  const apiKey = getApiKey();
  if (apiKey == null) {
    return null;
  }

  const contents: GeminiContent[] = buildConversationContents(history, latestPrompt).map(turn => ({
    role: turn.role,
    parts: [{text: turn.text}],
  }));

  const body = {
    systemInstruction: {
      parts: [
        {
          text: `${systemPrompt}\n\nCurrent live session: ${sessionLine}\n\nIMPORTANT: Answer the user's LATEST message. Do not repeat a prior recommendation unless they ask to keep it. Honor explicit Hz requests exactly.`,
        },
      ],
    },
    contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 768,
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
Given the conversation, recommend entrainment settings for the user's LATEST request.
Respond with ONLY valid JSON (no markdown) matching:
{
  "brainwaveState": "Delta"|"Theta"|"Alpha"|"Beta"|"Gamma",
  "targetFrequencyHz": number between 0.5 and 50,
  "targetedBrainRegions": string[],
  "entrainmentStyle": "Binaural"|"Isochronic"|"Monaural",
  "intensityScale": number 0.0-1.0,
  "explanationShort": string
}
If the user names a specific Hz, use that exact targetFrequencyHz.`;

export const AI_FORMULA_SYSTEM_PROMPT = `You are the AI Formula assistant for a binaural beats math lab.
Given the conversation and live f_L, f_R, f_beat, f_c context, derive a formula for the user's LATEST request.
Respond with ONLY valid JSON (no markdown) matching:
{
  "reply": string,
  "formula": string using f_L, f_R, f_beat, f_c, φ, π, sqrt(), **, |x|
}
If the user asks for a specific Hz, use a literal numeric formula like "14" or "7.83".
Never return the same formula as the previous turn unless the user asks to keep it.`;

export const AI_PROTOCOL_SYSTEM_PROMPT = `You are the Protocol Sequencer for a binaural beats wellness app.
When the user asks for a timed sequence, progression, journey, or multi-step protocol, design a SessionProtocol.
Each step glides continuously from startBeatHz→endBeatHz and startGain→endGain across its full durationSec.

CRITICAL — user-specified numbers override all defaults:
- Read the ENTIRE conversation (all prior user turns + latest). Latest duration or Hz refinements override earlier ones.
- If the user gives a TOTAL duration anywhere (e.g. "45 minute sequence", "over 30 min", "2 hours", "90 seconds", "a few minutes"), step durationSec values MUST sum to that total (in seconds).
- Support any length: seconds (e.g. 90 sec), minutes (3 min), hours (2 hr), including short sessions and multi-hour journeys.
- If the user gives per-step minutes (e.g. "10 min then 20 min"), use those exact step lengths even if specified across separate messages.
- If the user gives minutes (e.g. "10 min", "15 minutes"), convert to durationSec = minutes × 60.
- If the user gives Hz (e.g. "12 Hz", "at 8") anywhere in the chat, use those exact startBeatHz/endBeatHz values.
- If the user specifies fade-out (e.g. "fade out over 2 min from 40% to 0", "gentle 30 sec fade to silence"), set fadeOutDurationSec and fadeOutStartGain/fadeOutEndGain accordingly anywhere in the conversation.
- Chain steps: endBeatHz of step N should equal startBeatHz of step N+1 when the user describes a transition.
- Never substitute preset sleep/focus/calm templates when explicit timings or Hz appear anywhere in the conversation.

Respond with ONLY valid JSON (no markdown) matching:
{
  "title": string,
  "description": string,
  "stopAfterPlayback": boolean,
  "fadeOutDurationSec": number (seconds, end fade after last step; 0 = none),
  "fadeOutStartGain": number 0-1 (volume at fade start),
  "fadeOutEndGain": number 0-1 (volume at fade end, often 0 for silence),
  "steps": [
    {
      "id": string,
      "label": string,
      "durationSec": number (ALWAYS seconds, never minutes),
      "startBeatHz": number,
      "endBeatHz": number,
      "curve": "linear"|"logarithmic",
      "engineMode": "binaural"|"isochronic"|"monaural"|"hemisphericSync"|"phaseModulated"|"pitchPanning",
      "startGain": number 0-1,
      "endGain": number 0-1
    }
  ]
}
Example: "10 min at 12 Hz then 20 min ramp 12 to 6 Hz" → step1 durationSec 600 start/end 12; step2 durationSec 1200 start 12 end 6.
For sleep/calm sequences without explicit numbers, use gradual logarithmic glides and lower volume over time.`;

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
  return callGeminiJson(AI_FORMULA_SYSTEM_PROMPT, history, latestPrompt, sessionLine);
}

export async function geminiProtocolSequence(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext,
): Promise<unknown | null> {
  const sessionLine = `beat ${session.beatHz.toFixed(2)} Hz, gain ${(session.gain * 100).toFixed(0)}%, engine ${session.engineType}`;
  return callGeminiJson(AI_PROTOCOL_SYSTEM_PROMPT, history, latestPrompt, sessionLine);
}
