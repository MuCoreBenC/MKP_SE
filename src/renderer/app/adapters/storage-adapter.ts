export interface KeyValueStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export class StorageAdapter {
  public constructor(private readonly storage: KeyValueStorageLike) {}

  public readJson<T>(key: string, fallback: T): T {
    const rawValue = this.storage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return fallback;
    }
  }

  public writeJson<T>(key: string, value: T): void {
    this.storage.setItem(key, JSON.stringify(value));
  }
}
