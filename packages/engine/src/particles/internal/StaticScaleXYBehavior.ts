import { behaviors } from '@spd789562/particle-emitter';

import type { Particle } from '@spd789562/particle-emitter';

interface StaticScaleXYBehaviorConfig {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

type StaticScaleXYBehaviorOrder =
  (typeof behaviors.BehaviorOrder)[keyof typeof behaviors.BehaviorOrder];

class StaticScaleXYBehavior {
  static readonly type = 'scaleXYStatic';

  readonly order: StaticScaleXYBehaviorOrder = behaviors.BehaviorOrder.Normal;

  private readonly minX: number;
  private readonly maxX: number;
  private readonly minY: number;
  private readonly maxY: number;

  constructor(config: StaticScaleXYBehaviorConfig) {
    this.minX = config.minX;
    this.maxX = config.maxX;
    this.minY = config.minY;
    this.maxY = config.maxY;
  }

  initParticles(first: Particle): undefined {
    let next: Particle | undefined = first;
    while (next) {
      next.scaleX = this.randomBetween(this.minX, this.maxX);
      next.scaleY = this.randomBetween(this.minY, this.maxY);
      next = next.next;
    }
    return undefined;
  }

  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}

export { StaticScaleXYBehavior };
