import PostHog from 'posthog-react-native';
import {POSTHOG_HOST, POSTHOG_PROJECT_TOKEN} from '@env';

const missingVariable = !POSTHOG_PROJECT_TOKEN
  ? 'POSTHOG_PROJECT_TOKEN'
  : !POSTHOG_HOST
    ? 'POSTHOG_HOST'
    : null;

if (__DEV__ && missingVariable != null) {
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

/**
 * Shared PostHog client for the native app. The environment is embedded at build
 * time by react-native-dotenv, so release builds must be rebuilt after changing it.
 */
export const posthog =
  POSTHOG_PROJECT_TOKEN != null && POSTHOG_HOST != null
    ? new PostHog(POSTHOG_PROJECT_TOKEN, {
        host: POSTHOG_HOST,
        captureAppLifecycleEvents: true,
        logs: {
          serviceName: 'hertz-labs-binaural-beats',
          environment: __DEV__ ? 'development' : 'production',
        },
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
          },
        },
      })
    : null;
