import {HertzAudioClient} from './HertzAudioClient';
import {noiseLayerGains} from './noiseLayers';
import type {NoiseLayers} from '../state/types';

/** Push white / pink / brown layer gains to native in one atomic update when available. */
export function pushNoiseToNative(layers: NoiseLayers, mix: number): void {
  const g = noiseLayerGains(layers, mix);
  HertzAudioClient.setNoiseLayers(g.white, g.pink, g.brown);
}
