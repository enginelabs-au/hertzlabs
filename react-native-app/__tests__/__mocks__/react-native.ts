/**
 * Minimal hermetic stand-in for the `react-native` runtime surface used by the
 * pure-logic modules under test. Only the values touched at import time are
 * provided; native specs return inert proxies so importing them never throws.
 */
export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () =>
    new Proxy(
      {},
      {
        get: () => () => undefined,
      },
    ),
};

export const NativeModules: Record<string, unknown> = {};

export class NativeEventEmitter {
  addListener() {
    return {remove: () => undefined};
  }

  removeAllListeners() {
    return undefined;
  }
}

export const Platform = {OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios};
