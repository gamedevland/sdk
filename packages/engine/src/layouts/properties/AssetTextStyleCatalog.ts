import type { TextStyleCatalog, StyleObject } from './TextStyleCatalog';

export class AssetTextStyleCatalog implements TextStyleCatalog {
  constructor(private readonly styles: Record<string, unknown> | undefined) {}

  get(styleId: string, locale?: string): StyleObject | undefined {
    const candidate = this.styles?.[styleId];
    if (!candidate || typeof candidate !== 'object') return undefined;
    const baseStyle = candidate as StyleObject;
    if (!locale) {
      return baseStyle;
    }
    const localizedStyles = baseStyle['byLocale'];
    if (typeof localizedStyles !== 'object' || localizedStyles === null || Array.isArray(localizedStyles)) {
      return baseStyle;
    }
    const localizedStyle = (localizedStyles as Record<string, unknown>)[locale];
    if (typeof localizedStyle !== 'object' || localizedStyle === null || Array.isArray(localizedStyle)) {
      return baseStyle;
    }
    return {
      ...baseStyle,
      ...(localizedStyle as StyleObject),
      byLocale: localizedStyles,
    };
  }
}
