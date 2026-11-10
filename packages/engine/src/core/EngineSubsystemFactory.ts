import { RuntimeDiagnostics } from '../diagnostics';
import { RenderTokens } from '../rendering/RenderTokens';
import type { RenderRuntime } from '../rendering/types';

import { ConfigStore, LocalesService } from '@engine/configs';
import { DiContainer } from '@engine/di/DiContainer';
import { EngineDi } from '@engine/di/EngineDi';

import { AssetManager } from '../assets';
import { AudioLoader, FontLoader, ImageLoader, JsonLoader } from '../assets';
import { AudioManager } from '../audio';
import { CommandBus } from '../commands/CommandBus';
import { EventBus } from '../events/EventBus';
import { BrowserInputGuard } from '../input/BrowserInputGuard';
import { InputChannel } from '../input/InputChannel';
import { InputManager } from '../input/InputManager';
import { PlatformManager } from '../platforms';
import { PrefabManager, PrefabRepository } from '../prefabs';
import { RuntimeServicesComposer } from '../runtime/RuntimeServicesComposer';
import SceneManager from '../scenes/SceneManager';
import { ScreenManager } from '../screen/ScreenManager';
import { GsapTweenManager } from '../tween/GsapTweenManager';

import type { EngineOptions } from './EngineOptions';
import type { EngineCompositionRuntime } from './ports';
import type { RuntimePhysicsStepPort } from '../runtime/RuntimePhysicsStepService';
import type { RuntimeScheduler } from '../runtime/RuntimeScheduler';
import type { Scene } from '../scenes/SceneManager';

interface StaticSubsystems {
  readonly rendering: RenderRuntime;
  readonly diagnostics: RuntimeDiagnostics;
  readonly moduleDisposers: readonly (() => void)[];
  readonly assets: AssetManager;
  readonly audio: AudioManager;
  readonly events: EventBus;
  readonly screen: ScreenManager;
  readonly tweens: GsapTweenManager;
  readonly platform: PlatformManager;
  readonly diContainer: DiContainer;
  readonly di: EngineDi;
  readonly runtimeScheduler: RuntimeScheduler<Scene>;
  readonly runtimeServicesComposer: RuntimeServicesComposer;
}

interface RuntimeBoundSubsystems {
  readonly configStore: ConfigStore;
  readonly localesService: LocalesService;
  readonly commands: CommandBus;
  readonly input: InputManager;
  readonly inputChannel: InputChannel;
  readonly browserInputGuard: BrowserInputGuard;
  readonly prefabs: PrefabManager;
  readonly scenes: SceneManager;
  readonly runtimePhysicsStepService: RuntimePhysicsStepPort;
}

export class EngineSubsystemFactory {
  createStatic(options: EngineOptions): StaticSubsystems {
    const screenConfig = options.screen ?? {
      land: { width: 1280, height: 720 },
      port: { width: 720, height: 1280 },
    };
    const assets = new AssetManager({ baseURL: '/' });
    this.registerBuiltInLoaders(assets);
    if (options.bundles && options.bundles.length) {
      assets.registerBundles(...options.bundles);
    }

    const diagnostics = new RuntimeDiagnostics();
    if (options.onDiagnostic) diagnostics.subscribe(options.onDiagnostic);
    const events = new EventBus((error, event) =>
      diagnostics.report({ kind: 'error', source: 'events', error, eventType: event.type }),
    );
    const runtimeServicesComposer = new RuntimeServicesComposer();
    const runtimeScheduler = runtimeServicesComposer.createScheduler(diagnostics);
    const diContainer = new DiContainer();
    if (!options.renderer) throw new Error('Engine requires an explicit renderer module');
    options.renderer.register(diContainer, assets, screenConfig);
    const rendering = diContainer.get(RenderTokens.Runtime);
    const moduleDisposers: Array<() => void> = [];
    try {
      for (const module of options.modules ?? []) {
        const dispose = module.register(diContainer);
        if (dispose) moduleDisposers.push(dispose);
      }
    } catch (cause) {
      const errors: unknown[] = [cause];
      for (const dispose of moduleDisposers.reverse()) {
        try {
          dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 1) throw new AggregateError(errors, 'Module registration rollback failed');
      throw cause;
    }
    const audio = AudioManager.createDefault(assets, options.audio);
    const platform = PlatformManager.createFromEnvironment();

    return {
      diagnostics,
      moduleDisposers,
      rendering,
      assets,
      audio,
      events,
      screen: new ScreenManager(rendering, screenConfig),
      tweens: new GsapTweenManager(),
      platform,
      diContainer,
      di: new EngineDi(diContainer),
      runtimeScheduler,
      runtimeServicesComposer,
    };
  }

  createRuntimeBound(
    runtime: EngineCompositionRuntime,
    staticSubsystems: StaticSubsystems,
    options: EngineOptions,
  ): RuntimeBoundSubsystems {
    const configStore = new ConfigStore();
    const localesService = new LocalesService(configStore);
    const commands = new CommandBus(runtime);
    const input = new InputManager(runtime);
    const inputChannel = new InputChannel(staticSubsystems.events);
    const browserInputGuard = new BrowserInputGuard(options.browserGuard);
    const prefabs = new PrefabManager(runtime, new PrefabRepository(staticSubsystems.assets));
    const scenes = new SceneManager(runtime);
    const runtimePhysicsStepService = staticSubsystems.runtimeServicesComposer.createPhysicsStepService({
      engine: runtime,
      sceneManager: scenes,
      scheduler: staticSubsystems.runtimeScheduler,
    });

    return {
      configStore,
      localesService,
      commands,
      input,
      inputChannel,
      browserInputGuard,
      prefabs,
      scenes,
      runtimePhysicsStepService,
    };
  }

  private registerBuiltInLoaders(assets: AssetManager): void {
    assets.registerLoader('audio', new AudioLoader());
    assets.registerLoader('font', new FontLoader());
    assets.registerLoader('image', new ImageLoader());
    assets.registerLoader('json', new JsonLoader());
  }
}
