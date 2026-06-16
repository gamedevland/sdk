import { EndDragCoreCommandBase } from './EndDragCoreCommandBase';

export abstract class PointerOwnedEndDragCoreCommandBase<
  TRuntime,
  TSession extends { readonly pointerId: number },
> extends EndDragCoreCommandBase<TRuntime, TSession> {
  protected override isOwnedByPointer(session: TSession, pointerId: number): boolean {
    return session.pointerId === pointerId;
  }
}
