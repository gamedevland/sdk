/** True for plain object (non-null and not an array). */
export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** True if string is a percent format like '12%' or '-0.5%'. */
export const isPercentString = (v: unknown): boolean =>
  typeof v === 'string' && /^-?\d+(?:\.\d+)?%$/.test(v);

/** Dimension guard: allows number (pixels) or percent string. */
export const isDim = (v: unknown): boolean => typeof v === 'number' || isPercentString(v);
