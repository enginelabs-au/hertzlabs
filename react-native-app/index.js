/**
 * RN entry — side-effect imports MUST stay first (gesture handler + reanimated + skia JSI).
 */
import 'react-native-gesture-handler';
import {configureReanimatedLogger, ReanimatedLogLevel} from 'react-native-reanimated';
import '@shopify/react-native-skia';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import 'react-native-reanimated';

import {registerNotifeeBackgroundHandler} from './src/notifications/registerNotifeeBackgroundHandler';

registerNotifeeBackgroundHandler();

import {AppRegistry, LogBox} from 'react-native';
import {name as appName} from './app.json';
import {App} from './src/app/App';

if (__DEV__) {
  LogBox.ignoreLogs(['[RevenueCat]']);
}

AppRegistry.registerComponent(appName, () => App);
