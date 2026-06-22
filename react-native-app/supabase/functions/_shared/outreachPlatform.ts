export type OutreachPlatform = 'ios' | 'android' | 'macos';

const PLATFORM_LABEL: Record<OutreachPlatform, string> = {
  ios: 'iOS',
  android: 'Android (Google Play)',
  macos: 'macOS (App Store)',
};

/** Normalize client / legacy platform strings → ios | android | macos | null. */
export function normalizeOutreachPlatform(raw: string): OutreachPlatform | null {
  const p = raw.trim().toLowerCase();
  if (p === 'ios' || p === 'iphone' || p === 'ipad') {
    return 'ios';
  }
  if (p === 'android') {
    return 'android';
  }
  if (p === 'macos' || p === 'mac' || p === 'catalyst' || p === 'mac-catalyst') {
    return 'macos';
  }
  return null;
}

export function outreachPlatformLabel(raw: string): string {
  const normalized = normalizeOutreachPlatform(raw);
  if (normalized != null) {
    return PLATFORM_LABEL[normalized];
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : 'Unknown';
}

/** Apple App Store (iOS + macOS) vs Google Play. */
export function storeForOutreachPlatform(raw: string): 'apple' | 'google' | null {
  const p = normalizeOutreachPlatform(raw);
  if (p === 'android') {
    return 'google';
  }
  if (p === 'ios' || p === 'macos') {
    return 'apple';
  }
  return null;
}
