import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { StorageNamespace } from './StorageNamespace';
import type { IStateStore, IStorageAdapter } from '../core/types';
import type { Decoder } from '@engine/validation';

export interface TypedStateStoreOptions<T> {
  readonly adapter: IStorageAdapter;
  readonly namespace: StorageNamespace;
  readonly key: string;
  readonly decoder: Decoder<T>;
  readonly defaults: () => T;
}

/**
 * Typed persistent state store with schema-based decode and default fallback.
 */
export class TypedStateStore<T> implements IStateStore<T> {
  private readonly fullKey: string;
  private readonly sourceLabel: string;

  constructor(private readonly options: TypedStateStoreOptions<T>) {
    if (!options.key || options.key.trim().length === 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.ConfigInvalidArgument,
        subsystem: EngineSubsystem.Config,
        message: 'Store key must be a non-empty string',
        details: { method: 'TypedStateStore.constructor' },
      });
    }
    this.fullKey = options.namespace.key(options.key);
    this.sourceLabel = `TypedStateStore('${this.fullKey}')`;
  }

  load(): T {
    const raw = this.options.adapter.getItem(this.fullKey);
    if (raw === null) {
      return this.options.defaults();
    }

    const parsed = this.safeParse(raw);
    if (!parsed.ok) {
      return this.options.defaults();
    }

    try {
      return SchemaDecoder.decode(parsed.value, this.options.decoder, this.sourceLabel);
    } catch {
      return this.options.defaults();
    }
  }

  save(value: T): void {
    const validated = SchemaDecoder.decode(value, this.options.decoder, `${this.sourceLabel}.save`);
    const payload = JSON.stringify(validated);
    this.options.adapter.setItem(this.fullKey, payload);
  }

  clear(): void {
    this.options.adapter.removeItem(this.fullKey);
  }

  private safeParse(raw: string): { ok: true; value: unknown } | { ok: false } {
    try {
      return { ok: true, value: JSON.parse(raw) as unknown };
    } catch {
      return { ok: false };
    }
  }
}
