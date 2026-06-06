import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import NativeHertzAudio from '../src/audio/specs/NativeHertzAudio';
import {NATIVE_ENGINE_MODE_CODE} from '../src/audio/engineModeMapping';
import {installAudioSync} from '../src/state/middleware/audioSync';
import {useHertzStore} from '../src/state/store';

let uninstall: (() => void) | null = null;

beforeEach(() => {
  vi.restoreAllMocks();
  useHertzStore.setState(useHertzStore.getInitialState(), true);
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
});

describe('audioSync native push ordering', () => {
  it('publishes acoustic mode code before beat changes reach native', () => {
    const setPhase = vi.spyOn(NativeHertzAudio, 'setPhaseAndTiming');
    const setParams = vi.spyOn(NativeHertzAudio, 'setBinauralParameters');

    uninstall = installAudioSync(useHertzStore);
    useHertzStore.getState().setEngineType('isochronic');
    setPhase.mockClear();
    setParams.mockClear();

    useHertzStore.getState().setParam('beatHz', 20);

    expect(setPhase).toHaveBeenCalledWith(0, NATIVE_ENGINE_MODE_CODE.isochronic);
    expect(setParams).toHaveBeenCalled();
    expect(setPhase.mock.invocationCallOrder[0]).toBeLessThan(
      setParams.mock.invocationCallOrder[0],
    );
  });
});
