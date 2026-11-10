import { DiBootstrapValidator } from '@engine/di/DiBootstrapValidator';
import { SystemProviderRegistrar } from '@engine/di/providers';
import { PresentationScheduler } from '../runtime/PresentationScheduler';
import type { RuntimeDiagnostics } from '../diagnostics';
import { FrameDriver } from '../rendering/FrameDriver';
import type { RenderRuntime } from '../rendering/types';
import type { NodeBase } from '../layouts/NodeBase';

import { PersistentStorageCoordinator, PersistentStorageAdapter } from '../configs';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '../errors';
import { BaseScene } from '../scenes/BaseScene';

import { AssetBundlesBootTask } from './boot/AssetBundlesBootTask';
import { ConfigBootstrapBootTask } from './boot/ConfigBootstrapBootTask';
import { ConfigBootstrapper } from './boot/ConfigBootstrapper';
import { EngineBootConfigPlan } from './boot/EngineBootConfigPlan';
import { EngineBootPipeline } from './boot/EngineBootPipeline';
import { LocalesBootstrapBootTask } from './boot/LocalesBootstrapBootTask';
import { PersistenceBootstrapBootTask } from './boot/PersistenceBootstrapBootTask';
import { EngineConfigInvariantValidator } from './EngineConfigInvariantValidator';
import { EngineEventBridge } from './EngineEventBridge';
import { EngineLifecycleManager } from './EngineLifecycleManager';
import { EngineRuntimeBindings } from './EngineRuntimeBindings';
import { EngineSubsystemFactory } from './EngineSubsystemFactory';
import { AdBreakRuntimePolicy } from './runtime/AdBreakRuntimePolicy';
import { EnginePauseController } from './runtime/EnginePauseController';
import { RuntimeActivity } from './runtime/RuntimeActivity';

import type { AssetManager } from '../assets';
import type { AudioManager } from '../audio';
import type { EngineOptions } from './EngineOptions';
import type { SceneConfig } from './SceneConfig';
import type { ConfigStore, LocalesService } from '../configs';
import type { GameConfig } from './GameConfig';
import type {
  CommandRuntime,
  InputRuntime,
  LayoutRuntime,
  PhysicsRuntime,
  PrefabRuntime,
  SceneManagerRuntime,
} from './ports';
import type { CommandBus } from '../commands/CommandBus';
import type { EventBus } from '../events/EventBus';
import type { SceneFSM } from '../fsm/SceneFSM';
import type { BrowserInputGuard } from '../input/BrowserInputGuard';
import type { InputChannel } from '../input/InputChannel';
import type { InputManager } from '../input/InputManager';
import type { SceneLayout } from '../layouts/scene/SceneLayout';
import type { PlatformManager } from '../platforms';
import type { PrefabManager } from '../prefabs';
import type { RuntimePhysicsStepPort } from '../runtime/RuntimePhysicsStepService';
import type { RuntimeScheduler } from '../runtime/RuntimeScheduler';
import type SceneManager from '../scenes/SceneManager';
import type { Scene } from '../scenes/SceneManager';
import type { ScreenManager } from '../screen/ScreenManager';
import type { GsapTweenManager } from '../tween/GsapTweenManager';
import type { DiContainer } from '@engine/di/DiContainer';
import type { EngineDi } from '@engine/di/EngineDi';
import type { SceneDiEntry } from '@engine/di/SceneDiConfig';
import type { DiContainerInterface, Provider, Token } from '@engine/di/types';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';
import type { SceneService } from '@engine/scenes/SceneService';

export type { EngineOptions } from './EngineOptions';

/**
 * Main runtime orchestrator of the game engine.
 * @description
 * Coordinates subsystems: assets, events, commands, input, screen/scaling,
 * tweens, scene management, and dependency injection. Typical lifecycle:
 * - construct Engine(options)
 * - await init()
 * - mount(container)
 * - await start(gameConfig)
 */
