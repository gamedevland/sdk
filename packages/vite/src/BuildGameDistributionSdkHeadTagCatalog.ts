import { GameDistributionBootstrapContract } from '@gamedevland/engine/platforms';

import type { HtmlTagDescriptor } from 'vite';

/**
 * Produces build-time HTML head tags required by the GameDistribution SDK.
 */
export class BuildGameDistributionSdkHeadTagCatalog {
  static resolve(gameId: string | undefined): HtmlTagDescriptor[] {
    if (!gameId) {
      throw new Error(
        '[vite] Missing GameDistribution game id while preparing SDK head tags.',
      );
    }

    return [
      BuildGameDistributionSdkHeadTagCatalog.createInlineScriptTag(
        GameDistributionBootstrapContract.createBootstrapScript(gameId),
      ),
      BuildGameDistributionSdkHeadTagCatalog.createScriptTag(
        GameDistributionBootstrapContract.SDK_SCRIPT_SRC,
        { id: GameDistributionBootstrapContract.SDK_SCRIPT_ID },
      ),
    ];
  }

  private static createScriptTag(
    src: string,
    attrs?: Readonly<Record<string, string>>,
  ): HtmlTagDescriptor {
    return {
      tag: 'script',
      attrs: { src, ...(attrs ?? {}) },
      injectTo: 'head-prepend',
    };
  }

  private static createInlineScriptTag(children: string): HtmlTagDescriptor {
    return {
      tag: 'script',
      children,
      injectTo: 'head-prepend',
    };
  }
}
