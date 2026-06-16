/**
 * Identifier that DI container uses to look up a provider.
 * Can be a string token, a symbol, a class/constructor reference, or a typed token object.
 */
export interface TokenObject<T = unknown> {
  readonly kind: string;
  readonly name: string;
  readonly key: string;
  readonly __type?: T;
}

export type Token<T = unknown> = string | symbol | (new (...args: unknown[]) => T) | TokenObject<T>;

export interface ProviderBase<T = unknown> {
  /** Token under which the value is registered */
  token: Token<T>;
  /** Lifetime policy; defaults to 'transient' */
  lifetime?: 'singleton' | 'transient';
  /** Registration source, used for diagnostics (system/module/game/etc). */
  source?: string;
  /** Explicitly allow overriding an already registered token. */
  override?: boolean;
}

export interface ProviderUseClass<T = unknown> extends ProviderBase<T> {
  /** Construct a value using a class with a zero-arg constructor */
  useClass: new (...args: unknown[]) => T;
  useFactory?: never;
  useValue?: never;
}

export interface ProviderUseFactory<T = unknown> extends ProviderBase<T> {
  /** Produce a value using a factory; receives the container for nested resolves */
  useFactory: (c: DiContainerInterface) => T;
  useClass?: never;
  useValue?: never;
}

export interface ProviderUseValue<T = unknown> extends ProviderBase<T> {
  /** Provide a pre-existing value */
  useValue: T;
  useClass?: never;
  useFactory?: never;
}

/**
 * Provider describes how to build or retrieve a value for a given token.
 * Exactly one of useClass, useFactory, or useValue should be provided.
 */
export type Provider<T = unknown> =
  | ProviderUseClass<T>
  | ProviderUseFactory<T>
  | ProviderUseValue<T>;

/**
 * Minimal interface of a DI container to enable decoupled usage.
 */
export interface DiContainerInterface {
  /** Register a provider in the current scope */
  register<T>(provider: Provider<T>): void;
  /** Read a token value, consulting parent scopes if necessary */
  get<T>(token: Token<T>): T;
  /** Create a child scope inheriting providers but isolating singleton caches */
  createScope(): DiContainerInterface;
  /**
   * Optional convenience to query tokens by kind, returning token names.
   */
  listTokensByKind?(kind: string): string[];
}
