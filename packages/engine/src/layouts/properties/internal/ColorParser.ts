import { Color } from 'pixi.js';

/**
 * Unified color parser for layout properties.
 * Accepts numbers, hex strings ("#fff"/"#ffffff"), 0x-prefixed hex, CSS color names,
 * rgba()/rgb() strings, and decimal numeric strings. Arrays are normalized by taking the first item.
 */
export class ColorParser {
  /** Parses arbitrary input into a Pixi-compatible numeric color. */
  parseToNumber(input: unknown): number | undefined {
    if (input === null || input === undefined) return undefined;
    const value = Array.isArray(input)
      ? (input as unknown[]).length > 0
        ? (input as unknown[])[0]
        : undefined
      : input;
    if (value === undefined) return undefined;

    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string') return undefined;

    const s = value.trim();
    if (!s) return undefined;

    // Handle 0x-prefixed hex explicitly for consistency
    if (s.startsWith('0x') || s.startsWith('0X')) {
      const hex = s.slice(2);
      if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
      return undefined;
    }

    // Decimal numeric string
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    }

    // Fallback to Pixi Color for #hex, named colors, rgb/rgba strings, etc.
    try {
      return new Color(s).toNumber();
    } catch {
      return undefined;
    }
  }
}

export default ColorParser;
