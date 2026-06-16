import { LocaleCatalog } from '@gamedevland/engine/configs';
import { loadEnv } from 'vite';

/**
 * Resolves and validates the build-time default locale.
 */
export class BuildDefaultLocaleEnvResolver {
  static resolve(mode: string, cwd: string): string {
    const env = loadEnv(mode, cwd, '');
    const rawLocale = process.env.VITE_DEFAULT_LOCALE ?? env.VITE_DEFAULT_LOCALE;
    if (rawLocale == null || rawLocale.length === 0) {
      return LocaleCatalog.DEFAULT;
    }
    const normalized = LocaleCatalog.normalize(rawLocale);
    if (normalized === null) {
      throw new Error(
        `[vite] Unsupported VITE_DEFAULT_LOCALE value "${rawLocale}". Supported values: ${LocaleCatalog.getSupportedList().join(', ')}.`,
      );
    }
    return normalized;
  }
}
