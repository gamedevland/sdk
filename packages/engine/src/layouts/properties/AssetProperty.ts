/**
 * Applies a texture asset to views exposing `texture` using an ImageBitmap asset id.
 */
import { Texture } from 'pixi.js';

import { LocaleCatalog } from '../../configs/common/LocaleCatalog';
import { ElementPropsDecoder } from '../nodes/internal/ElementPropsDecoder';

import type { NodeProperty } from './NodeProperty';
import type { NodePropertyContext } from './NodeProperty';

export class AssetProperty implements NodeProperty {
  private static readonly propsDecoder = new ElementPropsDecoder('AssetProperty.apply');

  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void {
    if (!ctx.getAsset) return;
    const typedCfg = cfg as { props?: Record<string, unknown> } | undefined;
    const props = typedCfg?.props ?? {};
    const assetId = this.resolveAssetId(props, ctx);
    if (!assetId) return;
    const bmp = ctx.getAsset(assetId) as ImageBitmap | undefined;
    if (!bmp) return;
    if (view && typeof view === 'object' && 'texture' in view) {
      (view as { texture: Texture }).texture = Texture.from(bmp);
    }
  }

  private resolveAssetId(
    props: Readonly<Record<string, unknown>>,
    ctx: NodePropertyContext,
  ): string | undefined {
    const localizedAssetId = this.resolveLocalizedAssetId(props, ctx);
    if (localizedAssetId !== undefined) {
      return localizedAssetId;
    }
    return AssetProperty.propsDecoder.readOptionalStringProp(props, 'asset');
  }

  private resolveLocalizedAssetId(
    props: Readonly<Record<string, unknown>>,
    ctx: NodePropertyContext,
  ): string | undefined {
    const raw = props.assetByLocale;
    if (typeof raw !== 'object' || raw === null) {
      return undefined;
    }

    const locale = LocaleCatalog.coerceSupported(ctx.getLocale?.());
    const assetByLocale = raw as Readonly<Record<string, unknown>>;
    const localizedAsset = assetByLocale[locale];
    if (typeof localizedAsset === 'string' && localizedAsset.length > 0) {
      return localizedAsset;
    }

    const fallbackAsset = assetByLocale[LocaleCatalog.DEFAULT];
    return typeof fallbackAsset === 'string' && fallbackAsset.length > 0
      ? fallbackAsset
      : undefined;
  }
}
