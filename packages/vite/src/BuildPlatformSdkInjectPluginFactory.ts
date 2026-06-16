import { BuildPlatformSdkCatalog } from './BuildPlatformSdkCatalog';

import type { Plugin } from 'vite';

/**
 * Produces HTML transform plugin that injects platform SDK script tag.
 */
export class BuildPlatformSdkInjectPluginFactory {
  static create(
    platformId: string,
    options?: { readonly gameDistributionGameId?: string },
  ): Plugin {
    return {
      name: 'platform-sdk-inject',
      transformIndexHtml() {
        const headTags = BuildPlatformSdkCatalog.resolveHeadTags(platformId, options);
        if (headTags.length === 0) {
          return;
        }
        return headTags;
      },
    };
  }
}
