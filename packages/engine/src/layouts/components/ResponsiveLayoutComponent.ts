import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import { BaseTypedComponent } from './BaseTypedComponent';

import type { NodeBase } from '../nodes/NodeBase';
import type { Decoder, DecodeContext, InferDecoded } from '@engine/validation';

export interface ResponsiveLayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ResponsiveLayoutSnapshot {
  readonly area: ResponsiveLayoutRect;
  readonly target: ResponsiveLayoutRect;
  readonly scale: number;
}

type ResponsiveLayoutDimension = number | string;
type ResponsiveLayoutAlignX = 'left' | 'center' | 'right';
type ResponsiveLayoutAlignY = 'top' | 'center' | 'bottom';
type ResponsiveLayoutScaleMode = 'contain' | 'cover' | 'width';
type ResponsiveLayoutResizeMode = 'stretch';

const ScaleModeDecoder: Decoder<ResponsiveLayoutScaleMode> = SchemaDecoder.enumOf(
  ['contain', 'cover', 'width'] as const,
  { defaultValue: 'contain' },
);

const ResizeDecoder: Decoder<ResponsiveLayoutResizeMode | undefined> = (
  input: unknown,
  context: DecodeContext,
): ResponsiveLayoutResizeMode | undefined => {
  if (input === undefined) {
    return undefined;
  }
  return SchemaDecoder.enumOf(['stretch'] as const)(input, context);
};

const AlignXDecoder: Decoder<ResponsiveLayoutAlignX> = SchemaDecoder.enumOf(
  ['left', 'center', 'right'] as const,
  { defaultValue: 'center' },
);

const AlignYDecoder: Decoder<ResponsiveLayoutAlignY> = SchemaDecoder.enumOf(
  ['top', 'center', 'bottom'] as const,
  { defaultValue: 'center' },
);

const DimensionDecoder: Decoder<ResponsiveLayoutDimension | undefined> = (
  input: unknown,
  context: DecodeContext,
): ResponsiveLayoutDimension | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string' && input.length > 0) {
    return input;
  }
  throw EngineErrorFactory.invalidInput({
    code: EngineErrorCode.ConfigInvalidSchema,
    subsystem: EngineSubsystem.Config,
    message: `${context.source} expected finite number or non-empty string at '${context.path}'`,
    details: { source: context.source, path: context.path },
  });
};

const PaddingDecoder = SchemaDecoder.object({
  top: SchemaDecoder.number({ defaultValue: 0 }),
  right: SchemaDecoder.number({ defaultValue: 0 }),
  bottom: SchemaDecoder.number({ defaultValue: 0 }),
  left: SchemaDecoder.number({ defaultValue: 0 }),
});

const AreaDecoder = SchemaDecoder.object({
  y: DimensionDecoder,
  width: DimensionDecoder,
  height: DimensionDecoder,
  centerX: DimensionDecoder,
  centerY: DimensionDecoder,
  padding: PaddingDecoder,
});

const ScaleObjectDecoder = SchemaDecoder.object({
  mode: ScaleModeDecoder,
  screenWidth: SchemaDecoder.optional(SchemaDecoder.number({ min: 0 })),
  min: SchemaDecoder.number({ defaultValue: 0, min: 0 }),
  max: SchemaDecoder.number({ defaultValue: 1000, min: 0 }),
});

const ScaleRecordDecoder: Decoder<Record<string, unknown>> = (
  input: unknown,
  context: DecodeContext,
): Record<string, unknown> => {
  const record = SchemaDecoder.record()(input, context);
  if ('screenWidthByOrientation' in record) {
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.ConfigInvalidSchema,
      subsystem: EngineSubsystem.Config,
      message: `${context.source} does not support legacy scale.screenWidthByOrientation at '${context.path}'`,
      details: { source: context.source, path: context.path },
    });
  }
  return record;
};

const ScaleDecoder: Decoder<InferDecoded<typeof ScaleObjectDecoder> | undefined> = (
  input: unknown,
  context: DecodeContext,
): InferDecoded<typeof ScaleObjectDecoder> | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input === 'string') {
    return ScaleObjectDecoder({ mode: input }, context);
  }
  return ScaleObjectDecoder(ScaleRecordDecoder(input, context), context);
};

