import { PlatformCatalog } from '@gamedevland/engine/platforms';

import type { ProxyOptions } from 'vite';

/**
 * Build-time mapping for platform-specific dev proxy configuration.
 */
export class BuildPlatformDevProxyCatalog {
  private static readonly DEV_PROXY_BY_PLATFORM: Readonly<
    Record<string, Readonly<Record<string, string | ProxyOptions>>>
  > = {
    [PlatformCatalog.YANDEX]: {
      '/sdk.js': {
        target: 'https://sdk.games.s3.yandex.net',
        changeOrigin: true,
      },
    },
  };

  static resolve(platformId: string): Readonly<Record<string, string | ProxyOptions>> | undefined {
    return BuildPlatformDevProxyCatalog.DEV_PROXY_BY_PLATFORM[platformId];
  }
}
