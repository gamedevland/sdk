import { ResizeScheduler } from './ResizeScheduler';
import { Scaler } from './Scaler';

import type { ScreenConfig, ViewportSize, VirtualSize, ScreenStateSnapshot } from './types';
import type { Application } from 'pixi.js';

/**
 * Coordinates PIXI stage sizing and scaling based on the current
 * browser viewport and a provided `ScreenConfig`.
 *
 * Responsibilities:
 * - Listen to resize/orientation changes (debounced via `ResizeScheduler`).
 * - Compute the desired internal canvas size and CSS scale (via `Scaler`).
 * - Apply changes to the PIXI renderer and stage when something changed.
 * - Provide helper getters and conversions between viewport and virtual space.
 */
export class ScreenManager {
  private static readonly InitialSnapshotMaxAttempts = 120;

  private readonly scaler: Scaler;
  private disposeScheduler?: () => void;
  private snapshot!: ScreenStateSnapshot;
  private prev?: ScreenStateSnapshot;
  private changeHandlers: Set<(snapshot: ScreenStateSnapshot) => void> = new Set();
  private requestRender: (() => void) | undefined;

  constructor(
    private readonly app: Application,
    private readonly config: ScreenConfig,
  ) {
    this.scaler = new Scaler(config);
  }

  /**
   * Initializes the manager: performs the first measurement and starts
   * listening to resize/orientation events.
   */
  async init(): Promise<void> {
    const initialSnapshot = await this.awaitInitialSnapshot();
    this.applySnapshot(initialSnapshot);
    const scheduler = new ResizeScheduler(() => this.updateFromWindow());
    this.disposeScheduler = scheduler.attach();
  }

  /**
   * Cleans up event listeners created in `init`.
   */
  destroy(): void {
    this.disposeScheduler?.();
  }

  /**
   * Recomputes the screen snapshot using the current browser viewport
   * and applies changes to the PIXI stage if anything actually changed.
   */
  updateFromWindow(): void {
    const next = this.readValidSnapshot();
    if (!next) {
      return;
    }
    this.applySnapshot(next);
  }

  private applySnapshot(next: ScreenStateSnapshot): void {
    const changed = this.hasChanged(this.prev, next);
    this.snapshot = next;
    if (changed) {
      this.applyToStage();
      this.prev = { ...next };
      this.notifyChange();
    }
  }

  /**
   * Applies the current snapshot to the PIXI renderer and stage:
   * - Sets device pixel ratio (renderer.resolution)
   * - Resizes the internal canvas to the computed virtual size
   * - Does NOT scale the stage: scaling is expected to be done via CSS size of the canvas
   */
  private applyToStage(): void {
    const { canvas, viewport } = this.snapshot;
    const dpr = this.resolveDpr();
    // IMPORTANT: internal canvas size equals the computed virtual canvas.
    // resize(width,height) sets the <canvas width/height> attributes.
    this.app.renderer.resolution = dpr;
    this.app.renderer.resize(canvas.width, canvas.height);
    // Ensure the canvas DOM size matches the viewport; Renderer will draw into virtual size.
    const cv = this.app.canvas as HTMLCanvasElement;
    if (cv && cv.style) {
      cv.style.width = `${viewport.width}px`;
      cv.style.height = `${viewport.height}px`;
    }
    // Stage remains unscaled; visually fills viewport due to canvas CSS size.
    this.app.stage.scale.set(1);
    this.app.stage.pivot.set(0, 0);
    this.app.stage.position.set(0, 0);
    this.requestRender?.();
  }

  /**
   * Subscribes to screen state changes that were applied to the stage.
   * Returns an unsubscribe function.
   */
  onChange(handler: (snapshot: ScreenStateSnapshot) => void): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  /** Notifies subscribers with a cloned snapshot to prevent outside mutation. */
  private notifyChange(): void {
    const s = this.snapshot;
    const clone: ScreenStateSnapshot = {
      orientation: s.orientation,
      viewport: { ...s.viewport },
      canvas: { ...s.canvas },
      scale: s.scale,
    };
    for (const h of [...this.changeHandlers])
      try {
        h(clone);
      } catch {
        /* ignore */
      }
  }

  /**
   * Resolves the device pixel ratio to use for the renderer's resolution.
   * - `dpr: 'auto'` uses the browser DPR (retina-aware).
   * - numeric `dpr` uses the provided fixed value.
   * - missing/invalid values fall back to 1.
   */
  private resolveDpr(): number {
    if (this.config.dpr === 'auto') {
      const rawDpr = window.devicePixelRatio;
      if (typeof rawDpr !== 'number' || !Number.isFinite(rawDpr) || rawDpr <= 0) return 1;
      const maxDpr = this.config.maxDpr;
      if (typeof maxDpr === 'number' && Number.isFinite(maxDpr) && maxDpr > 0) {
        return Math.min(rawDpr, maxDpr);
      }
      return rawDpr;
    }
    if (typeof this.config.dpr === 'number' && Number.isFinite(this.config.dpr) && this.config.dpr > 0) {
      return this.config.dpr;
    }
    return 1;
  }

  /**
   * Returns the center point of the virtual canvas in virtual coordinates.
   */
  get center(): { x: number; y: number } {
    return { x: this.snapshot.canvas.width / 2, y: this.snapshot.canvas.height / 2 };
  }

