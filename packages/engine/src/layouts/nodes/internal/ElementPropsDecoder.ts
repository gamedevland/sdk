import { SchemaDecoder } from '@engine/validation';

import type { ElementConfig } from '../../types';
import type { Decoder } from '@engine/validation';

interface ElementPropsPayload {
  readonly props: Readonly<Record<string, unknown>> | undefined;
}

export class ElementPropsDecoder {
  private static readonly ELEMENT_PROPS_DECODER: Decoder<ElementPropsPayload> = SchemaDecoder.object({
    props: SchemaDecoder.optional(SchemaDecoder.record()),
  });

  constructor(private readonly sourceName: string) {}

  readProps(cfg: ElementConfig): Readonly<Record<string, unknown>> {
    const decoded = SchemaDecoder.decode(
      cfg,
      ElementPropsDecoder.ELEMENT_PROPS_DECODER,
      this.sourceName,
    );
    return decoded.props ?? Object.freeze({});
  }

  readOptionalStringProp(props: Readonly<Record<string, unknown>>, key: string): string | undefined {
    try {
      return SchemaDecoder.decode(
        props[key],
        SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
        this.sourceName,
        `$.${key}`,
      );
    } catch {
      return undefined;
    }
  }
}
