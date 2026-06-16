import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { Decoder } from '@engine/validation';

export interface CommandPointerPayload {
  readonly pointerId: number;
  readonly virtualX: number;
  readonly virtualY: number;
}

type DecodeOptionalResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly message: string };

export class CommandEventPayloadReader {
  private static readonly POINTER_KEYS = ['pointerId', 'virtualX', 'virtualY'] as const;
  private static readonly POINTER_DECODER: Decoder<CommandPointerPayload> = SchemaDecoder.object({
    pointerId: SchemaDecoder.number({ integer: true }),
    virtualX: SchemaDecoder.number(),
    virtualY: SchemaDecoder.number(),
  });

  private readonly payload: Record<string, unknown> | undefined;

  constructor(
    data: Record<string, unknown> | undefined,
    private readonly sourceName: string = 'Command',
  ) {
    this.payload = this.resolvePayload(data);
  }

  readNonEmptyString(key: string): string | undefined {
    return this.readOptionalDecoded(key, SchemaDecoder.string({ nonEmpty: true }));
  }

  readFiniteNumber(key: string): number | undefined {
    return this.readOptionalDecoded(key, SchemaDecoder.number());
  }

  readUnknown(key: string): unknown {
    return this.payload?.[key];
  }

  readDecoded<T>(key: string, decoder: Decoder<T>): T | undefined {
    return this.readOptionalDecoded(key, decoder);
  }

  decodePayload<T>(decoder: Decoder<T>, sourceName?: string): T {
    try {
      return SchemaDecoder.decode(this.payload ?? {}, decoder, sourceName ?? `${this.sourceName}.payload`);
    } catch (error) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CommandInvalidPayload,
        subsystem: EngineSubsystem.Command,
        message: 'Command payload has invalid shape',
        details: {
          source: this.sourceName,
          method: 'CommandEventPayloadReader.decodePayload',
          reason: this.resolveErrorMessage(error),
        },
      });
    }
  }

  readPointer(): CommandPointerPayload | undefined {
    const result = this.decodePointer();
    return result.status === 'ok' ? result.value : undefined;
  }

  requireFiniteNumber(key: string): number {
    return this.requireDecoded(key, SchemaDecoder.number());
  }

  requireNonEmptyString(key: string): string {
    return this.requireDecoded(key, SchemaDecoder.string({ nonEmpty: true }));
  }

  requirePointer(): CommandPointerPayload {
    const result = this.decodePointer();
    if (result.status === 'missing') {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CommandMissingRequired,
        subsystem: EngineSubsystem.Command,
        message: 'Pointer payload is required',
        details: { source: this.sourceName, method: 'CommandEventPayloadReader.requirePointer' },
      });
    }
    if (result.status === 'invalid') {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CommandInvalidPayload,
        subsystem: EngineSubsystem.Command,
        message: 'Pointer payload has invalid type',
        details: { source: this.sourceName, reason: result.message },
      });
    }
    return result.value;
  }

  requireDecoded<T>(key: string, decoder: Decoder<T>): T {
    const result = this.decodeOptional(key, decoder);
    if (result.status === 'missing') {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CommandMissingRequired,
        subsystem: EngineSubsystem.Command,
        message: 'Required command payload key is missing',
        details: { source: this.sourceName, key, method: 'CommandEventPayloadReader.requireDecoded' },
      });
    }
    if (result.status === 'invalid') {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.CommandInvalidPayload,
        subsystem: EngineSubsystem.Command,
        message: 'Command payload key has invalid type',
        details: { source: this.sourceName, key, reason: result.message },
      });
    }
    return result.value;
  }

  private resolvePayload(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    const envelope = SchemaDecoder.decode(
      data,
      SchemaDecoder.object({
        event: SchemaDecoder.optional(
          SchemaDecoder.object({
            payload: SchemaDecoder.optional(SchemaDecoder.record()),
            data: SchemaDecoder.optional(SchemaDecoder.record()),
          }),
        ),
      }),
      `${this.sourceName}.input`,
    );
    if (envelope.event !== undefined) {
      return envelope.event.payload ?? envelope.event.data;
    }
    return data;
  }

  private readOptionalDecoded<T>(key: string, decoder: Decoder<T>): T | undefined {
    const result = this.decodeOptional(key, decoder);
    return result.status === 'ok' ? result.value : undefined;
  }

  private decodeOptional<T>(key: string, decoder: Decoder<T>): DecodeOptionalResult<T> {
    const value = this.payload?.[key];
    if (value === undefined) {
      return { status: 'missing' };
    }

    try {
      return {
        status: 'ok',
        value: SchemaDecoder.decode(value, decoder, `${this.sourceName}.payload`, `$.${key}`),
      };
    } catch (error) {
      return { status: 'invalid', message: this.resolveErrorMessage(error) };
    }
  }

  private decodePointer(): DecodeOptionalResult<CommandPointerPayload> {
    if (!this.payload) {
      return { status: 'missing' };
    }
    if (!this.hasAnyPointerKey()) {
      return { status: 'missing' };
    }

    try {
      return {
        status: 'ok',
        value: SchemaDecoder.decode(
          this.payload,
          CommandEventPayloadReader.POINTER_DECODER,
          `${this.sourceName}.payload`,
        ),
      };
    } catch (error) {
      return { status: 'invalid', message: this.resolveErrorMessage(error) };
    }
  }

  private hasAnyPointerKey(): boolean {
    if (!this.payload) {
      return false;
    }
    for (const key of CommandEventPayloadReader.POINTER_KEYS) {
      if (Object.prototype.hasOwnProperty.call(this.payload, key)) {
        return true;
      }
    }
    return false;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'unknown decode error';
  }
}
