import { PokiPlatformAdapter } from '../poki/PokiPlatformAdapter';

import type { PlatformAdapter } from '../../types';

/**
 * Build-specific resolver for the Poki target.
 */
export class PlatformAdapterResolver {
  static create(): PlatformAdapter {
    return new PokiPlatformAdapter();
  }
}
