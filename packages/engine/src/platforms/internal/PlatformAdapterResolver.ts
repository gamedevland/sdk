import { PlatformCatalog } from '../shared/PlatformCatalog';
import { NullPlatformAdapter } from '../NullPlatformAdapter';

import { CrazyGamesPlatformAdapter } from './crazygames/CrazyGamesPlatformAdapter';
import { GameDistributionPlatformAdapter } from './gamedistribution/GameDistributionPlatformAdapter';
import { PokiPlatformAdapter } from './poki/PokiPlatformAdapter';
import { PlaygamaPlatformAdapter } from './playgama/PlaygamaPlatformAdapter';
import { WebPlatformAdapter } from './web/WebPlatformAdapter';
import { YandexPlatformAdapter } from './yandex/YandexPlatformAdapter';

import type { PlatformId } from '../shared/PlatformCatalog';
import type { PlatformAdapter } from '../types';

/**
 * Resolves the platform adapter from build-time VITE_PLATFORM define.
 */
export class PlatformAdapterResolver {
  private static readonly ADAPTER_FACTORY_BY_PLATFORM: Readonly<
    Record<PlatformId, () => PlatformAdapter>
  > = {
    [PlatformCatalog.WEB]: () => new WebPlatformAdapter(),
    [PlatformCatalog.POKI]: () => new PokiPlatformAdapter(),
    [PlatformCatalog.CRAZYGAMES]: () => new CrazyGamesPlatformAdapter(),
    [PlatformCatalog.YANDEX]: () => new YandexPlatformAdapter(),
    [PlatformCatalog.GAMEDISTRIBUTION]: () => new GameDistributionPlatformAdapter(),
    [PlatformCatalog.PLAYGAMA]: () => new PlaygamaPlatformAdapter(),
  };

  static create(): PlatformAdapter {
    const platformId = PlatformAdapterResolver.readPlatformId();
    if (platformId === undefined) {
      return new NullPlatformAdapter();
    }
    return PlatformAdapterResolver.ADAPTER_FACTORY_BY_PLATFORM[platformId]();
  }

  private static readPlatformId(): PlatformId | undefined {
    const platformId: unknown = import.meta.env.VITE_PLATFORM;
    if (typeof platformId !== 'string' || !PlatformCatalog.isSupported(platformId)) {
      return undefined;
    }
    return platformId;
  }
}
