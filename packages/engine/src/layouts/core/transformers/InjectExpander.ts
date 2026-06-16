import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { LayoutLoader } from '../LayoutLoader';
import type { JsonTransformer, TransformContext, MergeStrategy } from './types';

/** Default shallow merge: overrides overwrite same-named keys in base. */
const shallowMerge: MergeStrategy = (base, overrides) => ({ ...base, ...overrides });

/**
 * Expands `inject: "path"` directives anywhere in JSON by loading the referenced JSON
 * and replacing the object with a merged result (loaded JSON shallow-merged with local keys).
 */
export class InjectExpander implements JsonTransformer {
  constructor(
    private readonly loader: LayoutLoader,
    private readonly merge: MergeStrategy = shallowMerge,
  ) {}

  async transform(input: unknown, ctx: TransformContext): Promise<unknown> {
    return await this.expand(input, ctx);
  }

  private async expand(input: unknown, ctx: TransformContext): Promise<unknown> {
    if (Array.isArray(input)) {
      const out: unknown[] = [];
      for (const v of input) out.push(await this.expand(v, ctx));
      return out;
    }
    if (input && typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      if (typeof obj.inject === 'string') {
        const name = obj.inject;
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.LayoutInvalidConfig,
          subsystem: EngineSubsystem.Layout,
          message: 'inject directive is no longer supported. Use $include instead',
          details: { name, method: 'InjectExpander.expand' },
        });
      }
      // Walk object fields
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = await this.expand(v, ctx);
      return out;
    }
    return input;
  }
}
