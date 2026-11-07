import { PlatformCatalog } from '@gamedevland/engine/platforms';

import { BuildGameDistributionSdkHeadTagCatalog } from './BuildGameDistributionSdkHeadTagCatalog';

import type { HtmlTagDescriptor } from 'vite';

interface BuildPlatformSdkCatalogOptions {
  readonly gameDistributionGameId?: string;
}

/**
 * Build-time mapping for platform SDK head tag injection.
 */
export class BuildPlatformSdkCatalog {
  private static readonly HEAD_TAG_RESOLVER_BY_PLATFORM: Readonly<
    Record<string, (options?: BuildPlatformSdkCatalogOptions) => HtmlTagDescriptor[]>
  > = {
    [PlatformCatalog.POKI]: () => [
      BuildPlatformSdkCatalog.createScriptTag(
        'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
      ),
    ],
    [PlatformCatalog.CRAZYGAMES]: () => [
      BuildPlatformSdkCatalog.createScriptTag(
        'https://sdk.crazygames.com/crazygames-sdk-v3.js',
      ),
    ],
    [PlatformCatalog.YANDEX]: () => [BuildPlatformSdkCatalog.createScriptTag('/sdk.js')],
    [PlatformCatalog.PLAYGAMA]: () => [
      BuildPlatformSdkCatalog.createScriptTag(
        'https://bridge.playgama.com/v2/stable/playgama-bridge.js',
      ),
    ],
    [PlatformCatalog.GAMEDISTRIBUTION]: (options?: BuildPlatformSdkCatalogOptions) =>
      BuildGameDistributionSdkHeadTagCatalog.resolve(options?.gameDistributionGameId),
  };

  static resolveHeadTags(
    platformId: string,
    options?: BuildPlatformSdkCatalogOptions,
  ): HtmlTagDescriptor[] {
    const resolver = BuildPlatformSdkCatalog.HEAD_TAG_RESOLVER_BY_PLATFORM[platformId];
    return resolver ? resolver(options) : [];
  }

  private static createScriptTag(src: string, attrs?: Readonly<Record<string, string>>): HtmlTagDescriptor {
    return {
      tag: 'script',
      attrs: { src, ...(attrs ?? {}) },
      injectTo: 'head-prepend',
    };
  }
}
