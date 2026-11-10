/**
 * Public entry point of the engine package.
 * Re-exports only stable subsystem barrels.
 */
export * from './assets';
export * from './audio';
export * from './commands';
export * from './configs';
export * from './core';
export * from './di';
export * from './errors';
export * from './events';
export * from './fsm';
export * from './input';
export * from './layouts';
export * from './platforms';
export * from './prefabs';
export * from './scenes';
export * from './screen';
export * from './tween';
export { RuleBasedValidator, SchemaDecoder, ValidatorRegistry } from './validation';
export type {
  DecodeContext,
  Decoder,
  InferDecoded,
  InferObject,
  Rule,
  ValidationContext,
  ValidationIssue as StructuralValidationIssue,
  ValidationResult as StructuralValidationResult,
  Validator,
} from './validation';

export * from './rendering';
export { DisposalScope } from './lifecycle';
export * from './diagnostics';
export { PresentationScheduler } from './runtime/PresentationScheduler';
export type { PresentationPhase, PresentationOptions } from './runtime/PresentationScheduler';
