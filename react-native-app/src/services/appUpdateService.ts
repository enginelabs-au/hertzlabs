import {Platform} from 'react-native';
import {APP_VERSION_CHECK_URL, PROMO_VALIDATE_URL} from '@env';
import {APP_VERSION_CODE} from '../constants/appInfo';

export type AppUpdateCheckResult = {
  updateRequired: boolean;
  forceUpdate: boolean;
};

const CHECK_ENDPOINT =
  APP_VERSION_CHECK_URL?.trim() ||
  (PROMO_VALIDATE_URL?.trim()
    ? PROMO_VALIDATE_URL.trim().replace('/validate-promo', '/check-app-version')
    : null);

/**
 * Returns whether the installed build must be updated before using the app.
 * Only `forceUpdate: true` from the server triggers a blocking update screen.
 */
export async function checkAppUpdateRequired(): Promise<AppUpdateCheckResult> {
  if (CHECK_ENDPOINT == null) {
    return {updateRequired: false, forceUpdate: false};
  }

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const url = `${CHECK_ENDPOINT}?platform=${platform}&versionCode=${APP_VERSION_CODE}`;

  try {
    const res = await fetch(url, {method: 'GET'});
    const data = (await res.json()) as {
      updateRequired?: boolean;
      forceUpdate?: boolean;
    };
    if (!res.ok) {
      return {updateRequired: false, forceUpdate: false};
    }
    return {
      updateRequired: data.updateRequired === true,
      forceUpdate: data.forceUpdate === true,
    };
  } catch {
    return {updateRequired: false, forceUpdate: false};
  }
}
