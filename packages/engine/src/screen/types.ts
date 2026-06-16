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
}

/**
 * Main configuration for screen behavior.
 * - `land`/`port`: virtual profiles for each orientation.
 * - `dpr`: renderer resolution; 'auto' or a fixed number. Default is 1.
 */
export interface ScreenConfig {
  land: ScreenProfile;
  port: ScreenProfile;
  dpr?: 'auto' | number;
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
  /** Internal canvas size (the <canvas width/height> attributes), px. */
  canvas: { width: number; height: number };
  /** Uniform CSS-like scale applied to the stage to fill the viewport. */
  scale: number;
}
