import type { TokenObject } from './types';
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
 * Strongly typed DI token object.
 */
export type DiToken<T = unknown> = TokenObject<T>;

/**
 * Builds typed tokens with stable string keys (`kind:name`).
 */
const createToken = <T>(kind: string, name: string): DiToken<T> =>
  Object.freeze({
    kind,
    name,
    key: `${kind}:${name}`,
  });

export const DiTokens = {
  element: <T = unknown>(name: string): DiToken<T> => createToken<T>('element', name),
  component: <T = unknown>(name: string): DiToken<T> => createToken<T>('component', name),
  action: <T = unknown>(name: string): DiToken<T> => createToken<T>('action', name),
  command: <T = unknown>(name: string): DiToken<T> => createToken<T>('command', name),
  service: <T = unknown>(name: string): DiToken<T> => createToken<T>('service', name),
};

/**
 * Well-known system service tokens.
 */
export const SystemServices = {
  AudioManager: DiTokens.service<AudioManager>('AudioManager'),
  AssetManager: DiTokens.service<AssetManager>('AssetManager'),
  ScreenManager: DiTokens.service<ScreenManager>('ScreenManager'),
  EventBus: DiTokens.service<EventBus>('EventBus'),
  Tweens: DiTokens.service<GsapTweenManager>('Tweens'),
  InputManager: DiTokens.service<InputManager>('InputManager'),
  ParticlesManager: DiTokens.service<ParticlesManager>('ParticlesManager'),
  PhysicsManager: DiTokens.service<PhysicsManager>('PhysicsManager'),
  PlatformManager: DiTokens.service<PlatformManager>('PlatformManager'),
  RuntimePhysicsStepService: DiTokens.service<RuntimePhysicsStepPort>('RuntimePhysicsStepService'),
  ConfigStore: DiTokens.service<ConfigStore>('ConfigStore'),
  LocalesService: DiTokens.service<LocalesService>('LocalesService'),
  TextureAssetResolver: DiTokens.service<TextureAssetResolver>('TextureAssetResolver'),
};
