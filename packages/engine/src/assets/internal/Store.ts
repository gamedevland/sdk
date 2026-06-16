import type { AssetDescriptor, AssetId } from '../types';

export interface AssetMeta {
  id: AssetId;
  data?: unknown;
  lastUsedAt: number;
  dispose?: (resource: unknown) => void;
}

/**
 * In-memory store for loaded assets and their metadata.
 * Responsible for access timestamps and eviction policy.
 */
export class AssetStore {
  private store: Map<AssetId, AssetMeta> = new Map();

  /**
   * Retrieve and touch (update last-used) a resource by id.
   */
  get<T = unknown>(id: AssetId): T | undefined {
    const meta = this.store.get(id);
    if (!meta || meta.data === undefined) return undefined;
    meta.lastUsedAt = Date.now();
    return meta.data as T;
  }

  /**
   * Checks whether the resource is present and fully loaded.
   */
  has(id: AssetId): boolean {
    return this.store.has(id) && this.store.get(id)?.data !== undefined;
  }

  /**
   * Ensures metadata exists for a descriptor, creating a blank entry if needed.
   */
  ensureMeta(desc: AssetDescriptor): AssetMeta {
    let meta = this.store.get(desc.id);
    if (!meta) {
      meta = {
        id: desc.id,
        lastUsedAt: 0,
      };
      this.store.set(desc.id, meta);
    }
    return meta;
  }
}
