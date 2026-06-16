import { LocaleCatalog } from '../common/LocaleCatalog';
import { LocaleDictionaryConfigDecoder } from '../common/LocaleDictionaryConfigDecoder';

import type { SupportedLocaleCode } from '../common/LocaleCatalog';
import type { LocaleDictionary } from '../common/Locales';
import type { ConfigStore } from '../core/ConfigStore';

/** Simple localization access service. */
export class LocalesService {
  private current = LocaleCatalog.DEFAULT;
  private readonly fallback: readonly SupportedLocaleCode[];
  private readonly loadedDictionaries = new Map<SupportedLocaleCode, LocaleDictionary>();

  constructor(
    private readonly configStore: ConfigStore,
    fallback: readonly string[] = [LocaleCatalog.DEFAULT],
  ) {
    this.fallback = fallback
      .map((lang) => LocaleCatalog.normalize(lang))
      .filter((lang): lang is SupportedLocaleCode => lang !== null);
  }

  setLang(lang: string): void {
    this.current = LocaleCatalog.coerceSupported(lang);
  }

  getLang(): SupportedLocaleCode {
    return this.current;
  }

  private hasKey(dict: Record<string, string> | undefined, key: string): boolean {
    return !!dict && Object.prototype.hasOwnProperty.call(dict, key);
  }

  t(key: string, params?: Readonly<Record<string, string | number>>): string {
    for (const lang of this.getLookupOrder()) {
      const dict = this.loadDictionary(lang);
      if (!this.hasKey(dict, key)) {
        continue;
      }
      const value = dict[key];
      if (typeof value === 'string') {
        return this.interpolate(value, params);
      }
    }
    return this.interpolate(key, params);
  }

  has(key: string): boolean {
    return this.getLookupOrder().some((lang) => this.hasKey(this.loadDictionary(lang), key));
  }

  private loadDictionary(locale: SupportedLocaleCode): LocaleDictionary {
    const cached = this.loadedDictionaries.get(locale);
    if (cached) {
      return cached;
    }

    const configId = LocaleCatalog.getConfigId(locale);
    const raw = this.configStore.getRequired(configId);
    const decoded = LocaleDictionaryConfigDecoder.decode(raw, `LocalesService('${configId}')`);
    this.loadedDictionaries.set(locale, decoded);
    return decoded;
  }

  private getLookupOrder(): ReadonlyArray<SupportedLocaleCode> {
    const order = [this.current, ...this.fallback];
    const unique = new Set<SupportedLocaleCode>();
    for (const lang of order) {
      if (lang !== this.current && lang === LocaleCatalog.DEFAULT && this.current === LocaleCatalog.DEFAULT) {
        continue;
      }
      unique.add(lang);
    }
    return [...unique];
  }

  private interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
    if (!params) {
      return template;
    }
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, token: string) => {
      const value = params[token];
      return value === undefined ? match : String(value);
    });
  }
}
