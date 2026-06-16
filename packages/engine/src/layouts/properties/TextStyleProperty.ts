/**
 * Applies text style object (e.g., font, size, fill) by shallow-assigning onto view.style.
 */
import { LocaleCatalog } from '../../configs/common/LocaleCatalog';

import { ColorParser } from './internal/ColorParser';

import type { NodeProperty } from './NodeProperty';
import type { NodePropertyContext } from './NodeProperty';
import type { TextStyleCatalog } from './TextStyleCatalog';

type StyleObject = Record<string, unknown>;
type StyleStrokeObject = {
  color?: unknown;
};
type StyleDropShadowObject = {
  color?: unknown;
};

interface StyledView {
  style?: StyleObject;
}

export class TextStyleProperty implements NodeProperty {
  constructor(private readonly styles: TextStyleCatalog) {}

  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void {
    const cfgObj = cfg as { props?: { style?: unknown } } | undefined;
    const styleProp = cfgObj?.props?.style;
    if (!styleProp) return;
    let resolved: StyleObject | undefined;
    if (typeof styleProp === 'string') {
      resolved = this.styles.get(styleProp, LocaleCatalog.coerceSupported(ctx.getLocale?.()));
    } else {
      if (typeof styleProp === 'object') resolved = styleProp as StyleObject;
    }
    if (!resolved || !view || typeof view !== 'object' || !('style' in view)) return;
    const norm: StyleObject = { ...resolved };
    const parser = new ColorParser();
    const normalizeColor = (c: unknown): unknown => parser.parseToNumber(c) ?? c;
    if (norm.fill !== undefined) norm.fill = normalizeColor(norm.fill);
    this.normalizeStrokeColor(norm, normalizeColor);
    this.normalizeDropShadowColor(norm, normalizeColor);
    const targetStyle = (view as StyledView).style;
    if (!targetStyle || typeof targetStyle !== 'object') return;
    Object.assign(targetStyle, norm);
  }

  private normalizeStrokeColor(style: StyleObject, normalizeColor: (value: unknown) => unknown): void {
    const stroke = style['stroke'];
    if (!stroke || typeof stroke !== 'object' || Array.isArray(stroke)) {
      return;
    }
    const strokeObject = stroke as StyleStrokeObject;
    if (strokeObject.color !== undefined) {
      strokeObject.color = normalizeColor(strokeObject.color);
    }
  }

  private normalizeDropShadowColor(style: StyleObject, normalizeColor: (value: unknown) => unknown): void {
    const dropShadow = style['dropShadow'];
    if (!dropShadow || typeof dropShadow !== 'object' || Array.isArray(dropShadow)) {
      return;
    }
    const dropShadowObject = dropShadow as StyleDropShadowObject;
    if (dropShadowObject.color !== undefined) {
      dropShadowObject.color = normalizeColor(dropShadowObject.color);
    }
  }
}
