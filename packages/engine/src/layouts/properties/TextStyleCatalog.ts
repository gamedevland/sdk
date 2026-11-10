export type StyleObject = Record<string, unknown>;

export interface TextStyleCatalog {
  get(styleId: string, locale?: string): StyleObject | undefined;
}

export { EmptyTextStyleCatalog } from './EmptyTextStyleCatalog';
export { AssetTextStyleCatalog } from './AssetTextStyleCatalog';
