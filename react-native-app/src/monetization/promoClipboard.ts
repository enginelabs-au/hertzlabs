import {Share, TurboModuleRegistry} from 'react-native';

type ClipboardModule = {
  setString(content: string): void;
};

let cached: ClipboardModule | null | undefined;

/** Avoid @react-native-clipboard/clipboard getEnforcing at import time (can crash Release). */
function getClipboardModule(): ClipboardModule | null {
  if (cached !== undefined) {
    return cached;
  }
  cached = TurboModuleRegistry.get<ClipboardModule>('RNCClipboard');
  return cached;
}

/** Copy promo text; falls back to Share sheet if native clipboard module is unavailable. */
export async function copyPromoToClipboard(text: string): Promise<'clipboard' | 'share' | 'failed'> {
  const mod = getClipboardModule();
  if (mod != null) {
    mod.setString(text);
    return 'clipboard';
  }
  try {
    await Share.share({message: text});
    return 'share';
  } catch {
    return 'failed';
  }
}
