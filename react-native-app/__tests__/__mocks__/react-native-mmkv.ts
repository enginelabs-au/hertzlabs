/**
 * Hermetic in-memory stand-in for react-native-mmkv so the Zustand persist
 * middleware can be exercised in a pure Node environment with no native module.
 */
export class MMKV {
  private store = new Map<string, string>();

  getString(key: string): string | undefined {
    return this.store.get(key);
  }

  set(key: string, value: string | number | boolean): void {
    this.store.set(key, String(value));
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clearAll(): void {
    this.store.clear();
  }
}
