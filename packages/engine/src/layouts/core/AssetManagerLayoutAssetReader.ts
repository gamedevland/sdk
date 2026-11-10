import type { LayoutRuntime } from '../../core/ports/LayoutRuntime';

export class AssetManagerLayoutAssetReader {
  constructor(private readonly engine: LayoutRuntime) {}

  async getJson(id: string): Promise<unknown> {
    return await this.engine.assets.getJson(id);
  }
}
