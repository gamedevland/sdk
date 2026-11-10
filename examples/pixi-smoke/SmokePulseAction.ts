import { BaseTypedAction } from '@gamedevland/engine/layouts';
import { NodeBase } from '@gamedevland/engine/renderers/pixi';
import { SchemaDecoder as S } from '@gamedevland/engine/validation';
import type { InferDecoded } from '@gamedevland/engine/validation';
const config = S.strictObject({scale: S.number({min: 0.1}), durationMs: S.number({min: 1})});
const input = S.strictObject({});
export class SmokePulseAction extends BaseTypedAction<InferDecoded<typeof config>, InferDecoded<typeof input>, NodeBase> {
  protected readonly nodeType = NodeBase;
  protected readonly configDecoder = config;
  protected readonly inputDecoder = input;
  protected override async execute(): Promise<void> {
    await this.ownTween(this.node.tweens.scaleTo(this.config.scale, this.config.durationMs / 1000, {repeat: 1, yoyo: true}));
  }
}
