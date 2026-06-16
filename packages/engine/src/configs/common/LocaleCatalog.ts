export type SupportedLocaleCode = 'en' | 'ru';

/**
 * Canonical supported locale codes used by runtime, build validation, and platform hints.
 */
export class LocaleCatalog {
  static readonly EN: SupportedLocaleCode = 'en';
  static readonly RU: SupportedLocaleCode = 'ru';
  static readonly DEFAULT: SupportedLocaleCode = LocaleCatalog.EN;

  private static readonly SUPPORTED_LIST = [LocaleCatalog.EN, LocaleCatalog.RU] as const;
  private static readonly SUPPORTED = new Set<SupportedLocaleCode>(LocaleCatalog.SUPPORTED_LIST);

  static isSupported(locale: string): locale is SupportedLocaleCode {
    return LocaleCatalog.SUPPORTED.has(locale as SupportedLocaleCode);
  }

  static getSupportedList(): ReadonlyArray<SupportedLocaleCode> {
    return LocaleCatalog.SUPPORTED_LIST;
  }

  static normalize(input: string | null | undefined): SupportedLocaleCode | null {
    if (typeof input !== 'string') {
      return null;
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const normalized = trimmed.toLowerCase().split(/[-_]/)[0];
    if (normalized === undefined) {
      return null;
    }
    return LocaleCatalog.isSupported(normalized) ? normalized : null;
  }

  static coerceSupported(input: string | null | undefined): SupportedLocaleCode {
    return LocaleCatalog.normalize(input) ?? LocaleCatalog.DEFAULT;
  }

  static getConfigId(locale: SupportedLocaleCode): string {
    return `json/locales/${locale}.json`;
  }
}