  // API
  /** Current virtual width (internal canvas width). */
  get width(): number {
    return this.snapshot.canvas.width;
  }
  /** Current virtual height (internal canvas height). */
  get height(): number {
    return this.snapshot.canvas.height;
  }
  /** Current orientation: 'land' (landscape) or 'port' (portrait). */
  get orientation(): 'land' | 'port' {
    return this.snapshot.orientation;
  }
  /** Returns a copy of the current virtual canvas size. */
  getVirtualSize(): VirtualSize {
    return { ...this.snapshot.canvas };
  }
  /** Returns a copy of the current viewport size in CSS pixels. */
  getViewportSize(): ViewportSize {
    return { ...this.snapshot.viewport };
  }
  /** Uniform scale factor applied to the PIXI stage. */
  getScale(): number {
    return this.snapshot.scale;
  }

  getSnapshot(): ScreenStateSnapshot {
    return {
      orientation: this.snapshot.orientation,
      viewport: { ...this.snapshot.viewport },
      canvas: { ...this.snapshot.canvas },
      scale: this.snapshot.scale,
    };
  }

  setRenderRequester(requestRender: (() => void) | undefined): void {
    this.requestRender = requestRender;
  }
  /** Alias for `orientation` getter for readability in some contexts. */
  getOrientation(): 'land' | 'port' {
    return this.snapshot.orientation;
  }
  /**
   * Converts a point from viewport coordinates (e.g. mouse or touch position)
   * to virtual coordinates of the internal canvas, taking stage position,
   * pivot, and current scale into account.
   */
  toVirtual(x: number, y: number): { x: number; y: number } {
    const canvasElement = this.app.canvas as HTMLCanvasElement | undefined;
    if (!canvasElement) {
      const { scale } = this.snapshot;
      const stagePos = this.app.stage.position;
      const pivot = this.app.stage.pivot;
      return { x: (x - stagePos.x) / scale + pivot.x, y: (y - stagePos.y) / scale + pivot.y };
    }

    const rect = canvasElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      const { scale } = this.snapshot;
      const stagePos = this.app.stage.position;
      const pivot = this.app.stage.pivot;
      return { x: (x - stagePos.x) / scale + pivot.x, y: (y - stagePos.y) / scale + pivot.y };
    }

    const localX = x - rect.left;
    const localY = y - rect.top;
    const normalizedX = localX / rect.width;
    const normalizedY = localY / rect.height;
    return {
      x: normalizedX * this.snapshot.canvas.width,
      y: normalizedY * this.snapshot.canvas.height,
    };
  }

  /**
   * Compares two snapshots and returns true if anything that affects
   * rendering has changed (orientation, sizes or scale).
   */
  private hasChanged(a: ScreenStateSnapshot | undefined, b: ScreenStateSnapshot): boolean {
    if (!a) return true;
    return (
      a.orientation !== b.orientation ||
      a.canvas.width !== b.canvas.width ||
      a.canvas.height !== b.canvas.height ||
      a.viewport.width !== b.viewport.width ||
      a.viewport.height !== b.viewport.height ||
      a.scale !== b.scale
    );
  }

  /**
   * Reads the current viewport size. Prefers `visualViewport` when available
   * to avoid including browser UI like address bars on mobile devices.
   */
  private readViewport(): { width: number; height: number } {
    const vv = window.visualViewport ?? undefined;
    if (vv) {
      const width = this.resolveFiniteDimension(vv.width);
      const height = this.resolveFiniteDimension(vv.height);
      if (width !== undefined && height !== undefined) {
        return {
          width: Math.round(width),
          height: Math.round(height),
        };
      }
    }

    return {
      width: this.resolveFiniteDimension(window.innerWidth) ?? Number.NaN,
      height: this.resolveFiniteDimension(window.innerHeight) ?? Number.NaN,
    };
  }

  private readValidSnapshot(): ScreenStateSnapshot | undefined {
    const viewport = this.readViewport();
    const snapshot = this.scaler.compute(viewport);
    return this.isValidSnapshot(snapshot) ? snapshot : undefined;
  }

  private resolveFiniteDimension(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  }

  private isValidSnapshot(snapshot: ScreenStateSnapshot): boolean {
    return (
      Number.isFinite(snapshot.viewport.width) &&
      snapshot.viewport.width > 0 &&
      Number.isFinite(snapshot.viewport.height) &&
      snapshot.viewport.height > 0 &&
      Number.isFinite(snapshot.canvas.width) &&
      snapshot.canvas.width > 0 &&
      Number.isFinite(snapshot.canvas.height) &&
      snapshot.canvas.height > 0 &&
      Number.isFinite(snapshot.scale) &&
      snapshot.scale > 0
    );
  }

  private async awaitInitialSnapshot(): Promise<ScreenStateSnapshot> {
    for (let attempts = 0; attempts < ScreenManager.InitialSnapshotMaxAttempts; attempts += 1) {
      const snapshot = this.readValidSnapshot();
      if (snapshot) {
        return snapshot;
      }
      await this.nextAnimationFrame();
    }

    throw new Error('ScreenManager.init: failed to acquire a valid initial screen snapshot');
  }

  private nextAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  }
}
