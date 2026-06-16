import { GameViteConfigFactory } from './GameViteConfigFactory';

import type { GameViteConfigFactoryOptions } from './GameViteConfigFactory';
import type { UserConfig } from 'vite';

/**
 * Creates a production-ready Vite config for Gamedev Land web games.
 */
export class GameViteConfig {
  static create(options: GameViteConfigFactoryOptions): UserConfig {
    return GameViteConfigFactory.create(options);
  }
}

export function createGameViteConfig(options: GameViteConfigFactoryOptions): UserConfig {
  return GameViteConfig.create(options);
}

export { GameViteConfigFactory };
export type { GameViteConfigFactoryOptions };
