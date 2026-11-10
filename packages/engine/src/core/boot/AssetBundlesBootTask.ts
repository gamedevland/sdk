import type { AssetManager } from '../../assets';
import type { GameConfig } from '../GameConfig';

export class AssetBundlesBootTask {
  constructor(
    private readonly assets: AssetManager,
    private readonly config: GameConfig,
  ) {}

  async run(signal?: AbortSignal): Promise<void> {
    const preload = this.config.assets.preload ?? ['common', 'layouts'];
    for (const name of preload) {
      await this.assets.loadRequiredBundle(name, signal ? { signal } : undefined);
    }
  }
}
