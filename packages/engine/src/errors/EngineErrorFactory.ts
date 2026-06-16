import { EngineError } from './EngineError';

import type { EngineErrorCodeValue } from './EngineErrorCode';
import type { EngineErrorDetails } from './EngineErrorDetails';
import type { EngineSubsystemValue } from './EngineSubsystem';

interface EngineErrorFactoryInput {
  code: EngineErrorCodeValue;
  subsystem: EngineSubsystemValue;
  details?: EngineErrorDetails;
  cause?: unknown;
  message?: string;
}

export class EngineErrorFactory {
  static create(input: EngineErrorFactoryInput): EngineError {
    return new EngineError(input);
  }

  static invariant(input: EngineErrorFactoryInput): EngineError {
    return EngineErrorFactory.create(input);
  }

  static missingRequired(input: EngineErrorFactoryInput): EngineError {
    return EngineErrorFactory.create(input);
  }

  static invalidInput(input: EngineErrorFactoryInput): EngineError {
    return EngineErrorFactory.create(input);
  }

  static conflict(input: EngineErrorFactoryInput): EngineError {
    return EngineErrorFactory.create(input);
  }
}
