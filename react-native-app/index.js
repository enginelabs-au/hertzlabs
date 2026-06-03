/**
 * RN entry — side-effect imports MUST stay first (gesture handler + reanimated).
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {App} from './src/app/App';

AppRegistry.registerComponent(appName, () => App);
