import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { NodeBase } from '../NodeBase';
import { BaseAction } from './BaseAction';

import type { Decoder } from '@engine/validation';

export abstract class BaseTypedAction<TConfig, TInput = Record<string, never>, TNode extends NodeBase = NodeBase> extends BaseAction<TNode> {
  private _typedConfig: TConfig | undefined;

  protected abstract readonly configDecoder: Decoder<TConfig>;
  protected abstract readonly inputDecoder: Decoder<TInput>;

  protected get config(): TConfig {
    if (this._typedConfig === undefined) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Typed action config is not initialized',
        details: { className: this.constructor.name, method: 'BaseTypedAction.config' },
      });
    }
    return this._typedConfig;
  }

  protected abstract execute(input: TInput): Promise<void> | void;

  protected override onBaseInit(): void {
    this._typedConfig = this.decodeConfig(this.configDecoder, `${this.constructor.name}.config`);
    this.onInit();
  }

  override run(data?: Record<string, unknown>): Promise<void> | void {
    const input = this.decodeInput(data, this.inputDecoder, `${this.constructor.name}.input`);
    return this.execute(input);
  }

  override onDetach(): void | Promise<void> {
    return super.onDetach();
  }

  protected override finalizeDetachState(): void {
    this._typedConfig = undefined;
    super.finalizeDetachState();
  }
}
