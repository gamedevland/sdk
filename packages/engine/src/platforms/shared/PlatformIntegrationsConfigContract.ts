export interface GameDistributionPlatformConfig {
  readonly gameId: string;
}

export interface PlatformIntegrationsConfig {
  readonly gamedistribution?: GameDistributionPlatformConfig;
}

/**
 * Shared config contract for platform integration settings used by build and runtime.
 */
export class PlatformIntegrationsConfigContract {
  static readonly FILE_ID = 'json/configs/common/app/platforms.json';

  static getRequiredGameDistributionGameId(
    config: PlatformIntegrationsConfig,
    source: string,
  ): string {
    const gameId = config.gamedistribution?.gameId;
    if (!gameId) {
      throw new Error(
        `[vite] Missing non-empty gamedistribution.gameId in '${source}'.`,
      );
    }
    return gameId;
  }
}
