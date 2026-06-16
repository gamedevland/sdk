import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { BaseLoader } from './BaseLoader';

import type { AssetDescriptor, Loader } from '../types';

/**
 * Loads image assets via fetch + decode.
 *
 * On modern browsers, uses `createImageBitmap` for efficient decoding and
 * GPU upload. Falls back to creating an `HTMLImageElement` when not available.
 */
export class ImageLoader extends BaseLoader implements Loader {
  /**
   * Fetches the image bytes and decodes into an ImageBitmap or HTMLImageElement.
   * Honors AbortSignal for cancellation.
   */
  async load(
    desc: AssetDescriptor,
    signal: AbortSignal,
    baseURL?: string,
  ): Promise<ImageBitmap | HTMLImageElement> {
    const url = this.resolveUrl(desc, baseURL, 'Image');
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.AssetLoadFailure,
        subsystem: EngineSubsystem.Asset,
        message: 'Failed to load image',
        details: { id: desc.id, status: res.status, url },
      });
    }
    const blob = await res.blob();
    if ('createImageBitmap' in globalThis) {
      try {
        return await createImageBitmap(blob);
      } catch {
        // Fallback for browser/blob combinations where createImageBitmap rejects.
      }
    }
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          EngineErrorFactory.create({
            code: EngineErrorCode.AssetLoadFailure,
            subsystem: EngineSubsystem.Asset,
            message: 'Image decode error',
            details: { id: desc.id },
          }),
        );
      };
      img.src = objectUrl;
    });
  }

  /**
   * Disposes image resources when supported (e.g., ImageBitmap.close()).
   */
  dispose(resource: unknown): void {
    if (
      typeof resource === 'object' &&
      resource !== null &&
      'close' in resource &&
      typeof (resource as { close?: unknown }).close === 'function'
    ) {
      try {
        (resource as { close: () => void }).close();
      } catch {
        void 0;
      }
    }
  }
}
