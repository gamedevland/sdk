/** Low-level key-value storage adapter contract. */
export interface IStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Typed state store abstraction over a string key-value adapter. */
export interface IStateStore<T> {
  load(): T;
  save(value: T): void;
  clear(): void;
}
