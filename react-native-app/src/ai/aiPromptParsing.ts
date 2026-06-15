/** Shared parsing for AI Guide + AI Formula (fallback when Gemini unavailable). */

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

const FOLLOW_UP_CUES = [
  'instead',
  'adjust',
  'change',
  'tweak',
  'refine',
  'more',
  'less',
  'gentler',
  'stronger',
  'slower',
  'faster',
  'lower',
  'higher',
  'reduce',
  'increase',
  'try',
  'now',
  'actually',
  'different',
];

/** Pull the last applied Hz from an assistant turn (Guide or Formula). */
export function extractHzFromAssistantText(text: string): number | null {
  const patterns = [
    /=\s*(\d+(?:\.\d+)?)\s*Hz/i,
    /(\d+(?:\.\d+)?)\s*Hz/i,
    /target(?:ing)?\s*(?:to|at)?\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m != null) {
      const hz = Number.parseFloat(m[1]);
      if (Number.isFinite(hz) && hz > 0) {
        return hz;
      }
    }
  }
  return null;
}

export function getLastAppliedHz(history: ChatTurn[], fallbackHz: number): number {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'assistant') {
      const hz = extractHzFromAssistantText(history[i].text);
      if (hz != null) {
        return hz;
      }
    }
  }
  return fallbackHz;
}

/** Explicit beat/carrier target in the user's latest message. */
export function extractTargetHzFromPrompt(prompt: string): number | null {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return null;
  }

  const patterns = [
    /\b(\d+(?:\.\d+)?)\s*(?:hz|hertz)\b/i,
    /\b(?:frequency|freq|beat|target|set(?:\s+it)?\s+to|use|apply|try|want|need)\s*(?:of|at|to)?\s*(\d+(?:\.\d+)?)\b/i,
    /\b(?:to|at)\s*(\d+(?:\.\d+)?)\s*(?:hz|hertz)?\b/i,
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m != null) {
      const hz = Number.parseFloat(m[1]);
      if (Number.isFinite(hz) && hz > 0) {
        return hz;
      }
    }
  }
  return null;
}

export function isFollowUpPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return FOLLOW_UP_CUES.some(cue => lower.includes(cue));
}

export function adjustHzFromRelativeCues(prompt: string, baseHz: number): number | null {
  const lower = ` ${prompt.toLowerCase()} `;
  let hz = baseHz;

  const deltaMatch = lower.match(/(?:by|\+|\-)\s*(\d+(?:\.\d+)?)\s*(?:hz|hertz)?/);
  if (deltaMatch != null) {
    const delta = Number.parseFloat(deltaMatch[1]);
    if (lower.includes('-') || lower.includes('decrease') || lower.includes('lower')) {
      hz -= delta;
    } else {
      hz += delta;
    }
    return hz;
  }

  if (/\b(half|50%)\b/.test(lower)) {
    return baseHz * 0.5;
  }
  if (/\b(double|twice|2x)\b/.test(lower)) {
    return baseHz * 2;
  }
  if (/\b(slower|deeper|calmer|sleepier|lower hz)\b/.test(lower)) {
    return baseHz - 2;
  }
  if (/\b(faster|higher hz|alert|energetic|wake)\b/.test(lower)) {
    return baseHz + 2;
  }
  if (/\b(gentler|softer|quieter|less intense|subtle)\b/.test(lower)) {
    return baseHz * 0.85;
  }
  if (/\b(stronger|intense|louder|more power)\b/.test(lower)) {
    return baseHz * 1.15;
  }

  return null;
}

export function buildConversationContents(
  history: ChatTurn[],
  latestPrompt: string,
): {role: 'user' | 'model'; text: string}[] {
  const contents: {role: 'user' | 'model'; text: string}[] = [];
  for (const turn of history) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      text: turn.text,
    });
  }
  contents.push({role: 'user', text: latestPrompt});
  return contents;
}
