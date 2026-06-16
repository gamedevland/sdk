import type { Container } from '@engine/layouts';
import type { SceneRuntime } from '@engine/scenes';
import type { TweenManager } from '@engine/tween';

export interface DragPointerPayload {
  readonly pointerId: number;
  readonly virtualX: number;
  readonly virtualY: number;
}

export type DragInputPhase = 'start' | 'move' | 'end' | 'cancel';

export interface DragInputRequestedPayload extends DragPointerPayload {
  readonly phase: DragInputPhase;
}

export interface DragCoreRuntimeContext {
  readonly engine: SceneRuntime;
  readonly playfield: Container;
  readonly tweens: TweenManager;
}
