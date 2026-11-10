/** Structural layout guards shared by the rule-based validators. */
export class LayoutGuards {
  static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  static isPercentString(value: unknown): boolean {
    return typeof value === 'string' && /^-?\d+(?:\.\d+)?%$/.test(value);
  }
  static isDim(value: unknown): boolean {
    return (typeof value === 'number' && Number.isFinite(value)) || this.isPercentString(value);
  }
}
