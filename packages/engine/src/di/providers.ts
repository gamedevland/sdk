import { DiTokens, SystemServices } from './tokens';

import type { DiContainer } from './DiContainer';
import type { AssetManager } from '@engine/assets';
import type { AudioManager } from '@engine/audio';
import type { ConfigStore } from '@engine/configs';
import type { LocalesService } from '@engine/configs';
import type { EventBus } from '@engine/events';
import type { InputManager } from '@engine/input';
import type { TextureAssetResolver } from '@engine/layouts';
import type { ParticlesManager } from '@engine/particles';
import type { PhysicsManager } from '@engine/physics';
import type { PlatformManager } from '@engine/platforms';
import type { RuntimePhysicsStepPort } from '@engine/runtime/RuntimePhysicsStepService';
import type { ScreenManager } from '@engine/screen';
import type { GsapTweenManager } from '@engine/tween';

/**
 * Registers core engine services in the DI container using well-known system tokens.
 *
 * Notes:
 * - All services here are registered as singletons because they represent global managers.
 * - The container caches singleton instances per scope; child scopes will have their own caches.
 */
export function registerSystemProviders(
  container: DiContainer,
  services: {
    audioManager: AudioManager;
    assetManager: AssetManager;
    screenManager: ScreenManager;
    eventBus: EventBus;
    tweens: GsapTweenManager;
    inputManager: InputManager;
    particlesManager: ParticlesManager;
    physicsManager: PhysicsManager;
    platformManager: PlatformManager;
    runtimePhysicsStepService: RuntimePhysicsStepPort;
    configStore: ConfigStore;
    localesService: LocalesService;
    textureAssetResolver: TextureAssetResolver;
  },
): void {
  container.register({
    token: SystemServices.AudioManager,
    useValue: services.audioManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.AssetManager,
    useValue: services.assetManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.ScreenManager,
    useValue: services.screenManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.EventBus,
    useValue: services.eventBus,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.Tweens,
    useValue: services.tweens,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.InputManager,
    useValue: services.inputManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.ParticlesManager,
    useValue: services.particlesManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.PhysicsManager,
    useValue: services.physicsManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.PlatformManager,
    useValue: services.platformManager,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.RuntimePhysicsStepService,
    useValue: services.runtimePhysicsStepService,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.ConfigStore,
    useValue: services.configStore,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.LocalesService,
    useValue: services.localesService,
    lifetime: 'singleton',
    source: 'system',
  });
  container.register({
    token: SystemServices.TextureAssetResolver,
    useValue: services.textureAssetResolver,
    lifetime: 'singleton',
    source: 'system',
  });
}

/**
 * Registers a named element factory under the `element:` namespace.
 *
 * Parameters:
 * - name: logical factory name (e.g. 'Sprite', 'Text')
 * - factory: any value representing the factory (function, class, object)
 * - lifetime: defaults to 'transient' so each resolve returns the same factory reference
 *
 * Implementation detail:
 * - We store the factory via `useFactory: () => factory` to keep a consistent provider shape,
 *   and to allow potential late binding or wrapping in the future.
 */
export function registerElementFactory(
  container: DiContainer,
  name: string,
  factory: unknown,
  lifetime: 'singleton' | 'transient' = 'transient',
): void {
  container.register({ token: DiTokens.element(name), useFactory: () => factory, lifetime });
}
