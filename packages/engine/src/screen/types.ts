/** Describes current screen orientation. */
export type Orientation = 'land' | 'port';

/**
 * Strategy that tells which axis is fixed by the virtual profile:
 * - 'width': keep virtual width fixed, derive height to preserve aspect
 * - 'height': keep virtual height fixed, derive width to preserve aspect
 * - 'auto': choose width in landscape, height in portrait
 */
export type FitMode = 'width' | 'height' | 'auto' | 'contain';

/**
 * Virtual screen description for a particular orientation.
 * `width`/`height` are the intended internal canvas dimensions (px).
 */
export interface ScreenProfile {
  width: number;
  height: number;
  fit?: FitMode;
}

export interface ScreenRenderConfig {
  scaleFactor?: number;
  /** Maximum backing canvas area in physical pixels. Independent of scaleFactor. */
  maxCanvasPixels?: number;
}

/**
 * Main configuration for screen behavior.
 * - `land`/`port`: virtual profiles for each orientation.
 * - `dpr`: fixed renderer resolution, 'auto' for browser DPR in virtual units,
 *   or 'native' to target physical viewport pixels. Default is 1.
 * - `maxDpr`: caps the browser DPR in 'auto' and 'native' modes.
 */
export interface ScreenConfig {
  land: ScreenProfile;
  port: ScreenProfile;
  dpr?: 'auto' | 'native' | number;
  maxDpr?: number;
  render?: ScreenRenderConfig;
}

/** Actual CSS pixel size of the browser viewport. */
export interface ViewportSize {
  width: number;
  height: number;
}
/** Internal canvas size in virtual pixels. */
export interface VirtualSize {
  width: number;
  height: number;
}

/**
 * Immutable snapshot of the current screen calculation used by the
 * `ScreenManager` and rendering code.
 */
export interface ScreenStateSnapshot {
  orientation: Orientation;
  viewport: ViewportSize;
  /** Logical canvas size, before renderer resolution is applied. */
  canvas: { width: number; height: number };
  /** Uniform CSS-like scale applied to the stage to fill the viewport. */
  scale: number;
}
