import { BaseTypedCommand } from '@engine/commands';
import { SchemaDecoder } from '@engine/validation';

import type { DragCoreSessionAccessor } from '../services/DragCoreSessionService';
import type { DragPointerPayload } from '../types';
import type { Decoder } from '@engine/validation';

export abstract class EndDragCoreCommandBase<TRuntime, TSession> extends BaseTypedCommand<DragPointerPayload> {
  private static readonly POINTER_PAYLOAD: Decoder<DragPointerPayload> = SchemaDecoder.object({
    pointerId: SchemaDecoder.number({ integer: true }),
    virtualX: SchemaDecoder.number(),
    virtualY: SchemaDecoder.number(),
  });

  protected override readonly inputDecoder = EndDragCoreCommandBase.POINTER_PAYLOAD;

  protected override async execute(pointer: DragPointerPayload): Promise<void> {
    const sessionService = this.getDragSessionService();
    const session = sessionService.getActive();
    if (!session) return;
    if (!this.isOwnedByPointer(session, pointer.pointerId)) return;

    const runtime = sessionService.getRuntime();
    if (!runtime) {
      await this.handleMissingRuntime({ pointer, session, sessionService });
      return;
    }

    await this.handleEnd({ pointer, runtime, session, sessionService });
  }

  protected abstract getDragSessionService(): DragCoreSessionAccessor<TRuntime, TSession>;

  protected abstract isOwnedByPointer(session: TSession, pointerId: number): boolean;

  protected abstract handleEnd(params: {
    pointer: DragPointerPayload;
    runtime: TRuntime;
    session: TSession;
    sessionService: DragCoreSessionAccessor<TRuntime, TSession>;
  }): Promise<void> | void;

  protected async handleMissingRuntime(params: {
    pointer: DragPointerPayload;
    session: TSession;
    sessionService: DragCoreSessionAccessor<TRuntime, TSession>;
  }): Promise<void> {
    params.sessionService.clearActive(params.session);
  }
}
