import { BaseTypedCommand } from '@engine/commands';
import { SchemaDecoder } from '@engine/validation';

import type { DragCoreSessionAccessor } from '../services/DragCoreSessionService';
import type { DragPointerPayload } from '../types';
import type { Decoder } from '@engine/validation';

export abstract class BeginDragCoreCommandBase<
  TRuntime,
  TSource,
  TSession,
> extends BaseTypedCommand<DragPointerPayload> {
  private static readonly POINTER_PAYLOAD: Decoder<DragPointerPayload> = SchemaDecoder.object({
    pointerId: SchemaDecoder.number({ integer: true }),
    virtualX: SchemaDecoder.number(),
    virtualY: SchemaDecoder.number(),
  });

  protected override readonly inputDecoder = BeginDragCoreCommandBase.POINTER_PAYLOAD;

  protected override async execute(pointer: DragPointerPayload): Promise<void> {
    const sessionService = this.getDragSessionService();
    const runtime = sessionService.getRuntime();
    if (!runtime) return;
    if (sessionService.getActive()) return;

    const source = await this.pickDragSource({ pointer, runtime });
    if (!source) return;

    const session = await this.createSession({ pointer, runtime, source });
    await this.beforeSessionActivated({ pointer, runtime, source, session });
    sessionService.setActive(session);
    await this.afterSessionActivated({ pointer, runtime, source, session });
  }

  protected abstract getDragSessionService(): DragCoreSessionAccessor<TRuntime, TSession>;

  protected abstract pickDragSource(params: {
    pointer: DragPointerPayload;
    runtime: TRuntime;
  }): Promise<TSource | undefined> | TSource | undefined;

  protected abstract createSession(params: {
    pointer: DragPointerPayload;
    runtime: TRuntime;
    source: TSource;
  }): Promise<TSession> | TSession;

  protected async beforeSessionActivated(_params: {
    pointer: DragPointerPayload;
    runtime: TRuntime;
    source: TSource;
    session: TSession;
  }): Promise<void> {}

  protected async afterSessionActivated(_params: {
    pointer: DragPointerPayload;
    runtime: TRuntime;
    source: TSource;
    session: TSession;
  }): Promise<void> {}
}
