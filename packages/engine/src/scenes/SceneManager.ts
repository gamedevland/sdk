import { EngineError, EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SceneHookDeadline } from './SceneHookDeadline';

import type { SceneManagerRuntime } from '@engine/core';
import type { DiContainerInterface } from '@engine/di/types';
import type { SceneFSM } from '@engine/fsm/SceneFSM';
import type { SceneLayout } from '@engine/layouts';


export type SceneTransitionOperation = 'replace' | 'push' | 'pop';
export type SceneTransitionPhase =
  | 'idle'
  | 'exiting'
  | 'preloading'
  | 'entering'
  | 'committing'
  | 'failed';

type SceneLifecyclePhase = Exclude<SceneTransitionPhase, 'idle' | 'failed' | 'committing'>;
type SceneFailurePhase = Exclude<SceneTransitionPhase, 'idle'>;

export interface SceneContext {
  engine: SceneManagerRuntime;
  params?: Record<string, unknown>;
}

export interface Scene {
  resumeRendering?(): void;
  /**
   * Optional hook called before {@link onEnter}. Use it to preload assets or perform async setup.
   */
  preload?(ctx: SceneContext): Promise<void> | void;
  /**
   * Required hook called when a scene becomes active. Attach display objects and set up logic here.
   */
  onEnter(ctx: SceneContext): Promise<void> | void;
  /**
   * Optional per-frame update in seconds. Called only for the top-most, non-paused scene.
   */
  update?(dt: number): void;
  /**
   * Required hook called when a scene is removed or replaced. Clean up resources here.
   */
  onExit(ctx: SceneContext): Promise<void> | void;
  /**
   * Optional getter for the currently bound scene layout.
   * Used by engine subsystems without reaching into scene internals.
   */
  getLayout?(): SceneLayout | undefined;
  /**
   * Optional getter for the scene FSM.
   * Used by engine event routing.
   */
  getFSM?(): SceneFSM | undefined;
  /**
   * Optional getter for the scene-local DI scope.
   * Used by engine internals for deterministic cleanup.
   */
  getSceneDi?(): DiContainerInterface | undefined;
  /**
   * Optional getter for scene params passed on start/replace/push.
   */
  getParams?(): Readonly<Record<string, unknown>> | undefined;
  /**
   * Optional lifecycle debug details used to enrich timeout/failure diagnostics.
   */
  getLifecycleDebugDetails?(): Readonly<Record<string, string>> | undefined;
}

export interface SceneTransitionOptions {
  params?: Record<string, unknown>;
}

export interface SceneManagerOptions {
  /** Visible-page time budget per lifecycle hook. Defaults to 10000ms. */
  transitionTimeoutMs?: number;
}

interface StackEntry {
  scene: Scene;
  ctx: SceneContext;
  paused: boolean;
}

interface SceneLifecycleHookContext {
  readonly operation: SceneTransitionOperation;
  readonly phase: SceneLifecyclePhase;
  readonly sceneName: string;
}

interface DeferredSceneTransition {
  readonly operation: SceneTransitionOperation;
  readonly action: () => Promise<void>;
  readonly requestedDuring: SceneLifecycleHookContext;
}

const DEFAULT_TRANSITION_TIMEOUT_MS = 10000;

export class SceneManager {
  private readonly engine: SceneManagerRuntime;
  private readonly stack: StackEntry[] = [];
  /**
   * The scene that is "current" from the engine's perspective: set to the incoming scene
   * at the very start of {@link runEnter} so that event routing (FSM, params) targets the
   * right scene even before it is committed to the stack. Synced back to the stack top
   * on commit or on entry failure.
   */
  private currentScene: Scene | null = null;
  private currentSceneScopeVersion = 0;
  private transitionTimeoutMs: number;
  private transitionQueue: Promise<void> = Promise.resolve();
  private readonly deferredLifecycleTransitions: DeferredSceneTransition[] = [];
  private readonly lifecycleHookStack: SceneLifecycleHookContext[] = [];
  private transitionState: SceneTransitionPhase = 'idle';
  private flushingDeferredLifecycleTransitions = false;
  private tickerAttached = false;
  private destroyed = false;
  private runtimePaused = false;
  private lastTickTime = 0;
  /** Cached bound ticker callback so we can remove it deterministically. */
  private tickerBound = (dt: number) => this.onTick(dt);
  private unsubscribeTick: (() => void) | undefined;

  constructor(engine: SceneManagerRuntime, options?: SceneManagerOptions) {
    this.engine = engine;
    this.transitionTimeoutMs = options?.transitionTimeoutMs ?? DEFAULT_TRANSITION_TIMEOUT_MS;
  }

