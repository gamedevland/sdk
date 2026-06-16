import { EngineErrorFormatter } from './EngineErrorFormatter';

import type { EngineErrorCodeValue } from './EngineErrorCode';
import type { EngineErrorDetails } from './EngineErrorDetails';
import type { EngineSubsystemValue } from './EngineSubsystem';

export interface EngineErrorInput {
  code: EngineErrorCodeValue;
  subsystem: EngineSubsystemValue;
  details?: EngineErrorDetails;
  cause?: unknown;
  message?: string;
}

export class EngineError extends Error {
  readonly code: EngineErrorCodeValue;
  readonly subsystem: EngineSubsystemValue;
  readonly details: EngineErrorDetails;

  constructor(input: EngineErrorInput) {
    const details = Object.freeze({ ...(input.details ?? {}) });
    const message = EngineErrorFormatter.format({
      code: input.code,
      subsystem: input.subsystem,
      details,
      ...(input.message === undefined ? {} : { explicitMessage: input.message }),
    });
    super(message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'EngineError';
    this.code = input.code;
    this.subsystem = input.subsystem;
    this.details = details;
  }
}
