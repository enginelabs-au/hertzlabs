/**
 * Codegen TurboModule spec for HertzAI native module.
 * iOS: thin Objective-C TurboModule forwarding to the Swift GeminiClient.
 * Android: deferred.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  /**
   * Kick off a Gemini recommendation pass.
   * contextJson: JSON-serialised context object (current params, session meta).
   * Responds asynchronously via onAIStatus events.
   */
  generateRecommendation(contextJson: string): void;

  // Events — native → JS
  readonly onAIStatus: EventEmitter<{
    status: string;
    payload: string;
    error: string;
  }>;
}

function isVitestRuntime(): boolean {
  const proc = (globalThis as {process?: {env?: {VITEST?: string}}}).process;
  return proc?.env?.VITEST != null;
}

const _module = isVitestRuntime() ? null : TurboModuleRegistry.get<Spec>('HertzAI');

const noop = () => undefined;
const noopSub = {remove: noop};

const NativeHertzAI: Spec =
  _module ??
  ({
    generateRecommendation: noop,
    onAIStatus: (_l: unknown) => noopSub,
  } as unknown as Spec);

export default NativeHertzAI;
