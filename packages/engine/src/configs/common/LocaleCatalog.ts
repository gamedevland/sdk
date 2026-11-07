export type SupportedLocaleCode = 'en' | 'ru' | 'es' | 'pt-BR' | 'de' | 'fr' | 'it' | 'tr' | 'zh-CN' | 'ja' | 'ko';

/** Canonical locale codes shared by runtime, configs and build tools. */
export class LocaleCatalog {
  static readonly EN = 'en';
  static readonly RU = 'ru';
  static readonly DEFAULT = LocaleCatalog.EN;
  private static readonly SUPPORTED_LIST: readonly SupportedLocaleCode[] = [
    'en', 'ru', 'es', 'pt-BR', 'de', 'fr', 'it', 'tr', 'zh-CN', 'ja', 'ko',
  ];

  static isSupported(locale: string): locale is SupportedLocaleCode {
    return this.SUPPORTED_LIST.some((code) => code === locale);
  }

  static getSupportedList(): ReadonlyArray<SupportedLocaleCode> { return this.SUPPORTED_LIST; }

  static normalize(input: string | null | undefined): SupportedLocaleCode | null {
    if (typeof input !== 'string') return null;
    const normalized = input.trim().toLowerCase().replace(/_/g, '-');
    const base = normalized.split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'zh') return 'zh-CN';
    return base !== undefined && this.isSupported(base) ? base : null;
  }

  static coerceSupported(input: string | null | undefined): SupportedLocaleCode {
    return this.normalize(input) ?? this.DEFAULT;
  }

  static getConfigId(locale: SupportedLocaleCode): string { return `json/locales/${locale}.json`; }
}
