import type { DiToken } from './DiToken';

export class DiTokens {
  private static create<T>(kind: string, name: string): DiToken<T> {
    return Object.freeze({kind, name, key: `${kind}:${name}`});
  }
  static element<T = unknown>(name: string): DiToken<T> { return this.create('element', name); }
  static component<T = unknown>(name: string): DiToken<T> { return this.create('component', name); }
  static action<T = unknown>(name: string): DiToken<T> { return this.create('action', name); }
  static command<T = unknown>(name: string): DiToken<T> { return this.create('command', name); }
  static service<T = unknown>(name: string): DiToken<T> { return this.create('service', name); }
}
