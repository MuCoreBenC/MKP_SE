export interface KeyValueStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export class StorageAdapter {
  public constructor(private readonly storage: KeyValueStorageLike) {}

  public readString(key: string, fallback: string | null = null): string | null {
    const rawValue = this.storage.getItem(key);
    return rawValue ?? fallback;
  }

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

  public remove(key: string): void {
    this.storage.removeItem?.(key);
  }
}
