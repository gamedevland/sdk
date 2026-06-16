/**
 * Ordered registry of display properties to apply on views.
 * The order matters to ensure correct layout: size/scale/style → anchor/pivot → position.
 *
 * Lower priority runs earlier. The default order is chosen to minimize visual jumps
 * and ensure that positional math uses final size/anchor/pivot values.
 */
import { AlphaVisibleProperty } from '../properties/AlphaVisibleProperty';
import { AnchorPivotFallbackProperty } from '../properties/AnchorPivotFallbackProperty';
import { AnchorProperty } from '../properties/AnchorProperty';
import { AngleProperty } from '../properties/AngleProperty';
import { ColorProperty } from '../properties/ColorProperty';
import { GraphicsRectProperty } from '../properties/GraphicsRectProperty';
import { PivotProperty } from '../properties/PivotProperty';
import { PositionProperty } from '../properties/PositionProperty';
import { ScaleProperty } from '../properties/ScaleProperty';
import { SizeProperty } from '../properties/SizeProperty';
import { ZIndexProperty } from '../properties/ZIndexProperty';

import type { NodeProperty } from '../properties/NodeProperty';

type Entry = { priority: number; property: NodeProperty };

export class PropertyRegistry {
  private entries: Entry[] = [];

  /** Register a property with a given priority (lower runs earlier). */
  register(property: NodeProperty, priority: number): void {
    this.entries.push({ property, priority });
    this.entries.sort((a, b) => a.priority - b.priority);
  }

  /** Return properties in application order. */
  getAllOrdered(): NodeProperty[] {
    return this.entries.map((e) => e.property);
  }

  /** Create a default registry with a carefully chosen order. */
  static createDefault(): PropertyRegistry {
    const reg = new PropertyRegistry();
    // Порядок важен: размеры/масштаб/базовые стили → anchor/pivot → позиционирование → zIndex
    reg.register(new SizeProperty(), 10);
    // Рисуем геометрию Graphics на ранней стадии, когда размеры уже известны
    reg.register(new ScaleProperty(), 20);
    // Разнесённые стили
    reg.register(new ColorProperty(), 30);
    reg.register(new AlphaVisibleProperty(), 31);
    reg.register(new AngleProperty(), 32);
    reg.register(new AnchorProperty(), 40);
    // Fallback: compute pivot from anchor for views without native anchor (only when anchor specified and pivot not specified)
    reg.register(new AnchorPivotFallbackProperty(), 45);
    reg.register(new PivotProperty(), 50);
    reg.register(new PositionProperty(), 60);
    reg.register(new GraphicsRectProperty(), 33);
    reg.register(new ZIndexProperty(), 62);
    return reg;
  }
}
