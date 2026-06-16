import type { ValidationResult } from './ValidationResult';

export interface Validator<T> {
  validate(value: unknown, ctx: ValidationContext): ValidationResult<T>;
}

export interface ValidationContext {
  path: string;
  registry: ValidatorRegistry;
}

export class ValidatorRegistry {
  private map = new Map<string, Validator<unknown>>();

  register<T>(name: string, validator: Validator<T>): void {
    this.map.set(name, validator);
  }

  get<T>(name: string): Validator<T> {
    const validator = this.map.get(name);
    if (!validator) {
      throw new Error(`Validator '${name}' is not registered`);
    }
    return validator as Validator<T>;
  }
}
