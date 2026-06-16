import { RuleBasedValidator, type Rule } from '../core/RuleBasedValidator';
import { isObject, isDim } from '../rules/guards';

import type { DisplayConfig } from '@engine/layouts/types';
import type { ValidationIssue } from '@engine/validation';

export class DisplayValidator extends RuleBasedValidator<DisplayConfig> {
  constructor() {
    const guard = (v: unknown): v is DisplayConfig => isObject(v);
    const rules: Rule<DisplayConfig>[] = [
      (d, ctx) => {
        const issues: ValidationIssue[] = [];
        const checkDim = (k: keyof DisplayConfig) => {
          const val = d[k];
          if (val !== undefined && !isDim(val))
            issues.push({
              path: ctx.path + '.' + k,
              message: `${String(k)} must be number or percent`,
            });
        };
        const keys: Array<keyof DisplayConfig> = [
          'x',
          'y',
          'cx',
          'cy',
          'gx',
          'gy',
          'width',
          'height',
        ];
        keys.forEach((k) => checkDim(k));
        if (d.scale !== undefined && !(typeof d.scale === 'number' || isObject(d.scale)))
          issues.push({ path: ctx.path + '.scale', message: 'scale must be number or object' });
        if (d.pivot !== undefined && !isObject(d.pivot))
          issues.push({ path: ctx.path + '.pivot', message: 'pivot must be object' });
        if (d.anchor !== undefined && !(typeof d.anchor === 'number' || isObject(d.anchor)))
          issues.push({ path: ctx.path + '.anchor', message: 'anchor must be number or object' });
        return issues;
      },
    ];
    super(guard, rules);
  }
}
