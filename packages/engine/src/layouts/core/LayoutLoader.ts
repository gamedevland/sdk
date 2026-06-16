import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

/**
 * Loads layout JSON from an injected asset provider.
 * Layout ids are path-relative from `game/assets` (for example `json/layouts/...`).
 */
export interface LayoutAssetReader {
  getJson(id: string): Promise<unknown>;
}

export class LayoutLoader {
  constructor(private readonly reader: LayoutAssetReader) {}

  /**
   * Load and parse a layout JSON by asset id.
   * @param {string} name — Layout asset id.
   * @returns {Promise<unknown>} Parsed JSON object representing the layout file.
   * @throws {Error} If the asset is not loaded.
   */
  async loadJson(name: string): Promise<unknown> {
    const data = await this.reader.getJson(name);
    if (!data) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Layout asset is not loaded',
        details: { name, method: 'LayoutLoader.loadJson' },
      });
    }
    return data;
  }
}
