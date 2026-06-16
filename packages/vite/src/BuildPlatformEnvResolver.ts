import { loadEnv } from 'vite';

import { PlatformCatalog } from '@gamedevland/engine/platforms';

/**
 * Resolves and validates build platform from environment.
 */
export class BuildPlatformEnvResolver {
  static resolve(mode: string, cwd: string): string {
    const env = loadEnv(mode, cwd, '');
    const rawPlatformId = process.env.VITE_PLATFORM ?? env.VITE_PLATFORM;
    if (rawPlatformId == null || rawPlatformId.length === 0) {
      return PlatformCatalog.getDefault();
    }
    if (!PlatformCatalog.isSupported(rawPlatformId)) {
      throw new Error(
        `[vite] Unsupported VITE_PLATFORM value "${rawPlatformId}". Supported values: ${PlatformCatalog.getSupportedList().join(', ')}.`,
      );
    }
    return rawPlatformId;
  }
}
