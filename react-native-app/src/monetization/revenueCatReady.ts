import {Platform} from 'react-native';
import Purchases, {LOG_LEVEL} from 'react-native-purchases';
import {
  REVENUECAT_API_KEY_ANDROID,
  REVENUECAT_API_KEY_IOS,
} from '@env';

let configurePromise: Promise<boolean> | null = null;

function resolveApiKey(): string {
  const ios = REVENUECAT_API_KEY_IOS?.trim() ?? '';
  const android = REVENUECAT_API_KEY_ANDROID?.trim() ?? '';
  return Platform.OS === 'android' ? android : ios;
}

/** Ensures Purchases.configure ran before getOfferings / getProducts. */
export function ensureRevenueCatConfigured(): Promise<boolean> {
  if (!configurePromise) {
    configurePromise = (async () => {
      const apiKey = resolveApiKey();
      if (!apiKey) {
        return false;
      }
      try {
        if (__DEV__ && typeof Purchases.setLogLevel === 'function') {
          await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }
        Purchases.configure({apiKey});
        return true;
      } catch {
        configurePromise = null;
        return false;
      }
    })();
  }
  return configurePromise;
}
