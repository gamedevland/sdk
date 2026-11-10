import type { TweenHandle } from './types';
import type {gsap} from 'gsap';

export class GsapTweenHandle implements TweenHandle {
  private completionResolved = false;
  private readonly completionPromise: Promise<void>;
  private resolveCompletion: (() => void) | undefined;

  /**
   * Wraps a GSAP tween/timeline instance and exposes a stable
   * engine-wide interface for controlling it.
   */
  constructor(private readonly tween: NonNullable<ReturnType<typeof gsap.getById>>) {
    this.completionPromise = new Promise<void>((resolve) => {
      this.resolveCompletion = resolve;
    });
    this.attachCompletionCallbacks();
  }

  /** Pause playback without changing current progress. */
  pause(): void {
    this.tween.pause();
  }
  /** Resume playback after a pause. */
  resume(): void {
    this.tween.resume();
  }
  /** Reverse playback direction from the current moment. */
  reverse(): void {
    this.tween.reverse();
  }
  /**
   * Get or set normalized progress [0..1].
   * Implementation detail: GSAP uses the same `progress()`
   * getter/setter signature, which we forward to directly.
   */
  progress(value?: number): number {
    if (value === undefined) {
      return this.tween.progress();
    }
    this.tween.progress(value);
    return this.tween.progress();
  }
  /**
   * Get or set playback rate multiplier.
   * Implementation detail: forwarded to GSAP's `timeScale()`.
   */
  timeScale(value?: number): number {
    if (value === undefined) {
      return this.tween.timeScale();
    }
    this.tween.timeScale(value);
    return this.tween.timeScale();
  }
  /** Seek to an absolute time (in seconds) within the tween/timeline. */
  seek(time: number): void {
    this.tween.seek(time);
  }
  /** Immediately stop and dispose of the tween/timeline. */
  kill(): void {
    this.tween.kill();
    this.complete();
  }
  /**
   * Promise-like completion hook.
   * The returned promise settles when the tween completes normally
   * or gets interrupted/killed during teardown.
   */
  then(onFulfilled?: () => void, onRejected?: (e: unknown) => void): Promise<void> {
    return this.completionPromise.then(onFulfilled, onRejected);
  }

  private attachCompletionCallbacks(): void {
    const prevComplete = this.tween.eventCallback('onComplete');
    this.tween.eventCallback('onComplete', () => {
      try {
        if (prevComplete) {
          prevComplete();
        }
      } finally {
        this.complete();
      }
    });

    const prevInterrupt = this.tween.eventCallback('onInterrupt');
    this.tween.eventCallback('onInterrupt', () => {
      try {
        if (prevInterrupt) {
          prevInterrupt();
        }
      } finally {
        this.complete();
      }
    });
  }

  private complete(): void {
    if (this.completionResolved) {
      return;
    }
    this.completionResolved = true;
    this.resolveCompletion?.();
    this.resolveCompletion = undefined;
  }
}

export default GsapTweenHandle;
