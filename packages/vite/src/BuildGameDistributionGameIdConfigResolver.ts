import fs from 'node:fs';
import path from 'node:path';

import { PlatformCatalog, PlatformIntegrationsConfigContract } from '@gamedevland/engine/platforms';

import type { PlatformIntegrationsConfig } from '@gamedevland/engine/platforms';

/**
 * Resolves the GameDistribution game id from the static game JSON config.
 */
export class BuildGameDistributionGameIdConfigResolver {
  private static readonly CONFIG_FILE_PATH = 'game/assets/json/configs/common/app/platforms.json';
  private static readonly ROOT_PATH = '$';
  private static readonly GAMEDISTRIBUTION_PATH = '$.gamedistribution';
  private static readonly GAME_ID_PATH = '$.gamedistribution.gameId';

  static resolve(platformId: string, repoRoot: string): string | undefined {
    if (platformId !== PlatformCatalog.GAMEDISTRIBUTION) {
      return undefined;
    }

    const filePath = path.resolve(repoRoot, BuildGameDistributionGameIdConfigResolver.CONFIG_FILE_PATH);
    let rawContent = '';
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch (cause) {
      throw new Error(
        `[vite] Failed to read GameDistribution config at '${filePath}'.`,
        { cause },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent) as unknown;
    } catch (cause) {
      throw new Error(
        `[vite] Invalid JSON in GameDistribution config '${filePath}'.`,
        { cause },
      );
    }

    const decoded = BuildGameDistributionGameIdConfigResolver.decodeConfig(parsed, filePath);
    return PlatformIntegrationsConfigContract.getRequiredGameDistributionGameId(
      decoded,
      filePath,
    );
  }

  private static decodeConfig(
    input: unknown,
    filePath: string,
  ): PlatformIntegrationsConfig {
    if (!BuildGameDistributionGameIdConfigResolver.isRecord(input)) {
      throw new Error(`[vite] ${filePath} expected object at '${BuildGameDistributionGameIdConfigResolver.ROOT_PATH}'`);
    }

    const rawGameDistribution = input.gamedistribution;
    if (rawGameDistribution === undefined) {
      return {};
    }
    if (!BuildGameDistributionGameIdConfigResolver.isRecord(rawGameDistribution)) {
      throw new Error(
        `[vite] ${filePath} expected object at '${BuildGameDistributionGameIdConfigResolver.GAMEDISTRIBUTION_PATH}'`,
      );
    }

    const rawGameId = rawGameDistribution.gameId;
    if (typeof rawGameId !== 'string' || rawGameId.trim().length === 0) {
      throw new Error(
        `[vite] ${filePath} expected non-empty string at '${BuildGameDistributionGameIdConfigResolver.GAME_ID_PATH}'`,
      );
    }

    return {
      gamedistribution: {
        gameId: rawGameId.trim(),
      },
    };
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
