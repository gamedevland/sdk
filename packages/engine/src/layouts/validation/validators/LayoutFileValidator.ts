import { RuleBasedValidator, type Rule } from '../core/RuleBasedValidator';
import { LayoutGuards } from '../rules/guards';

import type { ValidatorRegistry } from '../core/Validator';
import type { ElementConfig, LayoutFile } from '@engine/layouts/types';
import type { ValidationIssue } from '@engine/validation';

export class LayoutValidator extends RuleBasedValidator<LayoutFile> {
  constructor(private readonly registry: ValidatorRegistry) {
    const guard = (v: unknown): v is LayoutFile => LayoutGuards.isObject(v);
    const rules: Rule<LayoutFile>[] = [
      (obj, ctx) => {
        const issues: ValidationIssue[] = [];
        for (const [id, val] of Object.entries(obj)) {
          const path = ctx.path ? `${ctx.path}.${id}` : id;
          if (!/^[A-Za-z0-9_\-.]+$/.test(id)) {
            issues.push({ path, message: 'Invalid id format. Use [A-Za-z0-9_-.]' });
            continue;
          }
          const res = this.registry
            .get<ElementConfig>('element')
            .validate(val, { ...ctx, path, registry: this.registry });
          if (!res.ok) issues.push(...res.issues);
        }
        return issues;
      },
    ];
    super(guard, rules);
  }
}
