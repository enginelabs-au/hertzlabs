import type {NoiseType, Waveform} from '../audio/paramMapping';
import type {CustomerInfo} from 'react-native-purchases';

export type EngineState = 'uninitialized' | 'ready' | 'playing' | 'paused' | 'interrupted' | 'error';

export type EngineMode =
  | 'binaural'
  | 'monaural'
  | 'isochronic'
  | 'hemisphericSync'
  | 'phaseModulated'
  | 'pitchPanning'
  | 'musicModulation';
export type OutputRoute = 'speaker' | 'headphones' | 'bluetooth' | 'airplay' | 'unknown';
export type AiStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
export type SubscriptionTier = 'free' | 'premium';

export type AudioParamsValues = {
  carrierHz: number;
  beatHz: number;
  gain: number;
  balance: number;
  waveform: Waveform;
  noiseType: NoiseType;
  noiseLevel: number;
  fadeMs: number;
  phaseAngle: number;
  timingDiffMs: number;
};

export type Preset = {
  id: string;
  name: string;
  params: AudioParamsValues;
};

export type SessionPlan = {
  title: string;
  durationSec: number;
  presets: Preset[];
};

export type AudioParamsSlice = AudioParamsValues & {
  setParam<K extends keyof AudioParamsValues>(key: K, value: AudioParamsValues[K]): void;
  applyPreset(preset: Preset): void;
};

export type SessionSlice = {
  sessionId: string | null;
  presetId: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  durationSec: number;
  elapsedSec: number;
  requestPlay(): void;
  requestPause(): void;
  requestStop(): void;
  setElapsedSec(elapsedSec: number): void;
};

export type EngineSlice = {
  state: EngineState;
  engineType: EngineMode;
  sampleRate: number;
  bufferDurationMs: number;
  outputRoute: OutputRoute;
  measuredLatencyMs: number;
  lastError: string | null;
  highVolumeWarningTriggered: boolean;
  isStereoRoute: boolean;
  lastSafetyEvent: string | null;
  setEngineType(mode: EngineMode): void;
  _ingestNativeState(payload: Partial<EngineSlice>): void;
  _ingestNativeError(error: string): void;
};

export type PresetSlice = {
  builtin: Preset[];
  custom: Preset[];
  addCustomPreset(preset: Preset): void;
  removeCustomPreset(id: string): void;
};

export type AISlice = {
  status: AiStatus;
  prompt: string;
  plan: SessionPlan | null;
  suggestions: string[];
  error: string | null;
  setPrompt(prompt: string): void;
  resetAI(): void;
};

export type UiSlice = {
  theme: 'dark' | 'light' | 'system';
  onboardingDone: boolean;
  hasAcceptedSafetyTerms: boolean;
  activeModal: string | null;
  setTheme(theme: UiSlice['theme']): void;
  setOnboardingDone(done: boolean): void;
  setHasAcceptedSafetyTerms(v: boolean): void;
  setActiveModal(modal: string | null): void;
};

export type SettingsSlice = {
  defaultDurationSec: number;
  haptics: boolean;
  keepAwake: boolean;
  backgroundAudio: boolean;
  isKineticModeEnabled: boolean;
  lastUsedParams: AudioParamsValues | null;
  updateSettings(settings: Partial<Omit<SettingsSlice, 'updateSettings'>>): void;
};

export type SubscriptionSlice = {
  tier: SubscriptionTier;
  entitlements: string[];
  setSubscription(tier: SubscriptionTier, entitlements: string[]): void;
  _hydrateFromRC(info: CustomerInfo, entitlementId?: string): void;
};

export type AppStore = AudioParamsSlice &
  SessionSlice &
  EngineSlice &
  PresetSlice &
  AISlice &
  UiSlice &
  SettingsSlice &
  SubscriptionSlice;
