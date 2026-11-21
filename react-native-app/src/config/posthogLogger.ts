import {posthog} from './posthog';

type PostHogLogAttributes = Record<string, boolean | number | string | undefined>;

/**
 * Dedicated PostHog log sender. Keep calls here limited to the intentional,
 * structured application records added for PostHog Logs.
 */
function send(
  level: 'error' | 'info' | 'warn',
  body: string,
  attributes: PostHogLogAttributes,
): void {
  try {
    posthog?.logger[level](body, attributes);
  } catch {
    // Logging must never affect the app path that produced this record.
  }
}

export const posthogLog = {
  error: (body: string, attributes: PostHogLogAttributes): void =>
    send('error', body, attributes),
  info: (body: string, attributes: PostHogLogAttributes): void =>
    send('info', body, attributes),
  warn: (body: string, attributes: PostHogLogAttributes): void =>
    send('warn', body, attributes),
};
