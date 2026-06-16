import type { ValidationIssue } from './ValidationIssue';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };
