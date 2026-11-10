import type { BundleDescriptor } from '../assets';
import type { AudioManagerOptions } from '../audio/types';
import type { BrowserInputGuardConfig } from '../input';
import type { ScreenConfig } from '../screen/types';

/**
 * Options used to construct the Engine instance.
 * @remarks
 * These are minimal bootstrap options. Full game configuration is passed later to start().
 */
export interface EngineOptions {
  renderer: import("../rendering/types").RendererModule;
  /** DOM element to mount the PixiJS canvas into. */
  container: HTMLElement;
  /** Initial background color for the renderer; can be overridden in init(). */
  background?: string;
  /** Asset bundles to register immediately (useful before calling start()). */
  bundles?: BundleDescriptor[];
  /** Screen configuration (virtual sizes, orientation) for `ScreenManager`. */
  screen?: ScreenConfig;
  /** Browser behavior suppression config applied to the game canvas. */
  browserGuard?: Partial<BrowserInputGuardConfig>;
  /** Optional audio subsystem bootstrap options forwarded to AudioManager. */
  audio?: AudioManagerOptions;
}
