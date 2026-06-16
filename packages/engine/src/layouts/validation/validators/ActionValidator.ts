import { RuleBasedValidator, type Rule } from '../core/RuleBasedValidator';
import { isObject } from '../rules/guards';

import type { ActionConfig } from '@engine/layouts/types';

export class ActionValidator extends RuleBasedValidator<ActionConfig> {
  constructor() {
    const guard = (v: unknown): v is ActionConfig => {
      if (!isObject(v)) return false;
      return typeof v.type === 'string';
    };
    const rules: Rule<ActionConfig>[] = [
      (a, ctx) =>
        a.data !== undefined && !isObject(a.data)
          ? [{ path: ctx.path + '.data', message: 'data must be object' }]
          : [],
    ];
    super(guard, rules);
  }
}
