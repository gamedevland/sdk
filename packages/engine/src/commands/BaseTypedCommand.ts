import { BaseCommand } from './BaseCommand';

import type { Decoder } from '@engine/validation';

export abstract class BaseTypedCommand<TPayload> extends BaseCommand {
  protected abstract readonly inputDecoder: Decoder<TPayload>;

  protected abstract execute(payload: TPayload): Promise<void> | void;

  override run(data?: Record<string, unknown>): Promise<void> | void {
    const payload = this.decodePayload(data, this.inputDecoder);
    return this.execute(payload);
  }
}
