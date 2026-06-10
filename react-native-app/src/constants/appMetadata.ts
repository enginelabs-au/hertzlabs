/** Display metadata — keep in sync with ios project MARKETING_VERSION / CURRENT_PROJECT_VERSION. */
export const APP_DEVELOPER_NAME = 'Cam Douglas';
export const APP_MARKETING_VERSION = '1.0';
export const APP_BUILD_NUMBER = '3';
export const APP_TEAM_ID = '256U2M55W7';
export const APP_BUNDLE_ID = 'com.hertzlabs.binauralbeats';

export function formatAppDevFooter(): string {
  return `${APP_DEVELOPER_NAME} · v${APP_MARKETING_VERSION} (build ${APP_BUILD_NUMBER}) · ${APP_TEAM_ID}`;
}
