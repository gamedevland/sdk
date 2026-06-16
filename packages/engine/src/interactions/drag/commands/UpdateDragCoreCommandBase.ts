import { BaseTypedCommand } from '@engine/commands';
import { SchemaDecoder } from '@engine/validation';

import type { DragCoreSessionAccessor } from '../services/DragCoreSessionService';
import type { DragPointerPayload } from '../types';
import type { Decoder } from '@engine/validation';

export abstract class UpdateDragCoreCommandBase<TRuntime, TSession> extends BaseTypedCommand<DragPointerPayload> {
  private static readonly POINTER_PAYLOAD: Decoder<DragPointerPayload> = SchemaDecoder.object({
    pointerId: SchemaDecoder.number({ integer: true }),
    virtualX: SchemaDecoder.number(),
    virtualY: SchemaDecoder.number(),
  });

  protected override readonly inputDecoder = UpdateDragCoreCommandBase.POINTER_PAYLOAD;

  protected override async execute(pointer: DragPointerPayload): Promise<void> {
    const sessionService = this.getDragSessionService();
    const runtime = sessionService.getRuntime();
    if (!runtime) return;

    const session = sessionService.getActive();
    if (!session) return;
    if (!this.isOwnedByPointer(session, pointer.pointerId)) return;

    await this.updateActiveSession({ pointer, runtime, session });
  }

  protected abstract getDragSessionService(): DragCoreSessionAccessor<TRuntime, TSession>;

  protected abstract isOwnedByPointer(session: TSession, pointerId: number): boolean;

  protected abstract updateActiveSession(params: {
    pointer: DragPointerPayload;
    runtime: TRuntime;
    session: TSession;
  }): Promise<void> | void;
}
