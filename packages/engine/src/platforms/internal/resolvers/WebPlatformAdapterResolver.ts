import { WebPlatformAdapter } from '../web/WebPlatformAdapter';

import type { PlatformAdapter } from '../../types';

/**
 * Build-specific resolver for the standalone/web target.
 */
export class PlatformAdapterResolver {
  static create(): PlatformAdapter {
    return new WebPlatformAdapter();
  }
}
