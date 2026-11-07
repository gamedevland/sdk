import type { SupportedLocaleCode } from './LocaleCatalog';

/**
 * Text style config types commonly used across games.
 * Part of engine configs module; domain-agnostic.
 */
export interface TextStyleStrokeDef {
  readonly color: string;
  readonly width: number;
}

export interface TextStyleDropShadowDef {
  readonly color?: string;
  readonly alpha?: number;
  readonly blur?: number;
  readonly angle?: number;
  readonly distance?: number;
}

export interface TextStyleDef {
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly fontWeight?: string;
  readonly fill?: readonly string[];
  readonly align?: 'left' | 'center' | 'right';
  readonly stroke?: TextStyleStrokeDef;
  readonly dropShadow?: TextStyleDropShadowDef;
  readonly wordWrap?: boolean;
  readonly wordWrapWidth?: number;
  readonly byLocale?: Readonly<Partial<Record<SupportedLocaleCode, TextStyleDef>>>;
}

/** Map of style name to definition. */
export type TextStylesConfig = Record<string, TextStyleDef>;
