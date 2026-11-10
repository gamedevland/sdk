import { PhysicsManager } from './PhysicsManager';
import { PhysicsServices } from './PhysicsServices';
import type { DiContainerInterface } from '../di/types';
import type { EngineModule } from '../core/EngineModule';
/** Opt-in Matter worlds, independent of the selected renderer. */
export class MatterPhysicsModule implements EngineModule {
  register(container: DiContainerInterface): () => void {
    const manager = new PhysicsManager();
    container.register({ token: PhysicsServices.Manager, useValue: manager, source: 'system' });
    return () => manager.disposeAll();
  }
}
