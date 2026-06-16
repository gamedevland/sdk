import { RuleBasedValidator, type Rule } from '../core/RuleBasedValidator';
import { isObject } from '../rules/guards';

import type { ValidatorRegistry } from '../core/Validator';
import type {
  ActionConfig,
  ComponentConfig,
  DisplayConfig,
  ElementConfig,
} from '@engine/layouts/types';
import type { ValidationIssue } from '@engine/validation';

export class ElementValidator extends RuleBasedValidator<ElementConfig> {
  constructor(private readonly registry: ValidatorRegistry) {
    const guard = (v: unknown): v is ElementConfig => isObject(v) && typeof v.type === 'string';
    const makeRules = (registry: ValidatorRegistry): Rule<ElementConfig>[] => [
      // extends
      (el, ctx) => {
        const issues: ValidationIssue[] = [];
        const type = el.type;
        const ext = el.extends;
        if (ext !== undefined) {
          if (typeof ext !== 'string')
            issues.push({ path: ctx.path + '.extends', message: 'extends must be string' });
          if (ext === type)
            issues.push({ path: ctx.path + '.extends', message: 'extends must differ from type' });
        }
        return issues;
      },
      // props
      (el, ctx) => {
        const issues: ValidationIssue[] = [];
        if (el.props !== undefined) {
          const res = registry
            .get<DisplayConfig>('display')
            .validate(el.props, { ...ctx, path: ctx.path + '.props', registry });
          if (!res.ok) issues.push(...res.issues);
        }
        return issues;
      },
      // children
      (el, ctx) => {
        const v = el.children;
        if (v === undefined) return [];
        if (el.type !== 'Container') {
          return [{
            path: ctx.path + '.children',
            message: 'children are allowed only on Container nodes',
          }];
        }
        if (!isObject(v))
          return [{ path: ctx.path + '.children', message: 'children must be object' }];
        const issues: ValidationIssue[] = [];
        for (const [id, child] of Object.entries(v)) {
          const path = ctx.path + '.children.' + id;
          const res = registry
            .get<ElementConfig>('element')
            .validate(child, { ...ctx, path, registry });
          if (!res.ok) issues.push(...res.issues);
        }
        return issues;
      },
      // components
      (el, ctx) => {
        const v = el.components;
        if (v === undefined) return [];
        if (!isObject(v))
          return [{ path: ctx.path + '.components', message: 'components must be object' }];
        const issues: ValidationIssue[] = [];
        for (const [name, c] of Object.entries(v)) {
          const res = registry
            .get<ComponentConfig>('component')
            .validate(c, { ...ctx, path: ctx.path + `.components.${name}`, registry });
          if (!res.ok) issues.push(...res.issues);
        }
        return issues;
      },
      // actions
      (el, ctx) => {
        const v = el.actions;
        if (v === undefined) return [];
        if (!isObject(v))
          return [{ path: ctx.path + '.actions', message: 'actions must be object' }];
        const issues: ValidationIssue[] = [];
        for (const [name, a] of Object.entries(v)) {
          const res = registry
            .get<ActionConfig>('action')
            .validate(a, { ...ctx, path: ctx.path + `.actions.${name}`, registry });
          if (!res.ok) issues.push(...res.issues);
        }
        return issues;
      },
    ];
    super(guard, makeRules(registry));
  }
}
