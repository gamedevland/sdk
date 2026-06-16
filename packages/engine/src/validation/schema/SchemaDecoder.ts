import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

export interface DecodeContext {
  readonly source: string;
  readonly path: string;
}

export type Decoder<T> = (input: unknown, context: DecodeContext) => T;

type DecoderShape = Record<string, Decoder<unknown>>;

export type InferDecoded<TDecoder extends Decoder<unknown>> =
  TDecoder extends Decoder<infer TValue> ? TValue : never;

export type InferObject<TShape extends DecoderShape> = {
  [K in keyof TShape]: InferDecoded<TShape[K]>;
};

interface NumberDecoderOptions {
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

interface StringDecoderOptions {
  readonly defaultValue?: string;
  readonly nonEmpty?: boolean;
}

interface BooleanDecoderOptions {
  readonly defaultValue?: boolean;
}

interface RecordDecoderOptions {
  readonly defaultValue?: Record<string, unknown>;
}

interface EnumDecoderOptions<TValue extends string> {
  readonly defaultValue?: TValue;
}

export class SchemaDecoder {
  static decode<T>(input: unknown, decoder: Decoder<T>, source: string, path: string = '$'): T {
    return decoder(input, { source, path });
  }

  static optional<T>(decoder: Decoder<T>): Decoder<T | undefined> {
    return (input: unknown, context: DecodeContext): T | undefined => {
      if (input === undefined) {
        return undefined;
      }
      return decoder(input, context);
    };
  }

  static unknown<T = unknown>(options?: { defaultValue?: T }): Decoder<T | unknown> {
    return (input: unknown): T | unknown => {
      if (input === undefined && options && 'defaultValue' in options) {
        return options.defaultValue as T;
      }
      return input;
    };
  }

  static number(options?: NumberDecoderOptions): Decoder<number> {
    return (input: unknown, context: DecodeContext): number => {
      if (typeof input !== 'number' || !Number.isFinite(input)) {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as number;
        }
        SchemaDecoder.fail(context, 'finite number', input);
      }

      if (options?.integer && !Number.isInteger(input)) {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as number;
        }
        SchemaDecoder.fail(context, 'integer number', input);
      }

      if (options?.min !== undefined && input < options.min) {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as number;
        }
        SchemaDecoder.fail(context, `number >= ${options.min}`, input);
      }

      if (options?.max !== undefined && input > options.max) {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as number;
        }
        SchemaDecoder.fail(context, `number <= ${options.max}`, input);
      }

      return input;
    };
  }

  static string(options?: StringDecoderOptions): Decoder<string> {
    return (input: unknown, context: DecodeContext): string => {
      if (typeof input !== 'string') {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as string;
        }
        SchemaDecoder.fail(context, 'string', input);
      }

      if (options?.nonEmpty && input.length === 0) {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as string;
        }
        SchemaDecoder.fail(context, 'non-empty string', input);
      }

      return input;
    };
  }

  static boolean(options?: BooleanDecoderOptions): Decoder<boolean> {
    return (input: unknown, context: DecodeContext): boolean => {
      if (typeof input !== 'boolean') {
        if (options && 'defaultValue' in options) {
          return options.defaultValue as boolean;
        }
        SchemaDecoder.fail(context, 'boolean', input);
      }
      return input;
    };
  }

  static enumOf<TValue extends string>(
    values: readonly TValue[],
    options?: EnumDecoderOptions<TValue>,
  ): Decoder<TValue> {
    return (input: unknown, context: DecodeContext): TValue => {
      if (typeof input === 'string') {
        for (const value of values) {
          if (value === input) {
            return value;
          }
        }
      }

      if (options && 'defaultValue' in options) {
        return options.defaultValue as TValue;
      }
      SchemaDecoder.fail(context, `one of [${values.join(', ')}]`, input);
    };
  }

  static record(options?: RecordDecoderOptions): Decoder<Record<string, unknown>> {
    return (input: unknown, context: DecodeContext): Record<string, unknown> => {
      if (SchemaDecoder.isRecord(input)) {
        return input;
      }
      if (options && 'defaultValue' in options) {
        return options.defaultValue as Record<string, unknown>;
      }
      SchemaDecoder.fail(context, 'record', input);
    };
  }

  static object<TShape extends DecoderShape>(shape: TShape): Decoder<InferObject<TShape>> {
    return (input: unknown, context: DecodeContext): InferObject<TShape> => {
      if (input !== undefined && !SchemaDecoder.isRecord(input)) {
        SchemaDecoder.fail(context, 'object', input);
      }
      const source: Record<string, unknown> = SchemaDecoder.isRecord(input) ? input : {};
      const result: Partial<InferObject<TShape>> = {};

      const keys = Object.keys(shape) as Array<keyof TShape>;
      for (const key of keys) {
        const decoder = shape[key];
        if (!decoder) {
          throw EngineErrorFactory.invalidInput({
            code: EngineErrorCode.ConfigInvalidSchema,
            subsystem: EngineSubsystem.Config,
            message: 'Decoder for object key is not defined',
            details: { key: String(key), source: context.source, path: context.path },
          });
        }
        const value = source[key as string];
        (result as Record<string, unknown>)[key as string] = decoder(
          value,
          SchemaDecoder.childContext(context, String(key)),
        );
      }

      return result as InferObject<TShape>;
    };
  }

  static array<T>(itemDecoder: Decoder<T>): Decoder<readonly T[]> {
    return (input: unknown, context: DecodeContext): readonly T[] => {
      if (!Array.isArray(input)) {
        SchemaDecoder.fail(context, 'array', input);
      }

      const result: T[] = [];
      for (let index = 0; index < input.length; index += 1) {
        result.push(itemDecoder(input[index], SchemaDecoder.arrayItemContext(context, index)));
      }
      return result;
    };
  }

  static readonlyArray<T>(itemDecoder: Decoder<T>): Decoder<readonly T[]> {
    return SchemaDecoder.array(itemDecoder);
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static describeType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private static fail(context: DecodeContext, expected: string, actual: unknown): never {
    throw EngineErrorFactory.invalidInput({
      code: EngineErrorCode.ConfigInvalidSchema,
      subsystem: EngineSubsystem.Config,
      message: `${context.source} expected ${expected} at '${context.path}'`,
      details: { actualType: SchemaDecoder.describeType(actual), source: context.source, path: context.path },
    });
  }

  private static childContext(context: DecodeContext, key: string): DecodeContext {
    return {
      source: context.source,
      path: `${context.path}.${key}`,
    };
  }

  private static arrayItemContext(context: DecodeContext, index: number): DecodeContext {
    return {
      source: context.source,
      path: `${context.path}[${index}]`,
    };
  }
}
