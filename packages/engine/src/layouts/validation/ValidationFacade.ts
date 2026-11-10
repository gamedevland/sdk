/**
 * One-stop validator that wires and runs all validators for a layout file.
 */
import { ValidatorRegistry } from './core/Validator';
import { ActionValidator } from './validators/ActionValidator';
import { ComponentValidator } from './validators/ComponentValidator';
import { StructuralPropsValidator } from './validators/StructuralPropsValidator';
import { ElementValidator } from './validators/ElementValidator';
import { LayoutValidator as LayoutCompositeValidator } from './validators/LayoutFileValidator';

import type { LayoutFile } from '@engine/layouts/types';
import type { ValidationResult } from '@engine/validation';

export class ValidationFacade {
  /** Validate any JSON into a typed LayoutFile or return issues. */
  validate(json: unknown): ValidationResult<LayoutFile> {
    const reg = new ValidatorRegistry();
    reg.register('display', new StructuralPropsValidator());
    reg.register('component', new ComponentValidator());
    reg.register('action', new ActionValidator());
    reg.register('element', new ElementValidator(reg));
    reg.register('layout', new LayoutCompositeValidator(reg));
    return reg.get<LayoutFile>('layout').validate(json, { path: '', registry: reg });
  }
}
