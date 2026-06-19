/** Keep in sync with `app.version.json` (npm run sync:app-version). */
import versionMeta from '../../app.version.json';

export const APP_VERSION = versionMeta.versionName;
export const APP_VERSION_CODE = versionMeta.versionCode;
/** @deprecated Use APP_VERSION_CODE — kept for legacy references */
export const APP_BUILD = versionMeta.versionCode;

export const APP_STORE_ID = '6777604364';
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const APP_STORE_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

export const PLAY_PACKAGE = 'com.hertzlabs.binauralbeats';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;

export const SUPPORT_EMAIL = 'support@enginelabs.com.au';
export const PRESS_EMAIL = 'press@enginelabs.com.au';
export const HELLO_EMAIL = 'hello@enginelabs.com.au';
