import type { NodeBase } from '../layouts/NodeBase';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { DefaultEventNormalizer } from '../fsm/EventNormalizer';
import { SceneFSM } from '../fsm/SceneFSM';
import { SceneLayoutFactory } from '../layouts/scene/SceneLayoutFactory';

import { SceneServiceHost } from './SceneServiceHost';

import type { Scene, SceneContext } from './SceneManager';
import type { SceneRuntime } from './SceneRuntime';
import type { SceneServiceContext, SceneServiceTickContext } from './SceneService';
import type { FSMConfig } from '../fsm/types';
import type { SceneManagerRuntime } from '@engine/core';
import type { SceneConfig } from '@engine/core/SceneConfig';
import type { DiContainerInterface } from '@engine/di/types';
import type { SceneLayout } from '@engine/layouts';

/**
 * Base implementation of a scene that covers the most common lifecycle needs:
 * - optional assets preloading
 * - optional layout loading and attachment to the stage
 * - optional scene-level finite state machine (FSM) initialization
 * - per-frame updates delegated to the layout
 * - consistent cleanup on exit
 *
 * Extend this class and override the protected hooks (e.g. {@link create}) to build your scene.
 */
export class BaseScene implements Scene {
  /** Immutable scene configuration describing assets, layout and optional FSM. */
  protected readonly config: SceneConfig;
  /** Root container for the scene. Everything visual in the scene should be attached to this container. */
  private renderRoot: NodeBase | undefined;
  protected get root(): NodeBase {
    if (!this.renderRoot) throw new Error('Scene root is not initialized');
    return this.renderRoot;
  }
  /** Loaded and mounted layout instance; available after onEnter completes. */
  protected layout?: SceneLayout;
  /** Reference to the game engine; assigned on preload/onEnter. */
  private runtimeEngine: SceneManagerRuntime | undefined;
  protected get engine(): SceneManagerRuntime {
    if (!this.runtimeEngine) throw new Error('Scene engine is not initialized');
    return this.runtimeEngine;
  }
  protected set engine(value: SceneManagerRuntime) { this.runtimeEngine = value; }
  /** Optional finite state machine that drives scene logic. */
  protected fsm?: SceneFSM;
  /** Scene params supplied via SceneManager transition options. */
  protected params: Readonly<Record<string, unknown>> | undefined;
  /** Scene-local DI scope created on enter and disposed on exit. */
  protected sceneDi: DiContainerInterface | undefined;
  /** Optional scene service host initialized from scene config tokens. */
  protected serviceHost: SceneServiceHost | undefined;
  private sceneDiDisposed = false;
  private lifecycleDebugStage = 'idle';

  /**
   * Creates a new BaseScene with a provided configuration.
   * @param config Scene configuration that defines assets, layout and optional FSM.
   */
  constructor(config: SceneConfig) {
    this.config = config;
  }

  /**
   * Optional preload step. Loads asset bundles and individual asset ids if provided in config.
   * Runs before onEnter. Override only if you need custom preload logic in addition to the default.
   */
  async preload({ engine }: SceneContext): Promise<void> {
    this.lifecycleDebugStage = 'preload:load-assets';
    this.engine = engine;
    const bundles = this.config.assets?.bundles ?? [];
    const ids = this.config.assets?.ids ?? [];
    // Load asset bundles sequentially to keep memory/ordering predictable.
    if (bundles.length > 0) {
      for (const b of bundles) await engine.assets.loadRequiredBundle(b);
    }
    // Load standalone assets if defined.
    if (ids.length > 0) await engine.assets.load(ids);
    this.lifecycleDebugStage = 'preload:completed';
  }

