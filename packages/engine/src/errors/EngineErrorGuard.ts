import { EngineError } from './EngineError';
import { EngineErrorCode } from './EngineErrorCode';
import { EngineErrorFactory } from './EngineErrorFactory';
import { EngineSubsystem } from './EngineSubsystem';

import type { EngineErrorDetails } from './EngineErrorDetails';

interface EngineErrorNormalizeFallback {
  subsystem: string;
  code: string;
  details?: EngineErrorDetails;
  message?: string;
}

export class EngineErrorGuard {
  static isEngineError(value: unknown): value is EngineError {
    return value instanceof EngineError;
  }

  static normalize(error: unknown, fallback: EngineErrorNormalizeFallback): EngineError {
    if (EngineErrorGuard.isEngineError(error)) {
      return error;
    }

    const details: Record<string, string | number | boolean | null | undefined> = {
      ...(fallback.details ?? {}),
    };

    if (error instanceof Error) {
      details.originalName = error.name;
      details.originalMessage = error.message;
    } else {
      details.originalValue = String(error);
    }

    return EngineErrorFactory.create({
      subsystem: EngineSubsystem.isKnown(fallback.subsystem) ? fallback.subsystem : EngineSubsystem.Unknown,
      code: EngineErrorCode.isKnown(fallback.code) ? fallback.code : EngineErrorCode.CoreInvariantViolation,
      details,
      ...(fallback.message === undefined ? {} : { message: fallback.message }),
      cause: error,
    });
  }
}
