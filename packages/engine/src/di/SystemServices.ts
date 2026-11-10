import { DiTokens } from './DiTokens';
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
 * Well-known system service tokens.
 */
export class SystemServices {
  static readonly PersistentStorage =
    DiTokens.service<import('../configs').PersistentStorageAdapter>('PersistentStorage');
  static readonly AudioManager = DiTokens.service<AudioManager>('AudioManager');
  static readonly AssetManager = DiTokens.service<AssetManager>('AssetManager');
  static readonly ScreenManager = DiTokens.service<ScreenManager>('ScreenManager');
  static readonly EventBus = DiTokens.service<EventBus>('EventBus');
  static readonly Tweens = DiTokens.service<GsapTweenManager>('Tweens');
  static readonly InputManager = DiTokens.service<InputManager>('InputManager');
  static readonly PlatformManager = DiTokens.service<PlatformManager>('PlatformManager');
  static readonly RuntimePhysicsStepService =
    DiTokens.service<RuntimePhysicsStepPort>('RuntimePhysicsStepService');
  static readonly ConfigStore = DiTokens.service<ConfigStore>('ConfigStore');
  static readonly LocalesService = DiTokens.service<LocalesService>('LocalesService');
}
