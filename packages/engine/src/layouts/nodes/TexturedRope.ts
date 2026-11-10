import {
  MeshRope,
  Point,
  Texture,
} from 'pixi.js';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import { ElementPropsDecoder } from './internal/ElementPropsDecoder';
import { NodeBase } from './NodeBase';

import type { TexturedRopeNode, DisplayNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { AssetId } from '../../assets/types';
import type { ElementConfig } from '@engine/renderers/pixi/types';
import type { InferDecoded } from '@engine/validation';
import type { RopeGeometry } from 'pixi.js';

export interface RopePointOffset {
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

export interface TexturedRopeTextureSize {
  readonly width: number;
  readonly height: number;
}

interface AnchorAdapter {
  readonly set: (x: number, y: number) => void;
}

interface AnchorCompatibleMeshRope extends MeshRope {
  anchor: AnchorAdapter;
}

const PropsDecoder = SchemaDecoder.object({
  asset: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
  pointCount: SchemaDecoder.number({ defaultValue: 10, min: 2, integer: true }),
  textureScale: SchemaDecoder.number({ defaultValue: 0, min: 0 }),
  autoUpdate: SchemaDecoder.boolean({ defaultValue: true }),
});

type TexturedRopeProps = InferDecoded<typeof PropsDecoder>;

export class TexturedRope extends NodeBase implements TexturedRopeNode {
  private readonly points: Point[];
  private readonly offsets: Point[];
  private readonly offsetLayers = new Map<string, Point[]>();
  private anchorX = 0;
  private anchorY = 0.5;

  constructor(
    private readonly rope: AnchorCompatibleMeshRope,
    points: Point[],
  ) {
    super(rope);
    this.points = points;
    this.offsets = this.points.map(() => new Point(0, 0));
    this.setKind('texturedRope');
  }

  static create(_id: string, cfg: ElementConfig, ctx: { assets: AssetManager }): DisplayNode {
    const propsDecoder = new ElementPropsDecoder('TexturedRope.create');
    const props = SchemaDecoder.decode(
      propsDecoder.readProps(cfg),
      PropsDecoder,
      'TexturedRope.create.props',
    );
    const texture = TexturedRope.resolveInitialTexture(props, ctx.assets);
    const points = TexturedRope.createPoints(props.pointCount, texture.width, texture.height, 0, 0.5);
    const rope = new MeshRope({
      texture,
      points,
      textureScale: props.textureScale,
    }) as AnchorCompatibleMeshRope;

    rope.autoUpdate = props.autoUpdate;
    rope.anchor = {
      set: (x: number, y: number): void => {
        const owner = TexturedRope.resolveOwner(rope);
        owner.setAnchor(x, y);
      },
    };

    const node = new TexturedRope(rope, points);
    TexturedRope.assignOwner(rope, node);
    return node;
  }

  override get view(): MeshRope {
    return this.rope;
  }

  setTexture(texture: Texture | ImageBitmap): this {
    if (texture instanceof Texture) {
      this.rope.texture = texture;
      this.refreshNeutralPoints();
      return this;
    }
    if (typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap) {
      this.rope.texture = Texture.from(texture);
      this.refreshNeutralPoints();
      return this;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.LayoutInvalidConfig,
      subsystem: EngineSubsystem.Layout,
      message: 'Texture must be PIXI.Texture or ImageBitmap',
      details: { method: 'TexturedRope.setTexture' },
    });
  }

  setTextureByAssetId(assetId: AssetId): this {
    const bitmap = this.engine.assets.getRequired<ImageBitmap>(
      assetId,
      'TexturedRope.setTextureByAssetId',
    );
    return this.setTexture(bitmap);
  }

  getTextureSize(source?: string): TexturedRopeTextureSize {
    const width = this.rope.texture.width;
    const height = this.rope.texture.height;
    if (width > 0 && height > 0) {
      return { width, height };
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'TexturedRope texture size is not initialized',
      details: {
        method: 'TexturedRope.getTextureSize',
        nodeId: this.id,
        width,
        height,
        ...(source === undefined ? {} : { source }),
      },
    });
  }

  setRopePointCount(pointCount: number): this {
    if (!Number.isInteger(pointCount) || pointCount < 2) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Rope point count must be an integer greater than or equal to 2',
        details: { method: 'TexturedRope.setRopePointCount', pointCount },
      });
    }

    this.points.length = 0;
    this.offsets.length = 0;
    this.offsetLayers.clear();
    for (let index = 0; index < pointCount; index += 1) {
      this.points.push(new Point(0, 0));
      this.offsets.push(new Point(0, 0));
    }
    this.getRopeGeometry().points = this.points;
    this.refreshNeutralPoints();
    return this;
  }

  getRopePointCount(): number {
    return this.points.length;
  }

  getRopeLength(): number {
    return this.rope.texture.width;
  }

  getRopeHeight(): number {
    return this.rope.texture.height;
  }

  resetRopePoints(): this {
    for (const offset of this.offsets) {
      offset.set(0, 0);
    }
    this.offsetLayers.clear();
    this.refreshNeutralPoints();
    return this;
  }

  setRopePointOffset(index: number, x: number, y: number): this {
    this.assertOffsetInput(index, x, y, 'TexturedRope.setRopePointOffset');
    this.getOffset(index).set(x, y);
    this.refreshPoint(index);
    return this;
  }

  setRopePointOffsets(offsets: readonly RopePointOffset[]): this {
    for (const offset of offsets) {
      this.assertOffsetInput(
        offset.index,
        offset.x,
        offset.y,
        'TexturedRope.setRopePointOffsets',
      );
    }
    for (const offset of offsets) {
      this.getOffset(offset.index).set(offset.x, offset.y);
      this.refreshPointPosition(offset.index);
    }
    this.updateGeometry();
    return this;
  }

  setRopePointOffsetLayer(layerId: string, offsets: readonly RopePointOffset[]): this {
    this.assertLayerId(layerId, 'TexturedRope.setRopePointOffsetLayer');
    for (const offset of offsets) {
      this.assertOffsetInput(
        offset.index,
        offset.x,
        offset.y,
        'TexturedRope.setRopePointOffsetLayer',
      );
    }

    const layer = this.ensureOffsetLayer(layerId);
    for (const point of layer) {
      point.set(0, 0);
    }
    for (const offset of offsets) {
      this.getLayerOffset(layer, offset.index, layerId).set(offset.x, offset.y);
    }
    this.refreshNeutralPoints();
    return this;
  }

  clearRopePointOffsetLayer(layerId: string): this {
    this.assertLayerId(layerId, 'TexturedRope.clearRopePointOffsetLayer');
    if (!this.offsetLayers.delete(layerId)) {
      return this;
    }
    this.refreshNeutralPoints();
    return this;
  }

  protected override applyAnchor(anchorX: number, anchorY: number): this {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.refreshNeutralPoints();
    return this;
  }

  private refreshNeutralPoints(): void {
    for (let index = 0; index < this.points.length; index += 1) {
      this.refreshPointPosition(index);
    }
    this.updateGeometry();
  }

  private refreshPoint(index: number): void {
    this.refreshPointPosition(index);
    this.updateGeometry();
  }

  private refreshPointPosition(index: number): void {
    const denominator = Math.max(1, this.points.length - 1);
    const ratio = index / denominator;
    const texture = this.rope.texture;
    const neutralX = -this.anchorX * texture.width + texture.width * ratio;
    const neutralY = (0.5 - this.anchorY) * texture.height;
    const offset = this.resolvePointOffset(index);
    this.getPoint(index).set(neutralX + offset.x, neutralY + offset.y);
  }

  private resolvePointOffset(index: number): { readonly x: number; readonly y: number } {
    const baseOffset = this.getOffset(index);
    let x = baseOffset.x;
    let y = baseOffset.y;
    for (const layer of this.offsetLayers.values()) {
      const offset = layer[index];
      if (offset !== undefined) {
        x += offset.x;
        y += offset.y;
      }
    }
    return { x, y };
  }

  private getPoint(index: number): Point {
    const point = this.points[index];
    if (point !== undefined) {
      return point;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'TexturedRope point is missing',
      details: { method: 'TexturedRope.getPoint', index, pointCount: this.points.length },
    });
  }

  private getOffset(index: number): Point {
    const offset = this.offsets[index];
    if (offset !== undefined) {
      return offset;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'TexturedRope point offset is missing',
      details: { method: 'TexturedRope.getOffset', index, pointCount: this.offsets.length },
    });
  }

  private ensureOffsetLayer(layerId: string): Point[] {
    const existing = this.offsetLayers.get(layerId);
    if (existing !== undefined) {
      return existing;
    }
    const layer = this.points.map(() => new Point(0, 0));
    this.offsetLayers.set(layerId, layer);
    return layer;
  }

  private getLayerOffset(layer: readonly Point[], index: number, layerId: string): Point {
    const offset = layer[index];
    if (offset !== undefined) {
      return offset;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'TexturedRope layer point offset is missing',
      details: {
        method: 'TexturedRope.getLayerOffset',
        layerId,
        index,
        pointCount: layer.length,
      },
    });
  }

  private updateGeometry(): void {
    this.getRopeGeometry().update();
  }

  private getRopeGeometry(): RopeGeometry {
    return this.rope.geometry as RopeGeometry;
  }

  private assertOffsetInput(index: number, x: number, y: number, method: string): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.points.length) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Rope point index is out of range',
        details: { method, index, pointCount: this.points.length },
      });
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Rope point offset values must be finite numbers',
        details: { method, index, x, y },
      });
    }
  }

  private assertLayerId(layerId: string, method: string): void {
    if (layerId.length > 0) {
      return;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.LayoutInvalidConfig,
      subsystem: EngineSubsystem.Layout,
      message: 'Rope point offset layer id must be non-empty',
      details: { method, layerId },
    });
  }

  private static resolveInitialTexture(props: TexturedRopeProps, assets: AssetManager): Texture {
    if (props.asset === undefined) {
      return Texture.WHITE;
    }
    const bitmap = assets.get<ImageBitmap>(props.asset);
    return bitmap === undefined ? Texture.WHITE : Texture.from(bitmap);
  }

  private static createPoints(
    pointCount: number,
    width: number,
    height: number,
    anchorX: number,
    anchorY: number,
  ): Point[] {
    const points: Point[] = [];
    const denominator = Math.max(1, pointCount - 1);
    for (let index = 0; index < pointCount; index += 1) {
      const ratio = index / denominator;
      points.push(new Point(-anchorX * width + width * ratio, (0.5 - anchorY) * height));
    }
    return points;
  }

  private static assignOwner(rope: MeshRope, owner: TexturedRope): void {
    Object.defineProperty(rope, '__texturedRopeOwner', {
      configurable: true,
      value: owner,
    });
  }

  private static resolveOwner(rope: MeshRope): TexturedRope {
    const owner = (rope as MeshRope & { readonly __texturedRopeOwner?: TexturedRope })
      .__texturedRopeOwner;
    if (owner !== undefined) {
      return owner;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'TexturedRope owner is not attached',
      details: { method: 'TexturedRope.resolveOwner' },
    });
  }
}
