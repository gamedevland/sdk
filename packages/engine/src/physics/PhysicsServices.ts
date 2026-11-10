import { DiTokens } from '../di/DiTokens';
import type { PhysicsManager } from './PhysicsManager';
/** Renderer-independent tokens for optional 2D physics. */
export class PhysicsServices {
  static readonly Manager = DiTokens.service<PhysicsManager>('PhysicsManager');
}
