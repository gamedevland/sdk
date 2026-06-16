import { RuleBasedValidator, type Rule } from '../core/RuleBasedValidator';
import { isObject } from '../rules/guards';

import type { ComponentConfig } from '@engine/layouts/types';

export class ComponentValidator extends RuleBasedValidator<ComponentConfig> {
  constructor() {
    const guard = (v: unknown): v is ComponentConfig => isObject(v) && typeof v.type === 'string';
    const rules: Rule<ComponentConfig>[] = [
      (c, ctx) =>
        c.enabled !== undefined && typeof c.enabled !== 'boolean'
          ? [{ path: ctx.path + '.enabled', message: 'enabled must be boolean' }]
          : [],
      (c, ctx) =>
        c.data !== undefined && !isObject(c.data)
          ? [{ path: ctx.path + '.data', message: 'data must be object' }]
          : [],
    ];
    super(guard, rules);
  }
}
