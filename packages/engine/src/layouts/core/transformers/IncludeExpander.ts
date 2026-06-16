import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { JsonTransformer, TransformContext, MergeStrategy } from './types';
import type { LayoutLoader } from '../LayoutLoader';

/** Default shallow merge: overrides overwrite same-named keys in base. */
const shallowMerge: MergeStrategy = (base, overrides) => ({ ...base, ...overrides });

/**
 * Expands `$include: "path"` directives anywhere in JSON by loading the referenced JSON
 * and replacing the object with a merged result (loaded JSON shallow-merged with local keys).
 */
export class IncludeExpander implements JsonTransformer {
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
      if (typeof obj.$include === 'string') {
        const name = obj.$include;
        if (ctx.seen.has(name)) {
          throw EngineErrorFactory.conflict({
            code: EngineErrorCode.LayoutConflict,
            subsystem: EngineSubsystem.Layout,
            message: 'Cyclic layout include detected',
            details: { name, method: 'IncludeExpander.expand' },
          });
        }
        ctx.seen.add(name);
        const loaded = await this.loader.loadJson(name);
        const expanded = (await this.expand(loaded, ctx)) as Record<string, unknown>;
        ctx.seen.delete(name);
        const { $include: _include, ...rest } = obj;
        // Expand overrides (rest) recursively to support sibling includes
        const restExpanded: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          restExpanded[k] = await this.expand(v, ctx);
        }
        return this.merge(expanded, restExpanded);
      }
      // Walk object fields
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = await this.expand(v, ctx);
      return out;
    }
    return input;
  }
}
