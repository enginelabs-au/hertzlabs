import {Alert, Linking, Platform} from 'react-native';
import InAppReview from 'react-native-in-app-review';
import {APP_STORE_REVIEW_URL, PLAY_STORE_URL} from '../constants/appInfo';

/** Native in-app review when available; App Store / Play fallback otherwise. */
export async function requestAppReview(): Promise<void> {
  try {
    if (InAppReview.isAvailable()) {
      await InAppReview.RequestInAppReview();
      return;
    }
  } catch {
    /* fall through to store URL */
  }

  const url = Platform.OS === 'ios' ? APP_STORE_REVIEW_URL : PLAY_STORE_URL;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}

export function confirmThenRequestAppReview(): void {
  Alert.alert(
    'Enjoying Hertz Labs?',
    'A quick review helps others discover precision binaural beats built for real headphones.',
    [
      {text: 'Not now', style: 'cancel'},
      {
        text: 'Rate the app',
        onPress: () => {
          void requestAppReview();
        },
      },
    ],
  );
}
