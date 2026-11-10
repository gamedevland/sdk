/**
 * Options that control how a tween behaves over time.
 * All properties map to common GSAP options but are kept generic
 * so the rest of the engine does not depend on GSAP directly.
 */
export interface TweenOptions {
  /** Total animation time in seconds. */
  duration?: number; // seconds
  /** Delay before the tween starts, in seconds. */
  delay?: number; // seconds
  /** Easing function name, e.g. "power1.out". */
  ease?: string;
  /** How many times to repeat; use -1 for infinite looping. */
  repeat?: number; // -1 = infinite
  /** If true, plays the animation forward then backward each cycle. */
  yoyo?: boolean;
  /**
   * Optional logical group identifier. Tweens with the same groupId
   * can be killed together via the manager.
   */
  groupId?: string;
  /** Callback fired once when the tween actually starts playing. */
  onStart?(): void;
  /** Callback fired on every frame while the tween is updating. */
  onUpdate?(): void;
  /** Callback fired once when the tween completes (and does not repeat). */
  onComplete?(): void;
}

/** 2D point in the target parent's coordinate space. */
export interface TweenPoint {
  readonly x: number;
  readonly y: number;
}

/** Options for path-based position tweening. */
export interface TweenPathOptions extends TweenOptions {
  /** Curve tension used by the underlying path solver. */
  readonly curviness?: number;
  /** If enabled, rotate the target along the path when supported by the backend. */
  readonly autoRotate?: boolean | number;
  /** Sampling resolution for path measurement. Higher values are smoother but heavier. */
  readonly resolution?: number;
}

/**
 * A controller interface for an active tween or timeline.
 * This abstracts the underlying implementation and provides
 * a Promise-like `.then()` for completion handling.
 */
export interface TweenHandle {
  /** Pause the tween without resetting its progress. */
  pause(): void;
  /** Resume a previously paused tween. */
  resume(): void;
  /** Play the tween backward from the current position. */
  reverse(): void;
  /**
   * Get or set normalized progress in range [0..1].
   * - No argument: returns current progress
   * - With value: sets progress and returns the resolved value
   */
  progress(value?: number): number; // get/set 0..1
  /**
   * Get or set playback speed. 1 = normal speed, 2 = double speed, etc.
   * - No argument: returns current timeScale
   * - With value: sets timeScale and returns the resolved value
   */
  timeScale(value?: number): number; // get/set
  /** Jump to an absolute time (in seconds) within the tween. */
  seek(time: number): void;
  /** Immediately stop and dispose the tween. */
  kill(): void;
  /**
   * Promise-compatible callback for completion. Useful for `await` or chaining.
   * Resolves when the tween completes normally or is interrupted/killed.
   */
  then(onFulfilled?: () => void, onRejected?: (e: unknown) => void): Promise<void>;
}

/**
 * Fluent builder used to describe a sequence of animations within a timeline.
 * Each call appends a new step or marker to the underlying timeline.
 */
export interface TimelineBuilder {
  /** Animate properties to their target values. */
  to(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions): this;
  /** Animate properties starting from values and ending at current values. */
  from(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions): this;
  /** Animate properties from explicit values to explicit target values. */
  fromTo(
    target: TweenTarget,
    f: Record<string, number>,
    t: Record<string, number>,
    opts?: TweenOptions,
  ): this;
  /** Insert a named label that can be referenced later. */
  addLabel(name: string, at?: number): this;
  /** Insert a pause in playback at a specific time. */
  addPause(at?: number): this;
}

/**
 * A flexible target accepted by the Tween system: either a raw Pixi DisplayObject
 * or an engine layout node exposing `view: PIXI.DisplayObject`.
 */
export interface TweenObject {
  x?: number; y?: number; rotation?: number; angle?: number; alpha?: number;
  scale?: object;
}
export type TweenTarget = object;

/**
 * High-level service that creates and manages tweens and timelines.
 * Provides convenience helpers for common UI/game transformations.
 */
export interface TweenManager {
  /** Create a tween that animates properties to target values. */
  to(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions): TweenHandle;
  /** Create a tween that starts from values and animates to current values. */
  from(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions): TweenHandle;
  /** Create a tween that explicitly defines both from and to values. */
  fromTo(
    target: TweenTarget,
    fromProps: Record<string, number>,
    toProps: Record<string, number>,
    opts?: TweenOptions,
  ): TweenHandle;

  /** Build a timeline by imperatively describing its steps. */
  timeline(setup: (tl: TimelineBuilder) => void, opts?: { groupId?: string }): TweenHandle;

  /** Override default duration/ease used when options are omitted. */
  setDefaults(defaults: Required<Pick<TweenOptions, 'duration' | 'ease'>>): void;

  // sugar helpers
  /** Tween absolute position to a point (pixels). */
  moveTo(
    target: TweenTarget,
    position: { x: number; y: number },
    duration: number,
    opts?: TweenOptions,
  ): TweenHandle;
  /** Tween absolute position along a curved path through the provided points. */
  moveAlongPath(
    target: TweenTarget,
    points: readonly TweenPoint[],
    duration: number,
    opts?: TweenPathOptions,
  ): TweenHandle;
  /** Tween by a delta offset in position. */
  moveBy(target: TweenTarget, dx: number, dy: number, opts?: TweenOptions): TweenHandle;
  /**
   * Uniform or non-uniform scale: number applies to both axes; {x,y} for explicit.
   * The second parameter is duration in seconds. Options are optional third.
   */
  scaleTo(
    target: TweenTarget,
    s: number | { x: number; y: number },
    duration: number,
    opts?: TweenOptions,
  ): TweenHandle;
  /** Non-uniform scale in X and Y. */
  scaleXY(target: TweenTarget, sx: number, sy: number, opts?: TweenOptions): TweenHandle;
  /** Set alpha to a specific value with explicit duration (seconds). */
  alphaTo(target: TweenTarget, alpha: number, duration: number, opts?: TweenOptions): TweenHandle;
  /** Convenience fade-in to alpha = 1 with explicit duration (seconds). */
  fadeIn(target: TweenTarget, duration: number, opts?: TweenOptions): TweenHandle;
  /** Convenience fade-out to alpha = 0 with explicit duration (seconds). */
  fadeOut(target: TweenTarget, duration: number, opts?: TweenOptions): TweenHandle;
  /** Rotate to an absolute angle (degrees) with explicit duration. */
  rotateTo(target: TweenTarget, angle: number, duration: number, opts?: TweenOptions): TweenHandle;
  /** Rotate by a delta angle (radians). */
  rotateBy(target: TweenTarget, dr: number, opts?: TweenOptions): TweenHandle;
  /** Animate Pixi's angle (degrees) to an absolute value with explicit duration. */
  angleTo(target: TweenTarget, angle: number, duration: number, opts?: TweenOptions): TweenHandle;

  /**
   * Returns a handle that resolves after `ms` milliseconds of game time.
   * Unlike `setTimeout`, this delay respects runtime pause: it freezes
   * when the tween manager is paused and resumes when it unpauses.
   */
  delayMs(ms: number, opts?: { groupId?: string }): TweenHandle;

  /** Stop all tweens for a target or a whole group. */
  kill(targetOrGroup?: TweenTarget | { groupId?: string }): void;
  /** Stop every tween managed by this instance. */
  killAll(): void;
}
