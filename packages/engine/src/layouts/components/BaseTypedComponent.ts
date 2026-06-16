import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { BaseComponent } from './BaseComponent';

import type { NodeBase } from '../nodes/NodeBase';
import type { Decoder } from '@engine/validation';

export abstract class BaseTypedComponent<TConfig, TNode extends NodeBase = NodeBase> extends BaseComponent<TNode> {
  private _typedConfig: TConfig | undefined;

  protected abstract readonly configDecoder: Decoder<TConfig>;

  protected get config(): TConfig {
    if (this._typedConfig === undefined) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Typed component config is not initialized',
        details: { className: this.constructor.name, method: 'BaseTypedComponent.config' },
      });
    }
    return this._typedConfig;
  }

  protected override onBaseInit(): void {
    this._typedConfig = this.decodeConfig(this.configDecoder, `${this.constructor.name}.config`);
    this.onInit();
  }

  override onDetach(): void | Promise<void> {
    return super.onDetach();
  }

  protected override finalizeDetachState(): void {
    this._typedConfig = undefined;
    super.finalizeDetachState();
  }
}