  /**
   * Mandatory enter step. Attaches the scene root to the stage, loads the layout if defined,
   * initializes FSM when configured and finally calls the {@link create} hook.
   */
  async onEnter({ engine, params }: SceneContext): Promise<void> {
    this.lifecycleDebugStage = 'onEnter:init-scene-di';
    this.engine = engine;
    this.params = params;
    this.initSceneDi();
    this.lifecycleDebugStage = 'onEnter:attach-root';
    this.renderRoot = engine.rendering.createRoot();
    engine.getSceneRenderRoot().attach(this.root);
    if (this.config.layout) {
      // Normalize layout config: allow passing a string name or a full object.
      const layoutCfg =
        typeof this.config.layout === 'string' ? { name: this.config.layout } : this.config.layout;
      const { name, components, actions } = layoutCfg;
      const layoutBuildOptions = {
        ...(components ? { components } : {}),
        ...(actions ? { actions } : {}),
        screen: engine.screen,
      };
      // Load layout and pass the whole ScreenManager so responsive rules can use real screen data.
      this.lifecycleDebugStage = 'onEnter:load-layout';
      this.layout = await SceneLayoutFactory.load(engine, name, layoutBuildOptions);
      if (this.disposal) { await this.layout.destroy(); throw new Error('Scene expired during layout loading'); }
      // Attach layout's root display object to the scene root container.
      this.lifecycleDebugStage = 'onEnter:attach-layout';
      this.root.attach(this.layout.root);
      engine.rendering.prepareScene(this.layout, this.config.render?.camera);
      engine.setActiveLayout(this.layout);
      engine.setActiveSceneDi(this.sceneDi);
      this.lifecycleDebugStage = 'onEnter:bootstrap-scene-configs';
      await engine.bootstrapSceneConfigs(this.config.key);
      if (this.disposal) throw new Error('Scene expired during config loading');
      this.lifecycleDebugStage = 'onEnter:init-scene-services';
      await this.initSceneServices(this.layout);
      if (this.disposal) throw new Error('Scene expired during service initialization');
      this.lifecycleDebugStage = 'onEnter:activate-layout';
      this.layout.activate();

      this.lifecycleDebugStage = 'onEnter:warmup-renderer';
      await engine.rendering.warmupScene?.();
      if (this.disposal) throw new Error('Scene expired during renderer warmup');

      // Initialize scene FSM if provided in config. FSM can react to events, commands and layout.
      const fsmCfg = this.config.fsm as FSMConfig | undefined;
      if (fsmCfg) {
        this.lifecycleDebugStage = 'onEnter:init-fsm';
        this.fsm = new SceneFSM(
          fsmCfg,
          { engine: this.engine, layout: this.layout, bus: this.engine.commands },
          new DefaultEventNormalizer(),
        );
        this.engine.setActiveSceneFSM(this.fsm);
        // Start FSM once everything visual is ready.
        this.lifecycleDebugStage = 'onEnter:start-fsm';
        await this.fsm.start();
      }
      // Allow subclasses to build their scene once layout and FSM (if any) are ready.
      this.lifecycleDebugStage = 'onEnter:create';
      await this.create();
    }
    this.lifecycleDebugStage = 'onEnter:completed';
  }

  /**
   * Per-frame update hook. Delegates time delta to the layout pipeline if present.
   * @param dt Delta time in seconds since the previous frame.
   */
  update(dt: number): void {
    this.engine.runtimeScheduler.tick(dt, {
      engine: this.engine,
      activeScene: this.engine.scenes.activeScene,
    });
  }

  /**
   * Leave step. Disposes layout, destroys display tree under this scene and evicts assets.
   * Use this to release resources to keep memory usage stable.
   */
  private disposal: Promise<void> | undefined;
  onExit(ctx: SceneContext): Promise<void> {
    this.disposal ??= this.disposeScene(ctx); return this.disposal;
  }
  private async disposeScene({engine}: SceneContext): Promise<void> {
    const layout = this.layout;
    const fsm = this.fsm;
    const sceneDi = this.sceneDi;
    const host = this.serviceHost;
    const root = this.renderRoot;
    const errors: unknown[] = [];
    const operations = [
      () => fsm?.deactivate(),
      async () => { if (layout && sceneDi && host) await host.dispose(this.createSceneServiceContext(layout)); },
      () => { if (layout) engine.rendering.cleanup(layout.root); },
      () => layout?.destroy(), () => root?.destroy(),
      () => engine.clearActiveLayout(layout), () => engine.clearActiveSceneFSM(fsm),
      () => this.disposeSceneDi(), () => engine.clearActiveSceneDi(sceneDi),
    ];
    for (const operation of operations) { try { await operation(); } catch (error) { errors.push(error); } }
    this.serviceHost = undefined; this.renderRoot = undefined; this.params = undefined;
    this.lifecycleDebugStage = 'onExit:completed';
    if (errors.length) throw new AggregateError(errors, 'Scene disposal failed: ' + this.config.key);
  }
  resumeRendering(): void {
    if (this.layout) this.engine.rendering.prepareScene(this.layout, this.config.render?.camera);
  }

  /**
   * Hook for subclasses to create scene content after layout is ready.
   * Override in derived scenes; keep it async if you need to await operations.
   */
  protected async create(): Promise<void> {}

  /**
   * Optional per-frame hook executed before scene service ticking.
   * Override when scene-level orchestration must run ahead of service hooks.
   */
  protected beforeSceneServicesTick(_dt: number): void {}

  /**
   * Optional per-frame hook executed after scene service ticking.
   * Override when scene-level orchestration must run after service hooks.
   */
  protected afterSceneServicesTick(_dt: number): void {}

