import type {
  ScreenConfig,
  Orientation,
  ViewportSize,
  ScreenStateSnapshot,
  FitMode,
} from './types';

export class Scaler {
  /**
   * Creates a helper that calculates how the PIXI canvas should be sized
   * and scaled for the current browser viewport.
   *
   * The logic uses two screen profiles (landscape and portrait) provided
   * via `ScreenConfig`, and a `fit` strategy to decide which axis is
   * fixed and which axis should be derived to preserve aspect ratio.
   */
  constructor(private readonly config: ScreenConfig) {}

  /**
   * Computes a new screen snapshot for the given viewport size.
   *
   * - Detects current orientation (land/port) by comparing width/height.
   * - Picks the corresponding virtual profile from config.
   * - Chooses the fit axis (width/height/auto) and fixes the internal
   *   canvas size along that axis; the other axis is derived to keep
   *   aspect ratio.
   * - Calculates a uniform CSS scale so content fills the viewport.
   *
   * Returns dimensions in pixels; the `scale` is a unit-less factor to
   * apply to `stage.scale` in PIXI.
   */
  compute(viewport: ViewportSize): ScreenStateSnapshot {
    const isLand = viewport.width >= viewport.height;
    const orientation: Orientation = isLand ? 'land' : 'port';
    const virt = isLand ? this.config.land : this.config.port;
    const vw = viewport.width;
    const vh = viewport.height;
    const fit: FitMode = virt.fit ?? 'auto';
    if (fit === 'contain') {
      const profileRatio = virt.width / virt.height;
      const viewportRatio = vw / vh;
      const canvasWidth = profileRatio > viewportRatio
        ? virt.width
        : Math.round(virt.height * viewportRatio);
      const canvasHeight = profileRatio > viewportRatio
        ? Math.round(virt.width / viewportRatio)
        : virt.height;

      return {
        orientation,
        viewport: { width: vw, height: vh },
        canvas: { width: canvasWidth, height: canvasHeight },
        scale: vw / canvasWidth,
      };
    }

    const useWidth = fit === 'width' || (fit === 'auto' && isLand);
    const useHeight = fit === 'height' || (fit === 'auto' && !isLand);

    // Internal canvas size (the actual <canvas width/height> attributes)
    // is fixed along the chosen fit axis. The opposite axis is derived
    // to preserve the virtual aspect ratio.
    const canvasWidth = useWidth ? virt.width : Math.round(virt.height * (vw / vh));
    const canvasHeight = useHeight ? virt.height : Math.round(virt.width * (vh / vw));
    // CSS-like scale factor to map virtual canvas to viewport size.
    const scale = useWidth ? vw / canvasWidth : vh / canvasHeight;

    return {
      orientation,
      viewport: { width: vw, height: vh },
      canvas: { width: canvasWidth, height: canvasHeight },
      scale,
    };
  }
}
