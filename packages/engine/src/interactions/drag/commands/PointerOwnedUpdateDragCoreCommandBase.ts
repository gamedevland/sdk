import { UpdateDragCoreCommandBase } from './UpdateDragCoreCommandBase';

export abstract class PointerOwnedUpdateDragCoreCommandBase<
  TRuntime,
  TSession extends { readonly pointerId: number },
> extends UpdateDragCoreCommandBase<TRuntime, TSession> {
  protected override isOwnedByPointer(session: TSession, pointerId: number): boolean {
    return session.pointerId === pointerId;
  }
}
