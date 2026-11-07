import { LocaleCatalog } from '../common/LocaleCatalog';
import { LocaleDictionaryConfigDecoder } from '../common/LocaleDictionaryConfigDecoder';
import { LocalStorageAdapter } from './LocalStorageAdapter';

import type { SupportedLocaleCode } from '../common/LocaleCatalog';
import type { LocaleDictionary } from '../common/Locales';
import type { IStorageAdapter } from '../types';
import type { ConfigStore } from '../core/ConfigStore';

export interface LocalePreferences {
  readonly supportedLocales: readonly SupportedLocaleCode[];
  readonly defaultLocale?: SupportedLocaleCode;
  readonly deviceLocale?: string | null;
  readonly preferredLocales?: readonly string[];
  readonly storage?: IStorageAdapter;
  readonly storageKey?: string;
}

/** Dictionary lookup and persistent, observable language preferences. */
export class LocalesService {
  private current: SupportedLocaleCode = LocaleCatalog.DEFAULT;
  private supported: readonly SupportedLocaleCode[] = [LocaleCatalog.EN, LocaleCatalog.RU];
  private defaultLocale: SupportedLocaleCode = LocaleCatalog.DEFAULT;
  private storage: IStorageAdapter | undefined;
  private storageKey: string | undefined;
  private revision = 0;
  private readonly listeners = new Set<(locale: SupportedLocaleCode) => void>();
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

  initialize(options: LocalePreferences): void {
    const fallback = options.defaultLocale ?? LocaleCatalog.DEFAULT;
    if (!options.supportedLocales.includes(fallback)) throw new Error('Default locale must be supported');
    this.supported = [...new Set(options.supportedLocales)];
    this.defaultLocale = fallback;
    this.storageKey = options.storageKey;
    this.storage = options.storage;
    if (this.storageKey && !this.storage) {
      try { this.storage = new LocalStorageAdapter(); } catch { this.storage = undefined; }
    }
    let saved: string | null = null;
    if (this.storage && this.storageKey) {
      try { saved = this.storage.getItem(this.storageKey); } catch { this.storage = undefined; }
    }
    const browser = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language];
    const candidates = [saved, options.deviceLocale, ...(options.preferredLocales ?? browser)];
    const selected = candidates.map((value) => LocaleCatalog.normalize(value))
      .find((locale) => locale !== null && this.supported.includes(locale));
    this.apply(selected ?? fallback);
  }

  setLang(lang: string): void {
    const normalized = LocaleCatalog.normalize(lang);
    const selected = normalized !== null && this.supported.includes(normalized) ? normalized : this.defaultLocale;
    if (this.storage && this.storageKey) {
      try { this.storage.setItem(this.storageKey, selected); } catch { this.storage = undefined; }
    }
    this.apply(selected);
  }

  getRevision(): number { return this.revision; }

  subscribe(listener: (locale: SupportedLocaleCode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private apply(locale: SupportedLocaleCode): void {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
    if (locale === this.current) return;
    this.current = locale;
    this.revision++;
    for (const listener of this.listeners) listener(locale);
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
    const order = [this.current, ...this.fallback.filter((locale) => this.supported.includes(locale))];
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
