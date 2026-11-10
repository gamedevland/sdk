import type { AssetGlobInput, BundleBuildPolicy, BundleRule } from './AssetManifestTypes';

export class DefaultBundleBuildPolicy implements BundleBuildPolicy {
  createRules(input: AssetGlobInput): readonly BundleRule[] {
    return [
      { name: 'audio', type: 'audio', files: input.audio },
      { name: 'configs', type: 'json', files: input.configsJson },
      { name: 'locales', type: 'json', files: input.localesJson },
      { name: 'layouts', type: 'json', files: input.layoutsJson },
      { name: 'prefabs', type: 'json', files: input.prefabsJson },
      { name: 'images', type: 'image', files: input.images },
      { name: 'fonts', type: 'font', files: input.fonts },
      { name: 'models', type: 'model', files: input.models ?? {} },
    ];
  }
}
