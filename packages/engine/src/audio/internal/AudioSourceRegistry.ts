import { AudioSourceDescriptorDecoder } from './AudioSourceDescriptorDecoder';

import type { AudioBackend, AudioId } from '../types';
import type { AssetManager } from '@engine/assets';

/**
 * Ensures audio sources are resolved from assets and registered in backend once.
 */
export class AudioSourceRegistry {
  private readonly ensuredSources = new Set<AudioId>();
  private readonly pendingRegistration = new Map<AudioId, Promise<void>>();

  constructor(
    private readonly assets: AssetManager,
    private readonly backend: AudioBackend,
    private readonly sourceName: string,
  ) {}

  ensureSourceRegistered(assetId: AudioId): void {
    if (this.ensuredSources.has(assetId) || this.backend.hasSource(assetId)) {
      this.ensuredSources.add(assetId);
      return;
    }

    const raw = this.assets.getRequired<unknown>(assetId, this.sourceName);
    const descriptor = AudioSourceDescriptorDecoder.decode(raw, assetId);
    this.backend.createSource(descriptor);
    this.ensuredSources.add(assetId);
  }

  isSourceRegistered(assetId: AudioId): boolean {
    return this.ensuredSources.has(assetId) || this.backend.hasSource(assetId);
  }

  ensureSourceRegisteredInBackground(assetId: AudioId): Promise<void> {
    if (this.isSourceRegistered(assetId)) {
      this.ensuredSources.add(assetId);
      return Promise.resolve();
    }

    const existing = this.pendingRegistration.get(assetId);
    if (existing) {
      return existing;
    }

    const pending = this.loadAndRegister(assetId).finally(() => {
      this.pendingRegistration.delete(assetId);
    });
    this.pendingRegistration.set(assetId, pending);
    return pending;
  }

  unloadSource(assetId: AudioId): void {
    this.backend.unloadSource(assetId);
    this.ensuredSources.delete(assetId);
  }

  clear(): void {
    this.ensuredSources.clear();
    this.pendingRegistration.clear();
  }

  private async loadAndRegister(assetId: AudioId): Promise<void> {
    if (!this.assets.has(assetId)) {
      await this.assets.load(assetId);
    }
    this.ensureSourceRegistered(assetId);
  }
}
