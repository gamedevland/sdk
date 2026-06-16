import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { AssetDescriptor } from '../types';

/**
 * Base class for asset loaders providing URL resolution helpers.
 *
 * @remarks
 * Centralizes `importedUrl`/`url`/`baseURL` logic to keep loaders consistent and SRP-friendly.
 */
export abstract class BaseLoader {
  /**
   * Resolves the effective URL for an asset descriptor.
   *
   * @param desc Asset descriptor to resolve.
   * @param baseURL Optional base URL used for relative `desc.url`.
   * @param kind Human-readable kind label for error messages (e.g., "Image").
   * @returns A fully resolved URL string.
   */
  protected resolveUrl(desc: AssetDescriptor, baseURL: string | undefined, kind: string): string {
    if (desc.importedUrl) return desc.importedUrl;
    if (!desc.url) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.AssetMissingRequired,
        subsystem: EngineSubsystem.Asset,
        message: 'Asset descriptor must provide url or importedUrl',
        details: { kind, id: desc.id, method: 'BaseLoader.resolveUrl' },
      });
    }
    if (!baseURL) return desc.url;
    if (desc.url.startsWith('http') || desc.url.startsWith('/')) return desc.url;
    const sep = baseURL.endsWith('/') ? '' : '/';
    return `${baseURL}${sep}${desc.url}`;
  }
}
