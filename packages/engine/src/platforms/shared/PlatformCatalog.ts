/**
 * Shared source of truth for supported build/runtime platform identifiers.
 */
export class PlatformCatalog {
  static readonly WEB = 'web';
  static readonly POKI = 'poki';
  static readonly CRAZYGAMES = 'crazygames';
  static readonly YANDEX = 'yandex';
  static readonly GAMEDISTRIBUTION = 'gamedistribution';

  private static readonly SUPPORTED = new Set<string>([
    PlatformCatalog.WEB,
    PlatformCatalog.POKI,
    PlatformCatalog.CRAZYGAMES,
    PlatformCatalog.YANDEX,
    PlatformCatalog.GAMEDISTRIBUTION,
  ]);

  static getDefault(): string {
    return PlatformCatalog.WEB;
  }

  static isSupported(platformId: string): platformId is PlatformId {
    return PlatformCatalog.SUPPORTED.has(platformId);
  }

  static getSupportedList(): ReadonlyArray<string> {
    return [...PlatformCatalog.SUPPORTED];
  }
}

export type PlatformId =
  | typeof PlatformCatalog.WEB
  | typeof PlatformCatalog.POKI
  | typeof PlatformCatalog.CRAZYGAMES
  | typeof PlatformCatalog.YANDEX
  | typeof PlatformCatalog.GAMEDISTRIBUTION;
