import { LocaleCatalog } from '@engine/configs/common/LocaleCatalog';

import type { EngineBootTask } from './EngineBootTask';
import type { LocalesService } from '@engine/configs';
import type { PlatformManager } from '@engine/platforms';

export class LocalesBootstrapBootTask implements EngineBootTask {
  constructor(
    private readonly localesService: LocalesService,
    private readonly platformManager: PlatformManager,
  ) {}

  async run(): Promise<void> {
    const effectiveLocale = this.resolveEffectiveLocale();
    this.localesService.setLang(effectiveLocale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = effectiveLocale;
    }
  }

  private resolveEffectiveLocale(): string {
    const platformLocale = this.platformManager.getPreferredLocale();
    if (platformLocale !== null) {
      return platformLocale;
    }
    return LocaleCatalog.coerceSupported(this.readDefaultLocale());
  }

  private readDefaultLocale(): string | undefined {
    const defaultLocale: unknown = import.meta.env.VITE_DEFAULT_LOCALE;
    return typeof defaultLocale === 'string' ? defaultLocale : undefined;
  }
}
