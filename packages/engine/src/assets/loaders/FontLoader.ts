import { BaseLoader } from './BaseLoader';

import type { AssetDescriptor, Loader } from '../types';

/**
 * Loads font assets using the FontFace API and registers them into document.fonts.
 */
export class FontLoader extends BaseLoader implements Loader {
  async load(
    desc: AssetDescriptor,
    _signal: AbortSignal,
    baseURL?: string,
  ): Promise<{ family: string; weight?: number }> {
    const url = this.resolveUrl(desc, baseURL, 'Font');
    const { family, weight } = this.parseFamilyAndWeight(desc.id);
    const descriptors: FontFaceDescriptors = {
      style: 'normal',
      weight: String(weight ?? 400),
      display: 'swap',
    };
    const face = new FontFace(family, `url(${url})`, descriptors);
    const loaded = await face.load();
    document.fonts.add(loaded);
    const loadedWeight = Number.parseInt(loaded.weight, 10);
    return Number.isFinite(loadedWeight) ? { family, weight: loadedWeight } : { family };
  }

  private parseFamilyAndWeight(id: string): { family: string; weight?: number } {
    // Heuristic: Family-WeightSuffix → (Rubik-Bold, Quantico-Regular)
    const fileName = id.split('/').pop() ?? id;
    const stem = fileName.split('.')[0] ?? fileName;
    const parts = stem.split('-');
    if (parts.length >= 2) {
      const suffixRaw = parts[parts.length - 1];
      if (!suffixRaw) return { family: id };
      const suffix = suffixRaw.toLowerCase();
      const family = parts.slice(0, parts.length - 1).join('-');
      const map: Record<string, number> = {
        thin: 100,
        extralight: 200,
        ultralight: 200,
        light: 300,
        normal: 400,
        regular: 400,
        medium: 500,
        semibold: 600,
        demibold: 600,
        bold: 700,
        extrabold: 800,
        ultrabold: 800,
        black: 900,
        heavy: 900,
      };
      const mapped = map[suffix];
      return mapped !== undefined ? { family, weight: mapped } : { family };
    }
    return { family: id };
  }

}
