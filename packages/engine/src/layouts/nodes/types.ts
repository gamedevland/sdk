import type { AssetId } from '../../assets/types';
import type { NodeBase } from '../NodeBase';
/** Base interface for display nodes exposing a native `view`. */
export type DisplayNode = NodeBase;

/** Marker interface for container-like nodes. `_kind` is a soft tag used for RTTI. */
export interface ContainerNode extends DisplayNode {
  _kind?: 'container';
}
/** Marker interface for sprite nodes. `_kind` can help with conditional logic. */
export interface SpriteNode extends DisplayNode {
  _kind?: 'sprite';
}
/** Marker interface for tiling sprite nodes. */
export interface TilingSpriteNode extends DisplayNode {
  _kind?: 'tilingSprite';
  setTextureFromCanvas(canvas: HTMLCanvasElement): this;
  setTextureByAssetId(assetId: AssetId): this;
}
/** Marker interface for textured rope nodes. */
export interface TexturedRopeNode extends DisplayNode {
  _kind?: 'texturedRope';
  setTextureByAssetId(assetId: AssetId): this;
  getTextureSize(source?: string): { readonly width: number; readonly height: number };
  setRopePointCount(pointCount: number): this;
  getRopePointCount(): number;
  getRopeLength(): number;
  getRopeHeight(): number;
  resetRopePoints(): this;
  setRopePointOffset(index: number, x: number, y: number): this;
  setRopePointOffsets(offsets: readonly {
    readonly index: number;
    readonly x: number;
    readonly y: number;
  }[]): this;
  setRopePointOffsetLayer(layerId: string, offsets: readonly {
    readonly index: number;
    readonly x: number;
    readonly y: number;
  }[]): this;
  clearRopePointOffsetLayer(layerId: string): this;
}
/** Marker interface for text nodes. `_kind` is optional and not required at runtime. */
export interface TextNode extends DisplayNode {
  _kind?: 'text';
}

/** Marker interface for graphics nodes (Rect alias). */
export interface GraphicsNode extends DisplayNode {
  _kind?: 'graphics';
}
