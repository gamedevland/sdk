import type { TimelineBuilder, TweenOptions, TweenTarget } from './types';
import type {gsap} from 'gsap';

export class GsapTimelineBuilder implements TimelineBuilder {
  /**
   * Wraps a GSAP timeline and exposes a minimal, engine-friendly API
   * for building sequences of animations.
   */
  constructor(private readonly tl: ReturnType<typeof gsap.timeline>) {}
  /**
   * Append a tween that animates properties to their target values.
   */
  to(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions): this {
    this.tl.to(this.unwrap(target), { ...props, ...this.mapOpts(opts) });
    return this;
  }
  /**
   * Append a tween that starts from provided values and animates back to current.
   */
  from(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions): this {
    this.tl.from(this.unwrap(target), { ...props, ...this.mapOpts(opts) });
    return this;
  }
  /**
   * Append a tween that goes from explicit values to explicit target values.
   */
  fromTo(
    target: TweenTarget,
    f: Record<string, number>,
    t: Record<string, number>,
    opts?: TweenOptions,
  ): this {
    this.tl.fromTo(this.unwrap(target), f, { ...t, ...this.mapOpts(opts) });
    return this;
  }

  private unwrap(target: TweenTarget): object {
    return 'view' in target && typeof target.view === 'object' && target.view !== null ? target.view : target;
  }
  /**
   * Insert a named label that can be referenced to seek or align steps.
   */
  addLabel(name: string, at?: number): this {
    this.tl.addLabel(name, at);
    return this;
  }
  /**
   * Insert a pause into the timeline flow, optionally at a specific time.
   */
  addPause(at?: number): this {
    this.tl.addPause(at);
    return this;
  }

  /** Strip engine-only options before passing to GSAP (e.g., groupId). */
  private mapOpts(opts?: TweenOptions): Record<string, unknown> | undefined {
    if (!opts) return opts;
    const { groupId: _groupId, ...rest } = opts;
    return rest;
  }

}

export default GsapTimelineBuilder;
