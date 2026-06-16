import type { SceneService, SceneServiceContext } from '@engine/scenes';

export interface DragCoreSessionAccessor<TRuntime, TSession> {
  getRuntime(): TRuntime | undefined;
  getActive(): TSession | undefined;
  setActive(session: TSession): void;
  clearActive(expected?: TSession): void;
}

export class DragCoreSessionService<TRuntime, TSession> implements SceneService {
  private runtime: TRuntime | undefined;
  private active: TSession | undefined;

  setRuntime(runtime: TRuntime): void {
    this.runtime = runtime;
  }

  clearRuntime(): void {
    this.runtime = undefined;
  }

  getRuntime(): TRuntime | undefined {
    return this.runtime;
  }

  getActive(): TSession | undefined {
    return this.active;
  }

  setActive(session: TSession): void {
    if (this.active) {
      throw new Error('DragCoreSessionService.setActive: session is already active');
    }
    this.active = session;
  }

  clearActive(expected?: TSession): void {
    if (!expected) {
      this.active = undefined;
      return;
    }
    if (this.active === expected) {
      this.active = undefined;
    }
  }

  onSceneExit(_ctx: SceneServiceContext): void {
    this.active = undefined;
    this.runtime = undefined;
  }
}
