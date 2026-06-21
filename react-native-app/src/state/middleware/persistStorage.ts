import {TurboModuleRegistry} from 'react-native';
import {MMKV} from 'react-native-mmkv';
import type {StateStorage} from 'zustand/middleware';
import {isMacDesktopBuild} from '../../platform/layoutProfile';

const STORE_KEY = 'hertz-zustand';
const MMKV_ID = 'hertz-zustand';

const memMap = new Map<string, string>();
const memFallback: StateStorage = {
  getItem: name => memMap.get(name) ?? null,
  setItem: (name, value) => memMap.set(name, value),
  removeItem: name => memMap.delete(name),
};

type MmkvPlatformContext = {
  getBaseDirectory(): string;
};

/**
 * Mac Catalyst Desktop .apps copied to ~/Desktop often lose sandbox Documents
 * between launches when ad-hoc signed. Persist under ~/Library/Application Support
 * instead so onboarding + welcome gift state survives quit/reopen.
 */
function resolveMacApplicationSupportMmkvPath(): string | null {
  try {
    const ctx = TurboModuleRegistry.getEnforcing<MmkvPlatformContext>('MmkvPlatformContext');
    const docsMmkv = ctx.getBaseDirectory();
    const homeMatch = docsMmkv.match(/^(\/Users\/[^/]+)\//);
    if (homeMatch != null) {
      return `${homeMatch[1]}/Library/Application Support/HertzLabs/mmkv`;
    }
  } catch (e) {
    console.warn('[persist] Mac Application Support path unavailable:', e);
  }
  return null;
}

function createMmkvInstance(): MMKV {
  if (isMacDesktopBuild()) {
    const macPath = resolveMacApplicationSupportMmkvPath();
    if (macPath != null) {
      return new MMKV({id: MMKV_ID, path: macPath});
    }
  }
  return new MMKV({id: MMKV_ID});
}

let storageInstance: MMKV | null = null;

function mmkv(): MMKV {
  if (storageInstance == null) {
    storageInstance = createMmkvInstance();
  }
  return storageInstance;
}

function createMmkvStorage(): StateStorage {
  return {
    getItem: name => {
      try {
        const raw = mmkv().getString(name);
        if (raw == null) {
          return null;
        }
        JSON.parse(raw);
        return raw;
      } catch (e) {
        console.warn('[persist] corrupt MMKV entry, clearing:', name, e);
        try {
          mmkv().delete(name);
        } catch {
          /* ignore */
        }
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        mmkv().set(name, value);
      } catch (e) {
        console.warn('[persist] MMKV setItem failed:', name, e);
      }
    },
    removeItem: name => {
      try {
        mmkv().delete(name);
      } catch (e) {
        console.warn('[persist] MMKV removeItem failed:', name, e);
      }
    },
  };
}

let zustandStorage: StateStorage;
try {
  zustandStorage = createMmkvStorage();
} catch (e) {
  console.warn('[persist] MMKV init failed, using in-memory fallback:', e);
  zustandStorage = memFallback;
}

export {zustandStorage, STORE_KEY};
