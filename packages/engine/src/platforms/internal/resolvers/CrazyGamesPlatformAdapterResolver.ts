import { CrazyGamesPlatformAdapter } from '../crazygames/CrazyGamesPlatformAdapter';

import type { PlatformAdapter } from '../../types';

/**
 * Build-specific resolver for the CrazyGames target.
 */
export class PlatformAdapterResolver {
  static create(): PlatformAdapter {
    return new CrazyGamesPlatformAdapter();
  }
}
