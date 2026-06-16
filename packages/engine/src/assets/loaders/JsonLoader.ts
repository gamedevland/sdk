import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { BaseLoader } from './BaseLoader';

import type { AssetDescriptor, Loader } from '../types';

/**
 * Loads JSON assets via fetch and `Response.json()`.
 */
export class JsonLoader extends BaseLoader implements Loader {
  /**
   * Fetches and parses JSON. Honors AbortSignal for cancellation.
   */
  async load(desc: AssetDescriptor, signal: AbortSignal, baseURL?: string): Promise<unknown> {
    const url = this.resolveUrl(desc, baseURL, 'JSON');
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.AssetLoadFailure,
        subsystem: EngineSubsystem.Asset,
        message: 'Failed to load JSON asset',
        details: { id: desc.id, status: res.status, url },
      });
    }
    return await res.json();
  }
}
