import { SystemServices } from './tokens';

import type { DiContainer } from './DiContainer';
import type { AssetManager } from '@engine/assets';
import type { AudioManager } from '@engine/audio';
import type { ConfigStore } from '@engine/configs';
import type { LocalesService } from '@engine/configs';
import type { EventBus } from '@engine/events';
import type { InputManager } from '@engine/input';
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
export class SystemProviderRegistrar {
static register(
  container: DiContainer,
  services: {
    audioManager: AudioManager;
    assetManager: AssetManager;
    screenManager: ScreenManager;
    eventBus: EventBus;
    tweens: GsapTweenManager;
    inputManager: InputManager;
    platformManager: PlatformManager;
    runtimePhysicsStepService: RuntimePhysicsStepPort;
    configStore: ConfigStore;
    localesService: LocalesService;
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
}

}
