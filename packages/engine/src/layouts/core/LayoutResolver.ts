import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

/**
 * Resolves a layout by name, applying validation and handling $include directives.
 *
 * Features:
 * - Validates loaded JSON using the ValidationFacade
 * - Supports `$include` anywhere: if an object has key `$include`, replace that object with loaded JSON
 * - Detects cyclic includes to prevent infinite recursion
 */
import { ValidationFacade } from '../validation/ValidationFacade';

import { IncludeExpander } from './transformers/IncludeExpander';

import type { ElementConfig, LayoutFile } from '../types';
import type { LayoutLoader } from './LayoutLoader';
import type { JsonTransformer } from './transformers/types';
import type { ValidationResult } from '@engine/validation';

export type ResolvedLayout = Record<string, ElementConfig>;

export class LayoutResolver {
  private readonly transformers: JsonTransformer[];

  constructor(private readonly loader: LayoutLoader) {
    this.transformers = [new IncludeExpander(this.loader)];
  }

  /**
   * Resolve and return a validated, merged layout by asset id.
   * @param {string} name — Layout asset id (for example `json/layouts/scenes/level/layout.json`).
   * @returns {Promise<ResolvedLayout>} Flat map of element ids to configs.
   * @throws {Error} On validation failures or cyclic includes.
   */
  async resolveByName(name: string): Promise<ResolvedLayout> {
    const seen = new Set<string>();
    return await this.resolveInternal(name, seen);
  }

  private async resolveInternal(name: string, seen: Set<string>): Promise<ResolvedLayout> {
    if (seen.has(name)) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.LayoutConflict,
        subsystem: EngineSubsystem.Layout,
        message: 'Cyclic layout injection detected',
        details: { name, method: 'LayoutResolver.resolveInternal' },
      });
    }
    seen.add(name);

    const json = await this.loader.loadJson(name);
    const transformed = await this.applyPipeline(json, { seen });
    const validated = new ValidationFacade().validate(transformed);
    if (!validated.ok) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: this.formatIssues(validated),
        details: { name, method: 'LayoutResolver.resolveInternal' },
      });
    }

    const out: ResolvedLayout = {};
    const entries = Object.entries(validated.value) as [string, ElementConfig][];
    for (const [id, node] of entries) {
      if (out[id]) {
        throw EngineErrorFactory.conflict({
          code: EngineErrorCode.LayoutConflict,
          subsystem: EngineSubsystem.Layout,
          message: 'Duplicate layout node id',
          details: { name, id, method: 'LayoutResolver.resolveInternal' },
        });
      }
      out[id] = node;
    }

    seen.delete(name);
    return out;
  }

  private async applyPipeline(input: unknown, ctx: { seen: Set<string> }): Promise<unknown> {
    let out = input;
    for (const t of this.transformers) out = await t.transform(out, ctx);
    return out;
  }

  private formatIssues(result: ValidationResult<LayoutFile>): string {
    if (result.ok) return 'ok';
    return result.issues
      .map((i: { path: string; message: string }) => `${i.path}: ${i.message}`)
      .join('; ');
  }

  // mergeInto removed in new semantics
}