  setTransitionTimeoutMs(timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.SceneInvalidArgument,
        subsystem: EngineSubsystem.Scene,
        message: 'Scene transition timeout must be a positive number',
        details: { method: 'SceneManager.setTransitionTimeoutMs', timeoutMs: String(timeoutMs) },
      });
    }
    this.transitionTimeoutMs = timeoutMs;
  }

  /** Returns the currently active (top) scene or null if the stack is empty. */
  get activeScene(): Scene | null {
    const top = this.top();
    return top ? top.scene : null;
  }

  getActiveSceneLayout(): SceneLayout | undefined {
    return this.activeScene?.getLayout?.();
  }

  getCurrentSceneFSM(): SceneFSM | undefined {
    return this.currentScene?.getFSM?.();
  }

  getCurrentSceneParams(): Readonly<Record<string, unknown>> | undefined {
    return this.currentScene?.getParams?.();
  }

  getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  getCurrentSceneScopeVersion(): number {
    return this.currentSceneScopeVersion;
  }

  setRuntimePaused(paused: boolean): void {
    this.runtimePaused = paused;
    if (paused) {
      this.lastTickTime = 0;
    }
  }

  isRuntimePaused(): boolean {
    return this.runtimePaused;
  }

  /**
   * Starts (replaces with) a scene resolved by key from the configured scenes map.
   */
  start(sceneKey: string, options?: SceneTransitionOptions): Promise<void> {
    return this.scheduleTransition('replace', () => {
      const scene = this.engine.createSceneByKey(sceneKey);
      return this.runReplace(scene, options);
    });
  }

  /**
   * Replaces the current top scene with a new one.
   */
  replace(scene: Scene, options?: SceneTransitionOptions): Promise<void> {
    return this.scheduleTransition('replace', () => this.runReplace(scene, options));
  }

  /**
   * Pushes a new scene on top of the stack, pausing the previous active scene (if any).
   */
  push(scene: Scene, options?: SceneTransitionOptions): Promise<void> {
    return this.scheduleTransition('push', () => this.runPush(scene, options));
  }

  /**
   * Pops the active scene from the stack and resumes the previous scene (if present).
   */
  pop(): Promise<void> {
    return this.scheduleTransition('pop', () => this.runPop());
  }

  private scheduleTransition(
    operation: SceneTransitionOperation,
    action: () => Promise<void>,
  ): Promise<void> {
    const lifecycleHookContext = this.getActiveLifecycleHookContext();
    if (lifecycleHookContext !== undefined) {
      this.deferredLifecycleTransitions.push({
        operation,
        action,
        requestedDuring: lifecycleHookContext,
      });
      return Promise.resolve();
    }

    return this.enqueueTransition(operation, action);
  }

  private enqueueTransition(
    operation: SceneTransitionOperation,
    action: () => Promise<void>,
  ): Promise<void> {
    const execute = async (): Promise<void> => {
      try {
        await this.runTransitionAction(operation, action);
        this.transitionState = 'idle';
        await this.flushDeferredLifecycleTransitions();
      } catch (error) {
        throw this.toTransitionError(operation, this.transitionState, error);
      }
    };

    const scheduled = this.transitionQueue.then(execute, execute);
    this.transitionQueue = scheduled.then(
      () => undefined,
      () => undefined,
    );

    return scheduled;
  }

  private async runTransitionAction(
    operation: SceneTransitionOperation,
    action: () => Promise<void>,
  ): Promise<void> {
    if (this.destroyed) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'SceneManager is destroyed',
        details: { method: 'SceneManager.runTransitionAction', operation },
      });
    }

    this.transitionState = 'idle';
    try {
      await action();
      this.transitionState = 'idle';
    } catch (error) {
      this.transitionState = 'failed';
      throw error;
    }
  }

  private async flushDeferredLifecycleTransitions(): Promise<void> {
    if (this.flushingDeferredLifecycleTransitions) {
      return;
    }

    this.flushingDeferredLifecycleTransitions = true;
    try {
      while (this.deferredLifecycleTransitions.length > 0) {
        const transition = this.deferredLifecycleTransitions.shift();
        if (transition === undefined) {
          continue;
        }

        try {
          await this.runTransitionAction(transition.operation, transition.action);
        } catch (error) {
          throw this.toTransitionError(
            transition.operation,
            this.transitionState,
            error,
            transition.requestedDuring,
          );
        }
      }
    } finally {
      this.flushingDeferredLifecycleTransitions = false;
    }
  }

  private async runReplace(scene: Scene, options?: SceneTransitionOptions): Promise<void> {
    const current = this.top();
    if (current) {
      this.transitionState = 'exiting';
      await this.runExit(current.scene, current.ctx, 'replace');
      this.cleanupEngineSceneRefs(current.scene);
      this.stack.pop();
      // No active scene between exit and enter — event routing is suspended.
      this.setCurrentScene(null);
    }

    const nextCtx = this.buildSceneContext(options);
    this.transitionState = 'preloading';
    await this.runPreload(scene, nextCtx, 'replace');

    this.transitionState = 'entering';
    await this.runEnter(scene, nextCtx, 'replace');

    this.transitionState = 'committing';
    this.stack.push({ scene, ctx: nextCtx, paused: false });
    this.ensureTickerAttached();
  }

  private async runPush(scene: Scene, options?: SceneTransitionOptions): Promise<void> {
    const previous = this.top();
    if (previous) previous.paused = true;

    try {
      const nextCtx = this.buildSceneContext(options);
      this.transitionState = 'preloading';
      await this.runPreload(scene, nextCtx, 'push');

      this.transitionState = 'entering';
      await this.runEnter(scene, nextCtx, 'push');

      this.transitionState = 'committing';
      this.stack.push({ scene, ctx: nextCtx, paused: false });
      this.ensureTickerAttached();
    } catch (error) {
      if (previous) previous.paused = false;
      throw error;
    }
  }

  private async runPop(): Promise<void> {
    const current = this.top();
    if (!current) return;

    this.transitionState = 'exiting';
    await this.runExit(current.scene, current.ctx, 'pop');
    this.cleanupEngineSceneRefs(current.scene);

    this.transitionState = 'committing';
    this.stack.pop();

    const next = this.top();
    this.setCurrentScene(next?.scene ?? null);
    if (next) {
      next.paused = false;
      this.restoreSceneBindings(next.scene);
    } else {
      this.detachTickerIfAttached();
      this.lastTickTime = 0;
    }
  }

  /** Runs scene preload if the scene implements it. */
  private async runPreload(
    scene: Scene,
    ctx: SceneContext,
    operation: SceneTransitionOperation,
  ): Promise<void> {
    if (typeof scene.preload !== 'function') return;
    await this.runHookWithTimeout({
      scene,
      operation,
      phase: 'preloading',
      timeoutMs: this.transitionTimeoutMs,
      hook: () => scene.preload!(ctx),
    });
  }

  /** Runs scene enter (required for all scenes). */
  private async runEnter(
    scene: Scene,
    ctx: SceneContext,
    operation: SceneTransitionOperation,
  ): Promise<void> {
    // Point currentScene at incoming scene immediately so that engine subsystems
    // (event bridge, DI) target the correct scene while onEnter initialises providers.
    this.setCurrentScene(scene);
    try {
      await this.runHookWithTimeout({
        scene,
        operation,
        phase: 'entering',
        timeoutMs: this.transitionTimeoutMs,
        hook: () => scene.onEnter(ctx),
      });
      this.runSchedulerSceneEnter(scene, operation);
      this.captureSchedulerSceneBaseline(scene, operation);
    } catch (error) {
      // Entry failed — revert to whatever is on the stack (may be null).
      const errors: unknown[] = [error];
      try {
        await this.runHookWithTimeout({scene, operation, phase: 'exiting', timeoutMs: this.transitionTimeoutMs, hook: () => scene.onExit(ctx)});
      } catch (cleanup) { errors.push(cleanup); }
      this.cleanupEngineSceneRefs(scene);
      const previous = this.top()?.scene;
      this.setCurrentScene(previous ?? null);
      if (previous) this.restoreSceneBindings(previous);
      if (errors.length > 1) throw new AggregateError(errors, 'Scene enter and rollback failed');
      throw error;
    }
    // On success currentScene stays as scene; commit will push it onto the stack.
  }

  /** Runs scene exit (required for all scenes). */
  private async runExit(
    scene: Scene,
    ctx: SceneContext,
    operation: SceneTransitionOperation,
  ): Promise<void> {
    this.invalidateCurrentSceneScope();
    this.runSchedulerSceneExit(scene, operation);
    await this.runHookWithTimeout({
      scene,
      operation,
      phase: 'exiting',
      timeoutMs: this.transitionTimeoutMs,
      hook: () => scene.onExit(ctx),
    });
    this.validateSchedulerSceneLeakState(scene, operation);
  }

  private async runHookWithTimeout(params: {
    scene: Scene;
    operation: SceneTransitionOperation;
    phase: SceneLifecyclePhase;
    timeoutMs: number;
    hook: () => Promise<void> | void;
  }): Promise<void> {
    const { scene, operation, phase, timeoutMs, hook } = params;

    this.lifecycleHookStack.push({
      operation,
      phase,
      sceneName: this.sceneName(scene),
    });
    try {
      await new SceneHookDeadline(timeoutMs).run(hook, () =>
        this.createSceneLifecycleEngineError({
          method: 'SceneManager.runHookWithTimeout', operation, phase, scene,
          message: `Scene lifecycle hook timeout (${timeoutMs}ms of visible time)`,
        }),
      );
    } catch (error) {
      if (this.isSceneLifecycleFailureError(error)) throw error;
      throw this.createSceneLifecycleEngineError({
        method: 'SceneManager.runHookWithTimeout',
        operation,
        phase,
        scene,
        message: 'Scene lifecycle hook failed',
        cause: error,
      });
    } finally {
      this.lifecycleHookStack.pop();
    }
  }

  private runSchedulerSceneEnter(scene: Scene, operation: SceneTransitionOperation): void {
    try {
      this.engine.runtimeScheduler.notifySceneEnter({ engine: this.engine, scene });
    } catch (cause) {
      throw this.createSceneLifecycleEngineError({
        method: 'SceneManager.runSchedulerSceneEnter',
        operation,
        phase: 'entering',
        scene,
        message: 'Runtime scheduler onSceneEnter hook failed',
        cause,
      });
    }
  }

  private captureSchedulerSceneBaseline(scene: Scene, operation: SceneTransitionOperation): void {
    try {
      this.engine.runtimeScheduler.captureSceneRegistrationBaseline(scene);
    } catch (cause) {
      throw this.createSceneLifecycleEngineError({
        method: 'SceneManager.captureSchedulerSceneBaseline',
        operation,
        phase: 'entering',
        scene,
        message: 'Runtime scheduler baseline capture failed',
        cause,
      });
    }
  }

  private runSchedulerSceneExit(scene: Scene, operation: SceneTransitionOperation): void {
    try {
      this.engine.runtimeScheduler.notifySceneExit({ engine: this.engine, scene });
    } catch (cause) {
      throw this.createSceneLifecycleEngineError({
        method: 'SceneManager.runSchedulerSceneExit',
        operation,
        phase: 'exiting',
        scene,
        message: 'Runtime scheduler onSceneExit hook failed',
        cause,
      });
    }
  }

  private validateSchedulerSceneLeakState(scene: Scene, operation: SceneTransitionOperation): void {
    try {
      this.engine.runtimeScheduler.assertSceneRegistrationClean(scene);
    } catch (cause) {
      throw this.createSceneLifecycleEngineError({
        method: 'SceneManager.validateSchedulerSceneLeakState',
        operation,
        phase: 'exiting',
        scene,
        message: 'Runtime scheduler leaked registration diagnostics failed',
        cause,
      });
    }
  }

  private createSceneLifecycleEngineError(params: {
    method: string;
    operation: SceneTransitionOperation;
    phase: SceneFailurePhase;
    scene: Scene;
    message: string;
    cause?: unknown;
  }): EngineError {
    const sceneName = this.sceneName(params.scene);
    const causeDetails = this.describeCauseDetails(params.cause);
    return EngineErrorFactory.create({
      code: EngineErrorCode.SceneLifecycleFailure,
      subsystem: EngineSubsystem.Scene,
      message: params.message,
      details: {
        method: params.method,
        operation: params.operation,
        phase: params.phase,
        scene: sceneName,
        ...(causeDetails.causeName === undefined ? {} : { causeName: causeDetails.causeName }),
        ...(causeDetails.causeMessage === undefined
          ? {}
          : { causeMessage: causeDetails.causeMessage }),
        ...(params.scene.getLifecycleDebugDetails?.() ?? {}),
      },
      cause: params.cause,
    });
  }

  private toTransitionError(
    operation: SceneTransitionOperation,
    phase: SceneTransitionPhase,
    error: unknown,
    requestedDuring?: SceneLifecycleHookContext,
  ): EngineError {
    if (this.isSceneLifecycleFailureError(error)) return error;
    const safePhase: SceneFailurePhase = phase === 'idle' ? 'failed' : phase;
    const causeDetails = this.describeCauseDetails(error);
    return EngineErrorFactory.create({
      code: EngineErrorCode.SceneLifecycleFailure,
      subsystem: EngineSubsystem.Scene,
      message: 'Scene transition failed',
      details: {
        method: 'SceneManager.enqueueTransition',
        operation,
        phase: safePhase,
        ...(requestedDuring === undefined
          ? {}
          : {
              deferredFromOperation: requestedDuring.operation,
              deferredFromPhase: requestedDuring.phase,
              deferredFromScene: requestedDuring.sceneName,
            }),
        ...(causeDetails.causeName === undefined ? {} : { causeName: causeDetails.causeName }),
        ...(causeDetails.causeMessage === undefined
          ? {}
          : { causeMessage: causeDetails.causeMessage }),
      },
      cause: error,
    });
  }

  private isSceneLifecycleFailureError(error: unknown): error is EngineError {
    return error instanceof EngineError && error.code === EngineErrorCode.SceneLifecycleFailure;
  }

  private restoreSceneBindings(scene: Scene): void {
    this.engine.setActiveLayout(scene.getLayout?.());
    this.engine.setActiveSceneFSM(scene.getFSM?.());
    this.engine.setActiveSceneDi(scene.getSceneDi?.());
    scene.resumeRendering?.();
  }

  private cleanupEngineSceneRefs(scene: Scene): void {
    this.engine.clearActiveLayout(scene.getLayout?.());
    this.engine.clearActiveSceneFSM(scene.getFSM?.());
    this.engine.clearActiveSceneDi(scene.getSceneDi?.());
  }

  private buildSceneContext(options?: SceneTransitionOptions): SceneContext {
    return options?.params
      ? { engine: this.engine, params: options.params }
      : { engine: this.engine };
  }

  private top(): StackEntry | undefined {
    return this.stack[this.stack.length - 1];
  }

  private getActiveLifecycleHookContext(): SceneLifecycleHookContext | undefined {
    return this.lifecycleHookStack[this.lifecycleHookStack.length - 1];
  }

  private invalidateCurrentSceneScope(): void {
    this.currentSceneScopeVersion += 1;
  }

  private setCurrentScene(scene: Scene | null): void {
    if (this.currentScene === scene) {
      return;
    }
    this.currentScene = scene;
    this.currentSceneScopeVersion += 1;
  }

  private sceneName(scene: Scene): string {
    const ctor = (scene as { constructor?: { name?: string } }).constructor;
    return ctor?.name && ctor.name.length > 0 ? ctor.name : '[anonymous-scene]';
  }

  private describeCauseDetails(cause: unknown): {
    readonly causeName?: string;
    readonly causeMessage?: string;
  } {
    if (cause instanceof Error) {
      return {
        causeName: cause.name,
        causeMessage: cause.message,
      };
    }
    if (typeof cause === 'string' && cause.length > 0) {
      return {
        causeMessage: cause,
      };
    }
    return {};
  }

  private ensureTickerAttached(): void {
    if (this.tickerAttached) return;
    this.unsubscribeTick = this.engine.frames.subscribe(this.tickerBound);
    this.tickerAttached = true;
  }

  private detachTickerIfAttached(): void {
    if (!this.tickerAttached) return;
    this.unsubscribeTick?.();
    this.unsubscribeTick = undefined;
    this.tickerAttached = false;
  }

  /**
   * Pixi ticker callback. Computes delta time (in seconds) and forwards it to the active scene's
   * update hook. Only the top-most, non-paused scene receives updates.
   */
  private onTick(deltaFrames: number): void {
    const top = this.top();
    if (!top || top.paused || this.runtimePaused || this.isTransitionBusy()) {
      this.lastTickTime = 0;
      return;
    }
    const now = performance.now();
    const dtMs = Math.min(deltaFrames * 1000, 100);
    this.lastTickTime = now;
    if (typeof top.scene.update === 'function') {
      top.scene.update(dtMs / 1000);
    }
  }

  private isTransitionBusy(): boolean {
    return (
      this.transitionState === 'exiting' ||
      this.transitionState === 'preloading' ||
      this.transitionState === 'entering' ||
      this.transitionState === 'committing'
    );
  }

  /**
   * Waits for queued transitions, then detaches ticker and blocks further transitions.
   */
  async destroy(): Promise<void> {
    this.destroyed = true;
    await this.transitionQueue;
    this.detachTickerIfAttached();
    const errors: unknown[] = [];
    while (this.stack.length) {
      const entry = this.stack.pop();
      if (!entry) break;
      try { await this.runExit(entry.scene, entry.ctx, 'pop'); } catch (error) { errors.push(error); }
      this.cleanupEngineSceneRefs(entry.scene);
    }
    this.setCurrentScene(null);
    if (errors.length) throw new AggregateError(errors, 'Scene disposal failed');
  }
}

export default SceneManager;
