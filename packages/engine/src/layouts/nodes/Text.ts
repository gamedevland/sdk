/**
 * Display node wrapping a Pixi Text. Initializes with props.text string.
 *
 * The actual visual style (font size, color, etc.) is applied later via display
 * properties (e.g., TextProperty/TextStyleProperty) in the DisplayManager pipeline.
 */
import * as PIXI from 'pixi.js';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { ElementPropsDecoder } from './internal/ElementPropsDecoder';
import { NodeBase } from './NodeBase';

import type { TextNode, DisplayNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { ElementConfig } from '../types';

export class Text extends NodeBase implements TextNode {
  constructor(private readonly text: PIXI.Text) {
    super(text);
    this.setKind('text');
  }
  /** Factory for layout element of type 'Text'; uses props.text (defaults to ''). */
  static create(_id: string, cfg: ElementConfig, _ctx: { assets: AssetManager }): DisplayNode {
    const props = new ElementPropsDecoder('Text.create').readProps(cfg);
    const rawText = props['text'];
    const text = rawText === undefined ? '' : String(rawText);
    return new Text(new PIXI.Text({ text }));
  }

  override get view(): PIXI.Text {
    return this.text;
  }

  setText(value: string): this {
    if (typeof value !== 'string') {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Text value must be a string',
        details: { method: 'Text.setText', value },
      });
    }
    this.view.text = value;
    return this;
  }

  /** Shrink the current font to fit local bounds, preserving node transforms. */
  fitTo(width: number, height?: number): this {
    if (!Number.isFinite(width) || width <= 0 || (height !== undefined && (!Number.isFinite(height) || height <= 0))) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig, subsystem: EngineSubsystem.Layout,
        message: 'Text fitting bounds must be positive', details: { method: 'Text.fitTo', width, height },
      });
    }
    if (this.view.text.length === 0) return this;
    const initialSize = this.view.style.fontSize;
    const initialLineHeight = this.view.style.lineHeight;
    const bounds = this.view.getLocalBounds();
    if (bounds.width <= width && (height === undefined || bounds.height <= height)) return this;
    let low = 1;
    let high = Math.floor(initialSize * 10);
    let best = low;
    while (low <= high) {
      const candidate = Math.floor((low + high) / 2);
      this.view.style.fontSize = candidate / 10;
      if (initialLineHeight > 0) this.view.style.lineHeight = initialLineHeight * candidate / (initialSize * 10);
      const measured = this.view.getLocalBounds();
      if (measured.width <= width && (height === undefined || measured.height <= height)) {
        best = candidate;
        low = candidate + 1;
      } else high = candidate - 1;
    }
    this.view.style.fontSize = best / 10;
    if (initialLineHeight > 0) this.view.style.lineHeight = initialLineHeight * best / (initialSize * 10);
    return this;
  }

  protected override applyAnchor(anchorX: number, anchorY: number): this {
    this.view.anchor.set(anchorX, anchorY);
    return this;
  }
}