export class Engine
  implements
    SceneRuntime,
    CommandRuntime,
    InputRuntime,
    SceneManagerRuntime,
    PrefabRuntime,
    LayoutRuntime,
    PhysicsRuntime
{
  private static readonly RuntimePausedChangedEvent = 'ENGINE__RUNTIME_PAUSED_CHANGED';
  private static readonly EmptySceneParams: Readonly<Record<string, unknown>> = Object.freeze({});
  readonly rendering: RenderRuntime;
  readonly diagnostics: RuntimeDiagnostics;
  readonly presentation = new PresentationScheduler();
  readonly frames: FrameDriver;
  readonly audio: AudioManager;
  readonly assets: AssetManager;
  readonly scenes: SceneManager;
  readonly commands: CommandBus;
  readonly events: EventBus;
  readonly screen: ScreenManager;
  readonly tweens: GsapTweenManager;
  readonly input: InputManager;
  readonly inputChannel: InputChannel;
  readonly browserInputGuard: BrowserInputGuard;
  readonly prefabs: PrefabManager;
  readonly platform: PlatformManager;
  readonly di: EngineDi;
  readonly runtimeScheduler: RuntimeScheduler;
  readonly runtimePhysicsStepService: RuntimePhysicsStepPort;
  readonly config: { data?: Record<string, unknown>; layouts?: GameConfig['layouts'] } = {};
  readonly configStore: ConfigStore;
  private readonly localesService: LocalesService;
  private readonly persistenceCoordinator = new PersistentStorageCoordinator();
  readonly storage = new PersistentStorageAdapter(this.persistenceCoordinator);
  private readonly diContainer: DiContainer;
  private readonly diBootstrapValidator = new DiBootstrapValidator();
  private readonly configInvariantValidator = new EngineConfigInvariantValidator();
  private readonly configBootstrapper: ConfigBootstrapper;
  private readonly runtimeBindings: EngineRuntimeBindings;
  private readonly eventBridge: EngineEventBridge;
  private bootConfigPlan: EngineBootConfigPlan | undefined;
  private sceneConfigMap: Readonly<Record<string, SceneConfig>> = {};
  private sceneScopedDiEntries: Readonly<Record<string, SceneDiEntry>> = {};
  private readonly runtimeController: EnginePauseController;
  private readonly lifecycleManager: EngineLifecycleManager;

  private readonly moduleDisposers: readonly (() => void)[];
  private disposal: Promise<void> | undefined;
  destroy(): Promise<void> {
    this.disposal ??= this.dispose();
    return this.disposal;
  }
  private async dispose(): Promise<void> {
    this.frames.stop();
    await this.lifecycleManager.dispose();
    this.frames.stop();
    const errors: unknown[] = [];
    const operations = [
      () => this.input.destroy(),
      () => this.browserInputGuard.dispose(),
      () => this.runtimeController.dispose(),
      () => this.eventBridge.dispose(),
      () => this.scenes.destroy(),
      () => this.rendering.root.destroy(),
      () => this.presentation.clear(),
      () => this.events.clear(),
      () => this.frames.dispose(),
      () => this.tweens.dispose(),
      () => this.audio.dispose(),
      () => this.platform.dispose(),
      ...[...this.moduleDisposers].reverse(),
      () => this.screen.destroy(),
      () => this.rendering.destroy(),
      () => this.assets.destroy(),
    ];
    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        errors.push(error);
      }
    }
    this.diagnostics.clear();
    if (errors.length) throw new AggregateError(errors, 'Engine disposal failed');
  }

  private static requireRenderer(config: GameConfig) {
    if (!config.system?.renderer) throw new Error('GameConfig.system.renderer is required');
    return config.system.renderer;
  }

  /**
   * Convenience helper that creates, initializes, mounts, and starts the engine.
   * @param containerSelector CSS selector for the root DOM element.
   * @param config Full game configuration describing assets, scenes, DI, and screen.
   */
  static async run(containerSelector: string, config: GameConfig): Promise<Engine> {
    const container = document.querySelector<HTMLDivElement>(containerSelector);
    if (!container) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: 'Root element not found',
        details: { containerSelector },
      });
    }

    const engineOptions: EngineOptions = {
      container,
      renderer: Engine.requireRenderer(config),
      ...(config.system.modules ? { modules: config.system.modules } : {}),
      bundles: config.assets.bundles,
      ...(config.system?.canvasBackground ? { background: config.system.canvasBackground } : {}),
      ...(config.system?.screen ? { screen: config.system.screen } : {}),
      ...(config.system?.browserGuard ? { browserGuard: config.system.browserGuard } : {}),
      ...(config.system?.audio ? { audio: config.system.audio } : {}),
    };
    const engine = new Engine(engineOptions);
    const initOptions = config.system?.canvasBackground ? { background: config.system.canvasBackground } : {};
    try {
      await engine.init(initOptions);
      engine.mount(container);
      await engine.start(config);
      return engine;
    } catch (cause) {
      try {
        await engine.destroy();
      } catch (cleanup) {
        throw new AggregateError([cause, cleanup], 'Engine startup and cleanup failed');
      }
      throw cause;
    }
  }

  /**
   * Creates engine subsystems and registers core services.
   * @param options Minimal runtime options used before full start.
   */
  constructor(options: EngineOptions) {
    const subsystemFactory = new EngineSubsystemFactory();
    const staticSubsystems = subsystemFactory.createStatic(options);
    this.moduleDisposers = staticSubsystems.moduleDisposers;
    this.diagnostics = staticSubsystems.diagnostics;
    this.rendering = staticSubsystems.rendering;
    this.frames = new FrameDriver(() => this.rendering.renderFrame(), this.diagnostics);
    this.assets = staticSubsystems.assets;
    this.audio = staticSubsystems.audio;
    this.events = staticSubsystems.events;
    this.screen = staticSubsystems.screen;
    this.tweens = staticSubsystems.tweens;
    this.platform = staticSubsystems.platform;
    this.diContainer = staticSubsystems.diContainer;
    this.di = staticSubsystems.di;
    this.runtimeScheduler = staticSubsystems.runtimeScheduler;

    const runtimeBoundSubsystems = subsystemFactory.createRuntimeBound(this, staticSubsystems, options);
    this.commands = runtimeBoundSubsystems.commands;
    this.input = runtimeBoundSubsystems.input;
    this.inputChannel = runtimeBoundSubsystems.inputChannel;
    this.browserInputGuard = runtimeBoundSubsystems.browserInputGuard;
    this.prefabs = runtimeBoundSubsystems.prefabs;
    this.scenes = runtimeBoundSubsystems.scenes;
    this.runtimePhysicsStepService = runtimeBoundSubsystems.runtimePhysicsStepService;
    this.configStore = runtimeBoundSubsystems.configStore;
    this.localesService = runtimeBoundSubsystems.localesService;
    this.configBootstrapper = new ConfigBootstrapper(this.assets, this.configStore);
    this.runtimeBindings = new EngineRuntimeBindings(() => this.scenes.getActiveSceneLayout());
    this.eventBridge = new EngineEventBridge({
      events: this.events,
      screen: this.screen,
      resolveActiveSceneFSM: this.resolveActiveSceneFSM.bind(this),
    });
    this.runtimeController = new EnginePauseController({
      onPausedChanged: this.applyPausedState.bind(this),
      onActivityChanged: (reasons) => {
        this.activity.update(reasons);
        // Some platforms require audio to continue during the ad auction.
        this.audio.setRuntimePaused(
          reasons.some((reason) => reason !== 'adBreak' || this.platform.shouldMuteAudioOnAdRequest()),
        );
      },
    });
    this.platform.setAdBreakHooks(
      new AdBreakRuntimePolicy((paused: boolean) =>
        this.runtimeController.setAdBreakPaused(paused),
      ).createHooks(),
    );
    this.platform.setRuntimeHooks({
      onPauseRequested: this.handlePlatformPauseRequested.bind(this),
      onResumeRequested: this.handlePlatformResumeRequested.bind(this),
      onAudioMuteChanged: this.handlePlatformAudioMuteChanged.bind(this),
    });
    this.lifecycleManager = new EngineLifecycleManager({
      initializeRenderer: this.initializeRenderer.bind(this),
      mountRenderer: this.mountRenderer.bind(this),
      startRuntime: this.startRuntime.bind(this),
    });
  }

  /**
   * Initializes the renderer and attaches core listeners.
   * @param options Optional overrides like background color.
   */
  async init(options: { background?: string } = {}): Promise<void> {
    await this.lifecycleManager.init(options);
  }

  /**
   * Appends the renderer surfaces to the specified container.
   */
  mount(container: HTMLElement): void {
    this.lifecycleManager.mount(container);
  }

  /**
   * Validates configuration, preloads assets, and activates the first scene.
   * @param config Full game configuration.
   */
  async start(config: GameConfig): Promise<void> {
    await this.lifecycleManager.start(config);
  }

  private async initializeRenderer(initOptions: { background?: string }, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    try {
      await this.rendering.init(initOptions.background ?? '#000000');
    } catch (cause) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.CoreInvariantViolation,
        subsystem: EngineSubsystem.Core,
        message: 'Renderer initialization failed: WebGL renderer is unavailable in the current environment',
        details: this.getRendererDiagnostics(),
        cause,
      });
    }

    signal.throwIfAborted();
    await this.screen.init();
    signal.throwIfAborted();
    this.screen.setRenderRequester(this.requestRenderFrame.bind(this));
    await this.platform.init();
    signal.throwIfAborted();
    this.audio.attachInteractionTarget(this.rendering.canvas);
    this.input.attach(this.rendering.canvas);
    this.browserInputGuard.attach(this.rendering.canvas);
    this.eventBridge.attach();
    this.runtimeController.attach();
    this.frames.start();
  }

  private mountRenderer(container: HTMLElement): void {
    for (const canvas of this.rendering.canvases) container.appendChild(canvas);
  }

  private async startRuntime(startConfig: GameConfig, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    this.bootConfigPlan = new EngineBootConfigPlan(startConfig);
    this.sceneConfigMap = startConfig.scenes.map;
    this.config.layouts = startConfig.layouts;

    this.configInvariantValidator.validateStartConfig(startConfig);
    this.configureSceneManager(startConfig);
    this.scenes.setRuntimePaused(this.runtimeController.isPaused());
    if (startConfig.data !== undefined) {
      this.config.data = startConfig.data;
    }
    this.registerSystemProviders();

    const builtDi = startConfig.di.finalBuild();
    const globalProviders: readonly Provider[] = builtDi.globalProviders;
    this.sceneScopedDiEntries = builtDi.scenes.scenes;
    this.diBootstrapValidator.validate({
      sceneKeysFromConfig: Object.keys(startConfig.scenes.map),
      sceneDiConfig: builtDi.scenes,
      globalProviders,
    });
    this.registerGameProviders(globalProviders);

    const bootConfigPlan = this.getRequiredBootConfigPlan();
    await new EngineBootPipeline([
      new AssetBundlesBootTask(this.assets, startConfig),
      new ConfigBootstrapBootTask(this.configBootstrapper, bootConfigPlan),
      new LocalesBootstrapBootTask(this.localesService, this.platform),
      new PersistenceBootstrapBootTask(startConfig.system, this.platform, this.persistenceCoordinator),
    ]).run(signal);
    signal.throwIfAborted();
    this.audio.applyBootstrapConfig(startConfig.system?.audio, this.configStore);
    await this.startScene(startConfig.scenes.initial);
    signal.throwIfAborted();
    if (startConfig.system?.boot?.autoLoadingFinished !== false) {
      this.platform.loadingFinished();
    }
  }

  async bootstrapSceneConfigs(sceneKey: string): Promise<void> {
    await this.configBootstrapper.bootstrapSceneEnter(this.getRequiredBootConfigPlan(), sceneKey);
  }

  async bootstrapConfigBundles(bundleNames: readonly string[]): Promise<void> {
    await this.configBootstrapper.bootstrapBundles(bundleNames);
  }

  private resolveActiveSceneFSM(): SceneFSM | undefined {
    return this.runtimeBindings.getActiveSceneFSM();
  }

  setPaused(paused: boolean): void {
    this.runtimeController.setManualPaused(paused);
  }

  readonly activity = new RuntimeActivity();

  isPaused(): boolean {
    return this.runtimeController.isPaused();
  }

  private handlePlatformPauseRequested(): void {
    this.runtimeController.setPlatformPaused(true);
  }

  private handlePlatformResumeRequested(): void {
    this.runtimeController.setPlatformPaused(false);
  }

  private handlePlatformAudioMuteChanged(muted: boolean): void {
    this.audio.setPlatformMuted(muted);
  }

  private applyPausedState(paused: boolean): void {
    this.input.setPaused(paused);
    this.runtimeScheduler.setPaused(paused);
    this.tweens.setRuntimePaused(paused);
    this.scenes.setRuntimePaused(paused);
    this.events.emit({
      type: Engine.RuntimePausedChangedEvent,
      data: { paused },
    });
  }

  private requestRenderFrame(): void {
    this.rendering.renderFrame();
  }

  private getRendererDiagnostics(): Record<string, string> {
    return {
      hasNavigator: String(typeof navigator !== 'undefined'),
      hasWebGLRenderingContext: String(typeof WebGLRenderingContext !== 'undefined'),
      hasWebGPURenderingContext: String(typeof GPUCanvasContext !== 'undefined'),
      platform: typeof navigator === 'undefined' ? 'unknown' : navigator.platform,
      userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    };
  }

  /**
   * Registers core engine services into the DI container for injection.
   */
  private registerSystemProviders(): void {
    SystemProviderRegistrar.register(this.diContainer, {
      audioManager: this.audio,
      assetManager: this.assets,
      screenManager: this.screen,
      eventBus: this.events,
      tweens: this.tweens,
      inputManager: this.input,
      platformManager: this.platform,
      runtimePhysicsStepService: this.runtimePhysicsStepService,
      configStore: this.configStore,
      localesService: this.localesService,
      persistentStorage: this.storage,
    });
  }

  /**
   * Sets the current layout reference used by layout resolvers.
   */
  setActiveLayout(layout: SceneLayout | undefined): void {
    this.runtimeBindings.setActiveLayout(layout);
  }

  clearActiveLayout(layout: SceneLayout | undefined): void {
    this.runtimeBindings.clearActiveLayout(layout);
  }

  /**
   * Sets the reference to the active scene FSM (used during transitions).
   */
  setActiveSceneFSM(fsm: SceneFSM | undefined): void {
    this.runtimeBindings.setActiveSceneFSM(fsm);
  }

  clearActiveSceneFSM(fsm: SceneFSM | undefined): void {
    this.runtimeBindings.clearActiveSceneFSM(fsm);
  }

  getCurrentSceneFSM(): SceneFSM | undefined {
    return this.runtimeBindings.getActiveSceneFSM();
  }

  setActiveSceneDi(sceneDi: DiContainerInterface | undefined): void {
    this.runtimeBindings.setActiveSceneDi(sceneDi);
  }

  clearActiveSceneDi(sceneDi: DiContainerInterface | undefined): void {
    this.runtimeBindings.clearActiveSceneDi(sceneDi);
  }

  getActiveSceneDi(): DiContainerInterface | undefined {
    return this.runtimeBindings.getActiveSceneDi();
  }

  getRequiredActiveSceneDi(): DiContainerInterface {
    return this.runtimeBindings.getRequiredActiveSceneDi();
  }

  getSceneScopedProviders(sceneKey: string): readonly Provider[] {
    const entry = this.sceneScopedDiEntries[sceneKey];
    if (!entry?.providers) return [];
    return entry.providers;
  }

  getSceneScopedServiceTokens(sceneKey: string): readonly Token<SceneService>[] {
    const entry = this.sceneScopedDiEntries[sceneKey];
    if (!entry?.services) return [];
    return entry.services as readonly Token<SceneService>[];
  }

  /**
   * Returns the currently active layout if known.
   * Falls back to the active scene's `getLayout()` when available.
   */
  getActiveLayout(): SceneLayout | undefined {
    return this.runtimeBindings.getActiveLayout();
  }

  getRequiredActiveLayout(): SceneLayout {
    return this.runtimeBindings.getRequiredActiveLayout();
  }

  getSceneRenderRoot(): NodeBase {
    return this.rendering.root;
  }

  getCurrentSceneParams(): Readonly<Record<string, unknown>> | undefined {
    return this.scenes.getCurrentSceneParams();
  }

  getRequiredActiveSceneParams(): Readonly<Record<string, unknown>> {
    return this.getCurrentSceneParams() ?? Engine.EmptySceneParams;
  }

  createSceneByKey(sceneKey: string): Scene {
    const sceneConfig = this.getRequiredSceneConfigByKey(sceneKey);
    const SceneCtor = sceneConfig.useClass ?? BaseScene;
    return new SceneCtor(sceneConfig);
  }

  /**
   * Registers user-defined DI providers declared in the `GameConfig`.
   */
  private registerGameProviders(providers: readonly Provider[]): void {
    for (const p of providers) {
      this.di.register({ ...p, source: p.source ?? 'game' });
    }
  }

  /**
   * Instantiates and activates the starting scene by key.
   */
  private async startScene(initialSceneKey: string): Promise<void> {
    try {
      await this.scenes.start(initialSceneKey);
    } catch (cause) {
      const causeDetails = this.describeCauseDetails(cause);
      throw EngineErrorFactory.create({
        code: EngineErrorCode.CoreInvariantViolation,
        subsystem: EngineSubsystem.Core,
        message: 'Failed to start initial scene',
        details: {
          method: 'Engine.startScene',
          initialSceneKey,
          ...(causeDetails.causeName === undefined ? {} : { causeName: causeDetails.causeName }),
          ...(causeDetails.causeMessage === undefined ? {} : { causeMessage: causeDetails.causeMessage }),
        },
        cause,
      });
    }
  }

  private configureSceneManager(config: GameConfig): void {
    const timeoutMs = config.system?.lifecycle?.transitionTimeoutMs;
    if (timeoutMs === undefined) return;
    this.configInvariantValidator.validateTransitionTimeout(timeoutMs);
    this.scenes.setTransitionTimeoutMs(timeoutMs);
  }

  private getRequiredBootConfigPlan(): EngineBootConfigPlan {
    if (!this.bootConfigPlan) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: 'Boot config plan is not initialized',
        details: { method: 'Engine.getRequiredBootConfigPlan' },
      });
    }
    return this.bootConfigPlan;
  }

  private getRequiredSceneConfigByKey(sceneKey: string): SceneConfig {
    const sceneConfig = this.sceneConfigMap[sceneKey];
    if (sceneConfig) {
      return sceneConfig;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.CoreInvalidConfig,
      subsystem: EngineSubsystem.Core,
      message: 'Scene key is not found in configured scenes map',
      details: { method: 'Engine.getRequiredSceneConfigByKey', sceneKey },
    });
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
}