  /**
   * Returns the current layout instance if available.
   */
  getLayout(): SceneLayout | undefined {
    return this.layout;
  }
  /**
   * Returns the scene FSM if it was initialized.
   */
  getFSM(): SceneFSM | undefined {
    return this.fsm;
  }

  getSceneDi(): DiContainerInterface | undefined {
    return this.sceneDi;
  }

  getParams(): Readonly<Record<string, unknown>> | undefined {
    return this.params;
  }

  getLifecycleDebugDetails(): Readonly<Record<string, string>> | undefined {
    const layoutDetails = this.layout?.getLifecycleDebugDetails();
    const serviceHostDetails = this.serviceHost?.getLifecycleDebugDetails();
    const rendererWarmupStage = this.runtimeEngine?.rendering.getWarmupStage?.();
    return {
      sceneKey: this.config.key,
      sceneLifecycleStage: this.lifecycleDebugStage,
      ...(rendererWarmupStage ? { rendererWarmupStage } : {}),
      ...(layoutDetails ?? {}),
      ...(serviceHostDetails ?? {}),
    };
  }

  tickSceneServicesForRuntimeScheduler(dt: number): void {
    this.beforeSceneServicesTick(dt);
    this.tickSceneServicesByPhase(dt, 'scene');
    this.afterSceneServicesTick(dt);
  }

  tickPhysicsServicesForRuntimeScheduler(dt: number): void {
    this.tickSceneServicesByPhase(dt, 'physics');
  }

  protected get runtime(): SceneRuntime {
    return this.engine;
  }

  private initSceneDi(): void {
    if (this.sceneDi) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'Scene DI scope is already initialized',
        details: { method: 'BaseScene.initSceneDi', sceneKey: this.config.key },
      });
    }
    if (this.sceneDiDisposed) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'Disposed scene DI scope cannot be re-initialized',
        details: { method: 'BaseScene.initSceneDi', sceneKey: this.config.key },
      });
    }
    this.sceneDi = this.engine.di.createScope();
    this.registerSceneProviders(this.sceneDi);
    this.sceneDiDisposed = false;
  }

  private disposeSceneDi(): void {
    if (!this.sceneDi) {
      if (this.sceneDiDisposed) {
        throw EngineErrorFactory.invariant({
          code: EngineErrorCode.SceneInvalidState,
          subsystem: EngineSubsystem.Scene,
          message: 'Scene DI scope is already disposed',
          details: { method: 'BaseScene.disposeSceneDi', sceneKey: this.config.key },
        });
      }
      return;
    }
    this.sceneDi = undefined;
    this.sceneDiDisposed = true;
  }

  private async initSceneServices(layout: SceneLayout): Promise<void> {
    const sceneDi = this.sceneDi;
    const serviceTokens = this.resolveSceneServiceTokens();
    if (serviceTokens.length === 0) {
      this.serviceHost = undefined;
      return;
    }
    if (!sceneDi) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'Scene DI scope is missing for service initialization',
        details: { method: 'BaseScene.initSceneServices', sceneKey: this.config.key },
      });
    }
    const host = new SceneServiceHost(this.config.key, serviceTokens, sceneDi);
    this.serviceHost = host;
    await host.init(this.createSceneServiceContext(layout));
  }

  private createSceneServiceContext(layout: SceneLayout): SceneServiceContext {
    if (!this.sceneDi) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.SceneInvalidState,
        subsystem: EngineSubsystem.Scene,
        message: 'Scene DI scope is missing for scene service context',
        details: { method: 'BaseScene.createSceneServiceContext', sceneKey: this.config.key },
      });
    }
    return {
      sceneKey: this.config.key,
      engine: this.runtime,
      layout,
      sceneDi: this.sceneDi,
    };
  }

  private registerSceneProviders(sceneDi: DiContainerInterface): void {
    const providers = this.engine.getSceneScopedProviders(this.config.key);
    for (const provider of providers) {
      sceneDi.register({
        ...provider,
        source: provider.source ?? 'scene',
      });
    }
  }

  private resolveSceneServiceTokens() {
    return this.engine.getSceneScopedServiceTokens(this.config.key);
  }

  private tickSceneServicesByPhase(dt: number, phase: 'scene' | 'physics'): void {
    if (!this.layout || !this.sceneDi || !this.serviceHost) {
      return;
    }
    const tickCtx: SceneServiceTickContext = {
      ...this.createSceneServiceContext(this.layout),
      dt,
    };
    if (phase === 'scene') {
      this.serviceHost.tickScenePhase(tickCtx);
      return;
    }
    this.serviceHost.tickPhysicsPhase(tickCtx);
  }
}
