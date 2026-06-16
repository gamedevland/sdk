export interface PersistentStorageBackend {
  bootstrap(namespacePrefix: string): Promise<ReadonlyMap<string, string>>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
