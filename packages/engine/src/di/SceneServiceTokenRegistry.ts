import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { Token } from './types';

export class SceneServiceTokenRegistry {
  private readonly tokens: Token<unknown>[] = [];
  private readonly tokenKeys = new Set<string>();

  add(token: Token<unknown>): this {
    this.assertValidToken(token);
    const key = this.toKey(token);
    if (this.tokenKeys.has(key)) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.DiDuplicateProvider,
        subsystem: EngineSubsystem.Di,
        message: 'Duplicate scene service token',
        details: {
          legacyCode: 'DI_CFG_007',
          stage: 'di-build',
          token: this.toDebugString(token),
        },
      });
    }
    this.tokenKeys.add(key);
    this.tokens.push(token);
    return this;
  }

  toTokens(): readonly Token<unknown>[] {
    return [...this.tokens];
  }

  private assertValidToken(token: Token<unknown>): void {
    if (typeof token === 'string') {
      if (token.trim().length > 0) {
        return;
      }
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.DiInvalidConfig,
        subsystem: EngineSubsystem.Di,
        message: 'Invalid empty scene service token',
        details: { legacyCode: 'DI_CFG_006', stage: 'di-build', token: '' },
      });
    }
    if (typeof token === 'symbol') {
      return;
    }
    if (typeof token === 'function') {
      return;
    }
    if (token && typeof token === 'object' && typeof token.key === 'string' && token.key.length > 0) {
      return;
    }
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.DiInvalidConfig,
      subsystem: EngineSubsystem.Di,
      message: 'Invalid scene service token',
      details: {
        legacyCode: 'DI_CFG_006',
        stage: 'di-build',
        token: this.toDebugString(token),
      },
    });
  }

  private toKey(token: Token<unknown>): string {
    if (typeof token === 'string') return `s:${token}`;
    if (typeof token === 'symbol') return `y:${String(token)}`;
    if (typeof token === 'function') return `c:${token.name || '[anonymous-constructor]'}`;
    return `o:${token.key}`;
  }

  private toDebugString(token: unknown): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return String(token);
    if (typeof token === 'function') return token.name || '[anonymous-constructor]';
    if (token && typeof token === 'object' && 'key' in token) {
      const tokenWithKey = token as { key?: unknown };
      if (typeof tokenWithKey.key === 'string') {
        return tokenWithKey.key;
      }
    }
    return String(token);
  }
}
