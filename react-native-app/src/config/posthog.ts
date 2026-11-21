import PostHog from 'posthog-react-native';
import {POSTHOG_HOST, POSTHOG_PROJECT_TOKEN} from '../analytics/posthog';

/**
 * Shared PostHog client for non-hook call sites (AI, paywall helpers, logs).
 * App.tsx mounts the same instance via PostHogProvider so React hooks share it.
 */
export const posthog = new PostHog(POSTHOG_PROJECT_TOKEN, {
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
});
