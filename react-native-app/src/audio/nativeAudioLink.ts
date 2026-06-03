import {TurboModuleRegistry} from 'react-native';

/** True when the HertzAudio TurboModule is registered in the native binary. */
export function isHertzAudioTurboModuleLinked(): boolean {
  if (typeof TurboModuleRegistry.get !== 'function') {
    return false;
  }
  return TurboModuleRegistry.get('HertzAudio') != null;
}
