import { GameDistributionPlatformAdapter } from '../gamedistribution/GameDistributionPlatformAdapter';

import type { PlatformAdapter } from '../../types';

/**
 * Build-specific resolver for the GameDistribution target.
 */
export class PlatformAdapterResolver {
  static create(): PlatformAdapter {
    return new GameDistributionPlatformAdapter();
  }
}
