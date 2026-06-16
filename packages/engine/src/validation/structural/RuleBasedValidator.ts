import type { ValidationIssue } from './ValidationIssue';
import type { ValidationResult } from './ValidationResult';
import type { ValidationContext, Validator } from './Validator';

export type Rule<T> = (value: T, ctx: ValidationContext) => ValidationIssue[];

export class RuleBasedValidator<T> implements Validator<T> {
  constructor(
    private readonly guard: (value: unknown) => value is T,
    private readonly rules: Rule<T>[],
    private readonly invalidTypeMessage = 'Invalid type',
  ) {}

  validate(value: unknown, ctx: ValidationContext): ValidationResult<T> {
    if (!this.guard(value)) {
      return {
        ok: false,
        issues: [{ path: ctx.path, message: this.invalidTypeMessage }],
      };
    }
    const issues = this.rules.flatMap((rule) => rule(value, ctx));
    if (issues.length > 0) {
      return { ok: false, issues };
    }
    return { ok: true, value };
  }
}
