import { SchemaDecoder as S } from '../../validation';
import type { ConcurrencyConfig, RetryConfig } from '../types';
/** Validate policy before it can create an infinite queue or retry loop. */
export class AssetLoadPolicy {
  private static readonly decoder = S.strictObject({
    retry: S.strictObject({
      retries: S.number({ integer: true, min: 0 }),
      backoffMs: S.number({ min: 0 }),
      backoffFactor: S.number({ min: 1 }),
      timeoutMs: S.number({ min: Number.MIN_VALUE }),
    }),
    concurrency: S.strictObject({ maxParallel: S.number({ integer: true, min: 1 }) }),
  });
  static validate(retry: RetryConfig, concurrency: ConcurrencyConfig): void {
    S.decode({ retry, concurrency }, this.decoder, 'AssetManager.options');
  }
}
