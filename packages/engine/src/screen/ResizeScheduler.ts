/**
 * Debounces frequent resize/orientation events and invokes a handler
 * at most once per animation frame. Helps avoid redundant recalculations
 * and renderer resizes when the user is actively resizing the window
 * or the device changes orientation.
 */
export class ResizeScheduler {
  private scheduled = false;
  private dispose?: () => void;

  /**
   * Creates a scheduler with a callback to be invoked on the next frame
   * after a resize or orientation change is detected.
   */
  constructor(private readonly handler: () => void) {}

  /**
   * Subscribes to `resize` and `orientationchange` events and returns
   * a disposer that removes these listeners. The events are funneled
   * through `request()` to ensure at most one handler call per frame.
   */
  attach(): () => void {
    const onEvent = () => this.request();
    window.addEventListener('resize', onEvent);
    window.addEventListener('orientationchange', onEvent);
    this.dispose = () => {
      window.removeEventListener('resize', onEvent);
      window.removeEventListener('orientationchange', onEvent);
    };
    return this.dispose;
  }

  /**
   * Requests handler execution on the next animation frame. If a request
   * is already scheduled for the current frame, additional calls are ignored.
   */
  request(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.handler();
    });
  }
}
