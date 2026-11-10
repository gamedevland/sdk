import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';


import type { DiContainerInterface, Provider, Token } from './types';

type ProviderRecord = Provider & { lifetime: 'singleton' | 'transient' };
type NormalizedToken = string | symbol | (new (...args: unknown[]) => unknown);

export class DiContainer implements DiContainerInterface {
  private readonly parent: DiContainer | undefined;
  private readonly providers = new Map<NormalizedToken, ProviderRecord>();
  private readonly singletons = new Map<NormalizedToken, unknown>();

  constructor(parent?: DiContainer) {
    this.parent = parent;
  }

  register<T>(provider: Provider<T>): void {
    this.assertProviderShape(provider);

    const key = this.normalizeToken(provider.token);
    const normalized: ProviderRecord = {
      ...provider,
      lifetime: provider.lifetime ?? 'transient',
    };

    this.assertRegistrationAllowed(key, normalized);
    this.providers.set(key, normalized);
    this.singletons.delete(key);
  }

  get<T>(token: Token<T>): T {
    const key = this.normalizeToken(token);
    const resolved = this.getProviderByKey(key);
    if (!resolved) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.DiProviderNotFound,
        subsystem: EngineSubsystem.Di,
        message: 'Provider not found for token',
        details: { token: this.tokenToDebugString(token) },
      });
    }
    const { provider, owner } = resolved;

    if (provider.lifetime === 'singleton') {
      if (owner.singletons.has(key)) return owner.singletons.get(key) as T;
      const instance = owner.instantiate(provider);
      owner.singletons.set(key, instance);
      return instance as T;
    }

    return this.instantiate(provider) as T;
  }

  createScope(): DiContainerInterface {
    return new DiContainer(this);
  }

  listTokensByKind(kind: string): string[] {
    const local = Array.from(this.providers.keys())
      .map((k) => (typeof k === 'string' ? k : undefined))
      .filter((k): k is string => !!k && k.startsWith(`${kind}:`))
      .map((k) => k.substring(kind.length + 1));

    if (!this.parent) return local;
    const parent = this.parent.listTokensByKind(kind);
    return Array.from(new Set([...parent, ...local]));
  }

  private instantiate(provider: ProviderRecord): unknown {
    if ('useValue' in provider) return provider.useValue;
    if ('useFactory' in provider) return provider.useFactory(this);
    if ('useClass' in provider) return new provider.useClass();
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.DiInvalidProvider,
      subsystem: EngineSubsystem.Di,
      message: 'Invalid provider definition',
      details: { method: 'DiContainer.instantiate' },
    });
  }

  private assertProviderShape<T>(provider: Provider<T>): void {
    const hasClass = 'useClass' in provider;
    const hasFactory = 'useFactory' in provider;
    const hasValue = 'useValue' in provider;
    const count = [hasClass, hasFactory, hasValue].filter(Boolean).length;
    if (count === 1) return;
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.DiInvalidProvider,
      subsystem: EngineSubsystem.Di,
      message: 'Provider must define exactly one source: useClass/useFactory/useValue',
      details: {
        token: this.tokenToDebugString(provider.token),
      },
    });
  }

  private assertRegistrationAllowed(key: NormalizedToken, provider: ProviderRecord): void {
    const existing = this.getProviderByKey(key);
    if (!existing) return;

    const tokenDebug = this.tokenToDebugString(key);
    const existingSource = existing.provider.source ?? 'any';
    const incomingSource = provider.source ?? 'any';

    if (existingSource === 'system') {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.DiForbiddenOverride,
        subsystem: EngineSubsystem.Di,
        message: 'Overriding system token is forbidden',
        details: { token: tokenDebug, existingSource, incomingSource },
      });
    }

    if (!provider.override) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.DiDuplicateProvider,
        subsystem: EngineSubsystem.Di,
        message: 'Duplicate provider registration without override',
        details: { token: tokenDebug, existingSource, incomingSource },
      });
    }
  }

  private getProviderByKey(
    key: NormalizedToken,
  ): { provider: ProviderRecord; owner: DiContainer } | undefined {
    const local = this.providers.get(key);
    if (local) {
      return { provider: local, owner: this };
    }
    return this.parent?.getProviderByKey(key);
  }

  private normalizeToken<T>(token: Token<T>): NormalizedToken {
    if (typeof token === 'string' || typeof token === 'symbol') return token;
    if (typeof token === 'function') return token as NormalizedToken;
    return token.key;
  }

  private tokenToDebugString<T>(token: Token<T> | NormalizedToken): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return String(token);
    if (typeof token === 'function') return token.name || '[anonymous-constructor]';
    return token.key;
  }
}
