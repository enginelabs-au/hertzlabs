/** Qualifying streak + restore / lapsed logic (Features 15 + 19). */

export const STREAK_QUALIFYING_PLAYBACK_SEC = 120;
export const STREAK_LAPSED_7_DAYS = 7;
export const STREAK_LAPSED_30_DAYS = 30;
export const STREAK_RESTORE_OFFER_TTL_MS = 86_400_000;
export const LAPSED_7_RESTORE_COOLDOWN_MS = 90 * 86_400_000;
export const LAPSED_30_WINBACK_COOLDOWN_MS = 365 * 86_400_000;

export function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayIso(from = new Date()): string {
  return localDateIso(new Date(from.getTime() - 86_400_000));
}

export function daysBetweenIso(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return 0;
  }
  return Math.floor((b - a) / 86_400_000);
}

export function isQualifyingPlaybackToday(todayPlaybackSec: number): boolean {
  return todayPlaybackSec >= STREAK_QUALIFYING_PLAYBACK_SEC;
}

export type StreakBreakKind = 'missed_day' | 'lapsed_7' | 'lapsed_30';

export function detectStreakBreak(input: {
  streakDays: number;
  lastQualifyingDate: string | null;
  todayIso: string;
}): StreakBreakKind | null {
  if (input.streakDays <= 0 || input.lastQualifyingDate == null) {
    return null;
  }
  const gap = daysBetweenIso(input.lastQualifyingDate, input.todayIso);
  if (gap <= 1) {
    return null;
  }
  if (gap >= STREAK_LAPSED_30_DAYS) {
    return 'lapsed_30';
  }
  if (gap >= STREAK_LAPSED_7_DAYS) {
    return 'lapsed_7';
  }
  return 'missed_day';
}
