import { SchemaDecoder } from '../../../validation/schema/SchemaDecoder';
import type { ValidationResult } from '../../../validation/structural/ValidationResult';
export class StructuralPropsValidator {
  validate(value: unknown): ValidationResult<Record<string, unknown>> {
    try { return {ok: true, value: SchemaDecoder.decode(value, SchemaDecoder.record(), 'layout.props')}; }
    catch (error) { return {ok: false, issues: [{path: 'props', message: error instanceof Error ? error.message : String(error)}]}; }
  }
}
