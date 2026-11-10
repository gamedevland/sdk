import type { TextStyleCatalog, StyleObject } from './TextStyleCatalog';

export class EmptyTextStyleCatalog implements TextStyleCatalog {
  get(_styleId: string, _locale?: string): StyleObject | undefined {
    return undefined;
  }
}
