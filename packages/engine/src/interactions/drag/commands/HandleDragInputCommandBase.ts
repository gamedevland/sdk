import { BaseTypedCommand } from '@engine/commands';
import { SchemaDecoder } from '@engine/validation';

import type { DragInputRequestedPayload } from '../types';
import type { Decoder } from '@engine/validation';

export abstract class HandleDragInputCommandBase extends BaseTypedCommand<DragInputRequestedPayload> {
  private static readonly PAYLOAD: Decoder<DragInputRequestedPayload> = SchemaDecoder.object({
    phase: SchemaDecoder.enumOf(['start', 'move', 'end', 'cancel'] as const),
    pointerId: SchemaDecoder.number({ integer: true }),
    virtualX: SchemaDecoder.number(),
    virtualY: SchemaDecoder.number(),
  });

  protected override readonly inputDecoder = HandleDragInputCommandBase.PAYLOAD;

  protected override async execute(payload: DragInputRequestedPayload): Promise<void> {
    switch (payload.phase) {
      case 'start': {
        await this.onStart(payload);
        return;
      }
      case 'move': {
        await this.onMove(payload);
        return;
      }
      case 'end': {
        await this.onEnd(payload);
        return;
      }
      case 'cancel': {
        await this.onCancel(payload);
        return;
      }
    }
  }

  protected abstract onStart(payload: DragInputRequestedPayload): Promise<void> | void;

  protected abstract onMove(payload: DragInputRequestedPayload): Promise<void> | void;

  protected abstract onEnd(payload: DragInputRequestedPayload): Promise<void> | void;

  protected async onCancel(payload: DragInputRequestedPayload): Promise<void> {
    await this.onEnd(payload);
  }
}