const PositionObjectDecoder = SchemaDecoder.object({
  x: AlignXDecoder,
  y: AlignYDecoder,
  offsetX: DimensionDecoder,
  offsetY: DimensionDecoder,
});

const PositionDecoder: Decoder<InferDecoded<typeof PositionObjectDecoder> | undefined> = (
  input: unknown,
  context: DecodeContext,
): InferDecoded<typeof PositionObjectDecoder> | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input === 'string') {
    if (input === 'center') {
      return PositionObjectDecoder({}, context);
    }
    return PositionObjectDecoder({ y: input }, context);
  }
  return PositionObjectDecoder(input, context);
};

const PartialPaddingDecoder = SchemaDecoder.object({
  top: SchemaDecoder.optional(SchemaDecoder.number()),
  right: SchemaDecoder.optional(SchemaDecoder.number()),
  bottom: SchemaDecoder.optional(SchemaDecoder.number()),
  left: SchemaDecoder.optional(SchemaDecoder.number()),
});

const PartialAreaDecoder = SchemaDecoder.object({
  y: DimensionDecoder,
  width: DimensionDecoder,
  height: DimensionDecoder,
  centerX: DimensionDecoder,
  centerY: DimensionDecoder,
  padding: SchemaDecoder.optional(PartialPaddingDecoder),
});

const PartialScaleObjectDecoder = SchemaDecoder.object({
  mode: SchemaDecoder.optional(ScaleModeDecoder),
  screenWidth: SchemaDecoder.optional(SchemaDecoder.number({ min: 0 })),
  min: SchemaDecoder.optional(SchemaDecoder.number({ min: 0 })),
  max: SchemaDecoder.optional(SchemaDecoder.number({ min: 0 })),
});

const PartialScaleDecoder: Decoder<InferDecoded<typeof PartialScaleObjectDecoder> | undefined> = (
  input: unknown,
  context: DecodeContext,
): InferDecoded<typeof PartialScaleObjectDecoder> | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input === 'string') {
    return PartialScaleObjectDecoder({ mode: input }, context);
  }
  return PartialScaleObjectDecoder(ScaleRecordDecoder(input, context), context);
};

const PartialPositionObjectDecoder = SchemaDecoder.object({
  x: SchemaDecoder.optional(AlignXDecoder),
  y: SchemaDecoder.optional(AlignYDecoder),
  offsetX: DimensionDecoder,
  offsetY: DimensionDecoder,
});

const PartialPositionDecoder: Decoder<InferDecoded<typeof PartialPositionObjectDecoder> | undefined> = (
  input: unknown,
  context: DecodeContext,
): InferDecoded<typeof PartialPositionObjectDecoder> | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (typeof input === 'string') {
    if (input === 'center') {
      return PartialPositionObjectDecoder({ x: 'center', y: 'center' }, context);
    }
    return PartialPositionObjectDecoder({ x: 'center', y: input }, context);
  }
  return PartialPositionObjectDecoder(input, context);
};

const OrientationOverrideDecoder = SchemaDecoder.object({
  area: SchemaDecoder.optional(PartialAreaDecoder),
  scale: PartialScaleDecoder,
  resize: ResizeDecoder,
  position: PartialPositionDecoder,
  areaOnly: SchemaDecoder.optional(SchemaDecoder.boolean()),
});

const ConfigDecoder = SchemaDecoder.object({
  area: AreaDecoder,
  scale: ScaleDecoder,
  resize: ResizeDecoder,
  position: PositionDecoder,
  areaOnly: SchemaDecoder.boolean({ defaultValue: false }),
  orientation: SchemaDecoder.optional(SchemaDecoder.object({
    land: SchemaDecoder.optional(OrientationOverrideDecoder),
    port: SchemaDecoder.optional(OrientationOverrideDecoder),
  })),
});

type ResponsiveLayoutConfig = InferDecoded<typeof ConfigDecoder>;
type ResponsiveLayoutBaseConfig = Omit<ResponsiveLayoutConfig, 'orientation'>;
type ResponsiveLayoutAreaConfig = InferDecoded<typeof AreaDecoder>;
type ResponsiveLayoutScaleConfig = InferDecoded<typeof ScaleObjectDecoder>;
type ResponsiveLayoutPositionConfig = InferDecoded<typeof PositionObjectDecoder>;
type ResponsiveLayoutOrientationOverrideConfig = InferDecoded<typeof OrientationOverrideDecoder>;

