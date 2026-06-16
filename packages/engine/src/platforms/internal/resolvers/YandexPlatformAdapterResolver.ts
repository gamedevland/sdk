import { YandexPlatformAdapter } from '../yandex/YandexPlatformAdapter';

import type { PlatformAdapter } from '../../types';

/**
 * Build-specific resolver for the Yandex Games target.
 */
export class PlatformAdapterResolver {
  static create(): PlatformAdapter {
    return new YandexPlatformAdapter();
  }
}
