/**
 * Parses dimension values for layout properties, supporting absolute pixels and percentages.
 * Percentages are evaluated against the current virtual screen size along the given axis.
 *
 * Example: '50%' on axis 'w' returns half of virtual width; numbers are returned as-is.
 */
export type Axis = 'w' | 'h';

export class DimensionParser {
  constructor(
    private getWidth: () => number,
    private getHeight: () => number,
  ) {}

  /**
   * Convert a dimension value into pixels.
   * @param {unknown} value — Number (pixels) or string ending with '%' (percentage of screen).
   * @param {Axis} axis — Axis to compute percentage against: 'w' for width, 'h' for height.
   * @returns {number|undefined} Pixel value or undefined if value cannot be parsed.
   */
  parse(value: unknown, axis: Axis): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.endsWith('%')) {
      const n = parseFloat(value);
      const size = axis === 'w' ? this.getWidth() : this.getHeight();
      return size * (n / 100);
    }
    return undefined;
  }
}
