import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { SceneServiceTickPhaseResolver } from './SceneService';

import type {
  SceneService,
  SceneServiceContext,
  SceneServiceTickContext,
  SceneServiceTickPhase,
} from './SceneService';
import type { DiContainerInterface, Token } from '@engine/di/types';

type HostState = 'idle' | 'running' | 'disposed';

interface ResolvedSceneService {
  token: Token<SceneService>;
  service: SceneService;
}

export class SceneServiceHost {
  private readonly resolved: ResolvedSceneService[] = [];
  private state: HostState = 'idle';
  private lifecycleHook: 'onSceneEnter' | 'onSceneExit' | undefined;
  private lifecycleToken: string | undefined;

  constructor(
    private readonly sceneKey: string,
    private readonly tokens: readonly Token<SceneService>[],
    private readonly sceneDi: DiContainerInterface,
  ) {}

  async init(ctx: SceneServiceContext): Promise<void> {
    if (this.state !== 'idle') {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'SceneServiceHost cannot be initialized from current state',
        details: { method: 'SceneServiceHost.init', sceneKey: this.sceneKey, state: this.state },
      });
    }

    this.resolveServices();
    for (const entry of this.resolved) {
      if (!entry.service.onSceneEnter) continue;
      try {
        this.setLifecycleDebugState(entry.token, 'onSceneEnter');
        await entry.service.onSceneEnter(ctx);
      } catch (cause) {
        throw this.createLifecycleError(entry.token, 'onSceneEnter', cause);
      } finally {
        this.clearLifecycleDebugState();
      }
    }
    this.state = 'running';
  }

  tick(ctx: SceneServiceTickContext): void {
    this.assertTickAllowed('tick');
    if (this.state !== 'running') {
      return;
    }
    for (const entry of this.resolved) {
      if (!entry.service.onSceneTick) continue;
      entry.service.onSceneTick(ctx);
    }
  }

  tickScenePhase(ctx: SceneServiceTickContext): void {
    this.tickByPhase(ctx, 'scene');
  }

  tickPhysicsPhase(ctx: SceneServiceTickContext): void {
    this.tickByPhase(ctx, 'physics');
  }

  private tickByPhase(ctx: SceneServiceTickContext, phase: SceneServiceTickPhase): void {
    this.assertTickAllowed('tickByPhase');
    if (this.state !== 'running') {
      return;
    }
    for (const entry of this.resolved) {
      if (SceneServiceTickPhaseResolver.resolve(entry.service) !== phase) continue;
      if (!entry.service.onSceneTick) continue;
      entry.service.onSceneTick(ctx);
    }
  }

  private assertTickAllowed(method: 'tick' | 'tickByPhase'): void {
    if (this.state !== 'disposed') {
      return;
    }
    throw EngineErrorFactory.invariant({
      code: EngineErrorCode.SceneInvalidState,
      subsystem: EngineSubsystem.Scene,
      message: 'SceneServiceHost is disposed',
      details: { method: `SceneServiceHost.${method}`, sceneKey: this.sceneKey },
    });
  }

  async dispose(ctx: SceneServiceContext): Promise<void> {
    if (this.state === 'disposed') {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'SceneServiceHost is already disposed',
        details: { method: 'SceneServiceHost.dispose', sceneKey: this.sceneKey },
      });
    }
    if (this.state === 'idle') {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'SceneServiceHost is not initialized',
        details: { method: 'SceneServiceHost.dispose', sceneKey: this.sceneKey },
      });
    }

    let firstError: Error | undefined;
    for (let i = this.resolved.length - 1; i >= 0; i -= 1) {
      const entry = this.resolved[i];
      if (!entry) continue;
      if (!entry.service.onSceneExit) continue;
      try {
        this.setLifecycleDebugState(entry.token, 'onSceneExit');
        await entry.service.onSceneExit(ctx);
      } catch (cause) {
        if (!firstError) {
          firstError = this.createLifecycleError(entry.token, 'onSceneExit', cause);
        }
      } finally {
        this.clearLifecycleDebugState();
      }
    }
    this.state = 'disposed';
    if (firstError) {
      throw firstError;
    }
  }

  private resolveServices(): void {
    this.resolved.length = 0;
    for (const token of this.tokens) {
      const service = this.sceneDi.get<SceneService>(token);
      this.resolved.push({ token, service });
    }
  }

  private createLifecycleError(
    token: Token<SceneService>,
    hook: 'onSceneEnter' | 'onSceneExit',
    cause: unknown,
  ): Error {
    return EngineErrorFactory.create({
      code: EngineErrorCode.SceneLifecycleFailure,
      subsystem: EngineSubsystem.Scene,
      message: `Scene service lifecycle hook failed (${hook})`,
      details: {
        method: `SceneServiceHost.${hook}`,
        sceneKey: this.sceneKey,
        token: this.tokenToDebugString(token),
      },
      cause,
    });
  }

  private tokenToDebugString(token: Token<SceneService>): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return String(token);
    if (typeof token === 'function') return token.name || '[anonymous-constructor]';
    return token.key;
  }

  getLifecycleDebugDetails(): Readonly<Record<string, string>> | undefined {
    if (this.lifecycleHook === undefined || this.lifecycleToken === undefined) {
      return undefined;
    }
    return {
      sceneServiceHook: this.lifecycleHook,
      sceneServiceToken: this.lifecycleToken,
    };
  }

  private setLifecycleDebugState(
    token: Token<SceneService>,
    hook: 'onSceneEnter' | 'onSceneExit',
  ): void {
    this.lifecycleHook = hook;
    this.lifecycleToken = this.tokenToDebugString(token);
  }

  private clearLifecycleDebugState(): void {
    this.lifecycleHook = undefined;
    this.lifecycleToken = undefined;
  }
}
