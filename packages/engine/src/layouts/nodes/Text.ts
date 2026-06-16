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

  protected override applyAnchor(anchorX: number, anchorY: number): this {
    this.view.anchor.set(anchorX, anchorY);
    return this;
  }
}
