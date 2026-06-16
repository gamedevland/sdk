import { DiTokens } from './tokens';

import type { DiContainer } from './DiContainer';
import type { DiContainerInterface, Provider, Token } from './types';

/**
 * Engine-level DI facade with domain-specific lookup methods.
 */
export class EngineDi implements DiContainerInterface {
  constructor(private readonly container: DiContainer) {}

  register<T>(provider: Provider<T>): void {
    this.container.register(provider);
  }

  get<T>(token: Token<T>): T {
    return this.container.get(token);
  }

  createScope(): DiContainerInterface {
    return this.container.createScope();
  }

  listTokensByKind(kind: string): string[] {
    return this.container.listTokensByKind(kind);
  }

  getService<T>(name: string): T {
    return this.get<T>(DiTokens.service<T>(name));
  }

  getCommand<T>(name: string): T {
    return this.get<T>(DiTokens.command<T>(name));
  }

  getComponent<T>(name: string): T {
    return this.get<T>(DiTokens.component<T>(name));
  }

  getAction<T>(name: string): T {
    return this.get<T>(DiTokens.action<T>(name));
  }

  getElementFactory<T>(name: string): T {
    return this.get<T>(DiTokens.element<T>(name));
  }
}
