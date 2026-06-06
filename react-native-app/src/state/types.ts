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

export type NoiseLayers = {
  white: boolean;
  pink: boolean;
  brown: boolean;
};

export type AudioParamsValues = {
  carrierHz: number;
  beatHz: number;
  gain: number;
  balance: number;
  waveform: Waveform;
  /** @deprecated Use noiseLayers + noiseMix; kept for presets / AI payloads */
  noiseType: NoiseType;
  noiseLevel: number;
  noiseLayers: NoiseLayers;
  /** Master noise amount (0–1 linear) when any layer is on */
  noiseMix: number;
  fadeMs: number;
  phaseAngle: number;
  /** Per-ear frequency offset (Hz), −12…+12. L/R readouts; native via back-solved carrier/beat. */
  leftDriftHz: number;
  rightDriftHz: number;
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
  toggleNoiseLayer(layer: keyof NoiseLayers): void;
  setNoiseMix(mix: number): void;
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
  /** Beat frequency slider: linear Hz steps vs log (exponential) spacing. */
  beatSliderScale: import('../audio/beatHzSlider').BeatSliderScale;
  /**
   * Experimental mode — adds dedicated pitch (carrier) dials across the audible
   * 20 Hz-20 kHz range while the main slider remains the beat-speed control.
   */
  experimentalMode: boolean;
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
