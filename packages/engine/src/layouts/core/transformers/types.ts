export interface TransformContext {
  /** Guards against cyclic includes during a single resolve pass. */
  seen: Set<string>;
}

export interface JsonTransformer {
  /**
   * Applies a transformation to the provided JSON-like structure.
   * Implementations should be pure with respect to input (no mutation).
   */
  transform(input: unknown, ctx: TransformContext): Promise<unknown> | unknown;
}

export type MergeStrategy = (
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
) => Record<string, unknown>;
