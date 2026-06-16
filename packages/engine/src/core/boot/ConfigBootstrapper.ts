import type { EngineBootConfigPlan } from './EngineBootConfigPlan';
import type { AssetManager } from '@engine/assets';
import type { ConfigStore } from '@engine/configs';

export class ConfigBootstrapper {
  constructor(
    private readonly assets: AssetManager,
    private readonly configStore: ConfigStore,
  ) {}

  async bootstrapEngineStart(plan: EngineBootConfigPlan): Promise<void> {
    await this.bootstrapBundles(plan.getEngineStartBundleNames());
  }

  async bootstrapSceneEnter(plan: EngineBootConfigPlan, sceneKey: string): Promise<void> {
    await this.bootstrapBundles(plan.getSceneEnterBundleNames(sceneKey));
  }

  async bootstrapBundles(bundleNames: readonly string[]): Promise<void> {
    for (const bundleName of bundleNames) {
      await this.assets.loadBundle(bundleName);
      const ids = this.assets.getBundleAssetIds(bundleName, 'json');
      for (const id of ids) {
        if (this.configStore.has(id)) {
          continue;
        }
        const raw = await this.assets.getJson(id);
        this.configStore.set(id, raw);
      }
    }
  }
}
