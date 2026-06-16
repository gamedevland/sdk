import path from 'node:path';

import { BuildDefaultLocaleEnvResolver } from './BuildDefaultLocaleEnvResolver';
import { BuildGameDistributionGameIdConfigResolver } from './BuildGameDistributionGameIdConfigResolver';
import { BuildPlatformDevProxyCatalog } from './BuildPlatformDevProxyCatalog';
import { BuildPlatformEnvResolver } from './BuildPlatformEnvResolver';
import { BuildPlatformSdkInjectPluginFactory } from './BuildPlatformSdkInjectPluginFactory';

import type { UserConfig } from 'vite';

export interface GameViteConfigFactoryOptions {
  readonly mode: string;
  readonly repoRoot: string;
}

/**
 * Composition root for game Vite configuration.
 */
export class GameViteConfigFactory {
  static create(options: GameViteConfigFactoryOptions): UserConfig {
    const platformId = BuildPlatformEnvResolver.resolve(options.mode, process.cwd());
    const defaultLocale = BuildDefaultLocaleEnvResolver.resolve(options.mode, process.cwd());
    const gameDistributionGameId = BuildGameDistributionGameIdConfigResolver.resolve(
      platformId,
      options.repoRoot,
    );
    const platformSdkInjectOptions =
      gameDistributionGameId === undefined ? undefined : { gameDistributionGameId };
    const devProxy = BuildPlatformDevProxyCatalog.resolve(platformId);

    return {
      root: path.resolve(options.repoRoot, 'game'),
      // Keep built asset URLs relative so dist/index.html works from subpaths
      // (e.g. Live Server at /dist/) and static hosts without root rewrites.
      base: './',
      resolve: {
        alias: [
          { find: '@game', replacement: path.resolve(options.repoRoot, 'game') },
          { find: '@json', replacement: path.resolve(options.repoRoot, 'game/json') },
          { find: '@common', replacement: path.resolve(options.repoRoot, 'game/src/common') },
          { find: '@modules', replacement: path.resolve(options.repoRoot, 'modules') },
        ],
      },
      server: {
        port: 5173,
        open: true,
        ...(devProxy ? { proxy: devProxy } : {}),
      },
      preview: {
        port: 5173,
      },
      define: {
        'import.meta.env.VITE_PLATFORM': JSON.stringify(platformId),
        'import.meta.env.VITE_DEFAULT_LOCALE': JSON.stringify(defaultLocale),
      },
      esbuild: {
        // DI/FSM tokens currently rely on runtime class.name values.
        // Keep class/function names stable in production bundles.
        keepNames: true,
      },
      plugins: [
        BuildPlatformSdkInjectPluginFactory.create(platformId, platformSdkInjectOptions),
      ],
      build: {
        outDir: path.resolve(options.repoRoot, 'dist'),
        emptyOutDir: true,
      },
    };
  }
}