export class ResponsiveLayoutComponent extends BaseTypedComponent<ResponsiveLayoutConfig, NodeBase> {
  protected override readonly configDecoder = ConfigDecoder;

  private lastSnapshot: ResponsiveLayoutSnapshot | undefined;
  private unsubscribeScreen: (() => void) | undefined;

  protected override onInit(): void {
    this.assertConfig();
  }

  protected override onEnable(): void {
    this.refresh();
    this.unsubscribeScreen = this.node.events.on('SCREEN_CHANGED', () => {
      this.refresh();
    });
  }

  protected override onDisable(): void {
    this.unsubscribeScreen?.();
    this.unsubscribeScreen = undefined;
  }

  override onDetach(): void {
    this.unsubscribeScreen = undefined;
    this.lastSnapshot = undefined;
    super.onDetach();
  }

  refresh(): ResponsiveLayoutSnapshot {
    const config = this.resolveEffectiveConfig();
    const area = this.resolveArea(config.area);
    const scale = this.applyOwnerLayout(config, area);
    const snapshot = {
      area,
      target: config.areaOnly ? area : this.resolveGlobalRect(this.node),
      scale,
    };

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  getLayoutSnapshot(): ResponsiveLayoutSnapshot {
    const snapshot = this.lastSnapshot;
    if (snapshot !== undefined) {
      return snapshot;
    }

    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'Responsive layout snapshot is not available yet',
      details: { method: 'ResponsiveLayoutComponent.getLayoutSnapshot' },
    });
  }

  private assertConfig(): void {
    this.assertResolvedConfig(this.resolveConfigForOrientation('land'));
    this.assertResolvedConfig(this.resolveConfigForOrientation('port'));
  }

  private assertResolvedConfig(config: ResponsiveLayoutBaseConfig): void {
    const scale = config.scale;
    if (scale !== undefined && scale.max < scale.min) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'scale.max must be greater than or equal to scale.min',
        details: {
          method: 'ResponsiveLayoutComponent.assertConfig',
          min: scale.min,
          max: scale.max,
        },
      });
    }
    if (config.scale !== undefined && config.resize !== undefined) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'responsive layout scale and resize cannot be used together',
        details: { method: 'ResponsiveLayoutComponent.assertConfig' },
      });
    }
  }

  private resolveEffectiveConfig(): ResponsiveLayoutBaseConfig {
    return this.resolveConfigForOrientation(this.node.screen.getOrientation());
  }

  private resolveConfigForOrientation(orientation: 'land' | 'port'): ResponsiveLayoutBaseConfig {
    const override = this.config.orientation?.[orientation];
    if (override === undefined) {
      return this.config;
    }

    return {
      area: this.mergeAreaConfig(this.config.area, override.area),
      scale: this.mergeScaleConfig(this.config.scale, override.scale),
      resize: override.resize ?? this.config.resize,
      position: this.mergePositionConfig(this.config.position, override.position),
      areaOnly: override.areaOnly ?? this.config.areaOnly,
    };
  }

  private mergeAreaConfig(
    base: ResponsiveLayoutAreaConfig,
    override: ResponsiveLayoutOrientationOverrideConfig['area'],
  ): ResponsiveLayoutAreaConfig {
    if (override === undefined) {
      return base;
    }

    return {
      y: override.y ?? base.y,
      width: override.width ?? base.width,
      height: override.height ?? base.height,
      centerX: override.centerX ?? base.centerX,
      centerY: override.centerY ?? base.centerY,
      padding: {
        top: override.padding?.top ?? base.padding.top,
        right: override.padding?.right ?? base.padding.right,
        bottom: override.padding?.bottom ?? base.padding.bottom,
        left: override.padding?.left ?? base.padding.left,
      },
    };
  }

  private mergeScaleConfig(
    base: ResponsiveLayoutScaleConfig | undefined,
    override: ResponsiveLayoutOrientationOverrideConfig['scale'],
  ): ResponsiveLayoutScaleConfig | undefined {
    if (override === undefined) {
      return base;
    }

    return {
      mode: override.mode ?? base?.mode ?? 'contain',
      screenWidth: override.screenWidth ?? base?.screenWidth,
      min: override.min ?? base?.min ?? 0,
      max: override.max ?? base?.max ?? 1000,
    };
  }

  private mergePositionConfig(
    base: ResponsiveLayoutPositionConfig | undefined,
    override: ResponsiveLayoutOrientationOverrideConfig['position'],
  ): ResponsiveLayoutPositionConfig | undefined {
    if (override === undefined) {
      return base;
    }

    return {
      x: override.x ?? base?.x ?? 'center',
      y: override.y ?? base?.y ?? 'center',
      offsetX: override.offsetX ?? base?.offsetX,
      offsetY: override.offsetY ?? base?.offsetY,
    };
  }

  private resolveArea(config: ResponsiveLayoutAreaConfig): ResponsiveLayoutRect {
    const screen = this.node.screen.getVirtualSize();
    const base = { x: 0, y: 0, width: screen.width, height: screen.height };
    const rawWidth = this.resolveDimension(config.width, base.width, base.width, 'area.width');
    const rawHeight = this.resolveDimension(config.height, base.height, base.height, 'area.height');
    const resolvedX = this.resolveAreaX(config, base, rawWidth);
    const resolvedY = this.resolveAreaY(config, base, rawHeight);
    const paddedX = resolvedX + config.padding.left;
    const paddedY = resolvedY + config.padding.top;
    const paddedWidth = Math.max(1, rawWidth - config.padding.left - config.padding.right);
    const paddedHeight = Math.max(1, rawHeight - config.padding.top - config.padding.bottom);

    return {
      x: paddedX,
      y: paddedY,
      width: paddedWidth,
      height: paddedHeight,
    };
  }

  private resolveAreaX(
    config: ResponsiveLayoutAreaConfig,
    base: ResponsiveLayoutRect,
    width: number,
  ): number {
    if (config.centerX !== undefined) {
      const offset = this.resolveDimension(config.centerX, base.width, 0, 'area.centerX');
      return base.x + (base.width - width) / 2 + offset;
    }
    return base.x;
  }

  private resolveAreaY(
    config: ResponsiveLayoutAreaConfig,
    base: ResponsiveLayoutRect,
    height: number,
  ): number {
    if (config.y !== undefined) {
      return base.y + this.resolveDimension(config.y, base.height, 0, 'area.y');
    }
    if (config.centerY !== undefined) {
      const offset = this.resolveDimension(config.centerY, base.height, 0, 'area.centerY');
      return base.y + (base.height - height) / 2 + offset;
    }
    return base.y;
  }

  private applyOwnerLayout(config: ResponsiveLayoutBaseConfig, area: ResponsiveLayoutRect): number {
    if (config.areaOnly) {
      return 1;
    }
    if (config.resize === 'stretch') {
      this.node.setWidth(Math.round(area.width));
      this.node.setHeight(Math.round(area.height));
      this.applyAlign(this.node, area, 'left', 'top', undefined, undefined);
      return 1;
    }

    const scale = this.applyScale(this.node, area, config.scale);
    if (config.position !== undefined) {
      this.applyPosition(this.node, area, config.position);
    }
    return scale;
  }

  private applyScale(
    target: NodeBase,
    area: ResponsiveLayoutRect,
    scaleConfig: ResponsiveLayoutScaleConfig | undefined,
  ): number {
    if (scaleConfig === undefined) {
      return 1;
    }

    const bounds = this.resolveRequiredLocalBounds(target, 'ResponsiveLayoutComponent.applyScale');
    const scale = this.resolveScale(scaleConfig, bounds.width, bounds.height, area);
    target.setScale(scale);
    return scale;
  }

  private resolveScale(
    scaleConfig: ResponsiveLayoutScaleConfig,
    targetWidth: number,
    targetHeight: number,
    area: ResponsiveLayoutRect,
  ): number {
    const widthScale = area.width / targetWidth;
    const heightScale = area.height / targetHeight;
    let rawScale: number;

    if (scaleConfig.mode === 'contain') {
      rawScale = Math.min(widthScale, heightScale);
    } else if (scaleConfig.mode === 'cover') {
      rawScale = Math.max(widthScale, heightScale);
    } else {
      const width = scaleConfig.screenWidth === undefined
        ? area.width
        : this.node.screen.getVirtualSize().width * scaleConfig.screenWidth;
      rawScale = width / targetWidth;
    }

    return this.clamp(rawScale, scaleConfig.min, scaleConfig.max);
  }

  private applyPosition(
    target: NodeBase,
    area: ResponsiveLayoutRect,
    position: ResponsiveLayoutPositionConfig,
  ): void {
    this.applyAlign(target, area, position.x, position.y, position.offsetX, position.offsetY);
  }

  private applyAlign(
    target: NodeBase,
    area: ResponsiveLayoutRect,
    alignX: ResponsiveLayoutAlignX,
    alignY: ResponsiveLayoutAlignY,
    offsetX: ResponsiveLayoutDimension | undefined,
    offsetY: ResponsiveLayoutDimension | undefined,
  ): void {
    const bounds = this.resolveRequiredLocalBounds(target, 'ResponsiveLayoutComponent.applyAlign');
    const scaledWidth = bounds.width * Math.abs(target.view.scale.x);
    const scaledHeight = bounds.height * Math.abs(target.view.scale.y);
    const x = this.resolveAlignedX(area, scaledWidth, alignX)
      - bounds.x * target.view.scale.x
      + this.resolveDimension(offsetX, area.width, 0, 'position.offsetX');
    const y = this.resolveAlignedY(area, scaledHeight, alignY)
      - bounds.y * target.view.scale.y
      + this.resolveDimension(offsetY, area.height, 0, 'position.offsetY');

    this.applyGlobalPosition(target, x, y);
  }

  private resolveGlobalRect(target: NodeBase): ResponsiveLayoutRect {
    const bounds = this.resolveRequiredLocalBounds(target, 'ResponsiveLayoutComponent.resolveGlobalRect');
    const sceneRoot = this.node.engine.getSceneRenderRoot();
    const topLeft = sceneRoot.toLocal(target.view.toGlobal({ x: bounds.x, y: bounds.y }));
    const bottomRight = sceneRoot.toLocal(
      target.view.toGlobal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
    );

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
      height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)),
    };
  }

  private resolveRequiredLocalBounds(
    target: NodeBase,
    method: string,
  ): ResponsiveLayoutRect {
    const bounds = target.view.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Responsive layout target bounds must be greater than zero',
        details: {
          method,
          nodeId: target.id,
          width: bounds.width,
          height: bounds.height,
        },
      });
    }

    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  private applyGlobalPosition(target: NodeBase, x: number, y: number): void {
    const parent = target.view.parent;
    const sceneRoot = this.node.engine.getSceneRenderRoot();

    if (parent === null) {
      target.setPosition(Math.round(x), Math.round(y));
      return;
    }

    const local = parent.toLocal({ x, y }, sceneRoot);
    target.setPosition(Math.round(local.x), Math.round(local.y));
  }

  private resolveAlignedX(
    area: ResponsiveLayoutRect,
    targetWidth: number,
    align: ResponsiveLayoutAlignX,
  ): number {
    if (align === 'left') {
      return area.x;
    }
    if (align === 'right') {
      return area.x + area.width - targetWidth;
    }
    return area.x + (area.width - targetWidth) / 2;
  }

  private resolveAlignedY(
    area: ResponsiveLayoutRect,
    targetHeight: number,
    align: ResponsiveLayoutAlignY,
  ): number {
    if (align === 'top') {
      return area.y;
    }
    if (align === 'bottom') {
      return area.y + area.height - targetHeight;
    }
    return area.y + (area.height - targetHeight) / 2;
  }

  private resolveDimension(
    value: ResponsiveLayoutDimension | undefined,
    referenceSize: number,
    defaultValue: number,
    field: string,
  ): number {
    if (value === undefined) {
      return defaultValue;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (value.endsWith('%')) {
      const parsed = Number(value.slice(0, -1));
      if (Number.isFinite(parsed)) {
        return (referenceSize * parsed) / 100;
      }
    }

    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.LayoutInvalidConfig,
      subsystem: EngineSubsystem.Layout,
      message: `${field} must be a finite number or a percent string`,
      details: {
        method: 'ResponsiveLayoutComponent.resolveDimension',
        field,
        value,
      },
    });
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
