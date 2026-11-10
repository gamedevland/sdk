import type { SceneServiceTickPhase } from '@engine/scenes/SceneService';

export type RuntimeSystemPhase = 'layout' | SceneServiceTickPhase | 'particles' | 'tweens' | 'presentation';

/**
 * Canonical runtime phase ordering used by scheduler-managed systems.
 */
export class RuntimeSystemPhaseOrder {
  private static readonly PhaseIndex: Readonly<Record<RuntimeSystemPhase, number>> = {
    layout: 100,
    scene: 200,
    physics: 300,
    particles: 400,
    tweens: 500,
    presentation: 600,
  };

  static isValid(value: string): value is RuntimeSystemPhase {
    return Object.hasOwn(RuntimeSystemPhaseOrder.PhaseIndex, value);
  }

  static compare(left: RuntimeSystemPhase, right: RuntimeSystemPhase): number {
    return RuntimeSystemPhaseOrder.PhaseIndex[left] - RuntimeSystemPhaseOrder.PhaseIndex[right];
  }
}
