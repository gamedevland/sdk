import { EngineErrorCode } from './EngineErrorCode';

import type { EngineErrorCodeValue } from './EngineErrorCode';
import type { EngineErrorDetails } from './EngineErrorDetails';

interface EngineErrorMessageInput {
  code: string;
  subsystem: string;
  details: EngineErrorDetails;
  explicitMessage?: string;
}

export class EngineErrorFormatter {
  private static readonly DefaultMessages: Readonly<Record<EngineErrorCodeValue, string>> = {
    [EngineErrorCode.CoreInvalidArgument]: 'invalid argument',
    [EngineErrorCode.CoreMissingRequired]: 'required resource is missing',
    [EngineErrorCode.CoreInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.CoreInvariantViolation]: 'invariant violation',
    [EngineErrorCode.SceneInvalidArgument]: 'invalid argument',
    [EngineErrorCode.SceneInvalidState]: 'invariant violation',
    [EngineErrorCode.SceneLifecycleFailure]: 'scene lifecycle hook failure',
    [EngineErrorCode.DiInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.DiProviderNotFound]: 'provider not found',
    [EngineErrorCode.DiInvalidProvider]: 'invalid provider definition',
    [EngineErrorCode.DiDuplicateProvider]: 'duplicate provider',
    [EngineErrorCode.DiForbiddenOverride]: 'forbidden provider override',
    [EngineErrorCode.DiUnresolvableToken]: 'unresolvable token',
    [EngineErrorCode.AssetMissingRequired]: 'required resource is missing',
    [EngineErrorCode.AssetInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.AssetConflict]: 'conflict detected',
    [EngineErrorCode.AssetLoadFailure]: 'asset load failed',
    [EngineErrorCode.LayoutMissingRequired]: 'required resource is missing',
    [EngineErrorCode.LayoutInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.LayoutConflict]: 'conflict detected',
    [EngineErrorCode.LayoutInvariantViolation]: 'layout invariant violation',
    [EngineErrorCode.AudioMissingRequired]: 'required resource is missing',
    [EngineErrorCode.AudioInvalidArgument]: 'invalid argument',
    [EngineErrorCode.AudioInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.AudioConflict]: 'invalid runtime state',
    [EngineErrorCode.ParticleMissingRequired]: 'required resource is missing',
    [EngineErrorCode.ParticleInvalidArgument]: 'invalid argument',
    [EngineErrorCode.ParticleInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.ParticleInvariantViolation]: 'invariant violation',
    [EngineErrorCode.ParticleRuntimeFailure]: 'runtime operation failed',
    [EngineErrorCode.PrefabMissingRequired]: 'required resource is missing',
    [EngineErrorCode.PrefabInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.PrefabConflict]: 'invalid runtime state',
    [EngineErrorCode.PrefabInvariantViolation]: 'invariant violation',
    [EngineErrorCode.FsmInvalidConfig]: 'invalid configuration',
    [EngineErrorCode.FsmInvalidState]: 'invalid runtime state',
    [EngineErrorCode.CommandMissingRequired]: 'required resource is missing',
    [EngineErrorCode.CommandInvalidPayload]: 'invalid command payload',
    [EngineErrorCode.ConfigMissingRequired]: 'required resource is missing',
    [EngineErrorCode.ConfigInvalidArgument]: 'invalid argument',
    [EngineErrorCode.ConfigInvalidSchema]: 'invalid configuration',
  };

  static format(input: EngineErrorMessageInput): string {
    const baseMessage = input.explicitMessage ?? EngineErrorFormatter.defaultMessage(input.code);
    const detailsPart = EngineErrorFormatter.formatDetails(input.details);
    if (!detailsPart) {
      return `[${input.code}][${input.subsystem}] ${baseMessage}`;
    }
    return `[${input.code}][${input.subsystem}] ${baseMessage} | ${detailsPart}`;
  }

  private static defaultMessage(code: string): string {
    if (EngineErrorCode.isKnown(code)) {
      return EngineErrorFormatter.DefaultMessages[code];
    }
    return 'engine runtime error';
  }

  private static formatDetails(details: EngineErrorDetails): string {
    const keys = Object.keys(details).sort((left, right) => left.localeCompare(right));
    if (keys.length === 0) {
      return '';
    }

    const parts: string[] = [];
    for (const key of keys) {
      const value = details[key];
      if (value === undefined) {
        continue;
      }
      parts.push(`${key}=${EngineErrorFormatter.stringifyValue(value)}`);
    }
    return parts.join(', ');
  }

  private static stringifyValue(value: string | number | boolean | null): string {
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    if (value === null) {
      return 'null';
    }
    return String(value);
  }
}
