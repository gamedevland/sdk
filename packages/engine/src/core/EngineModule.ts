import type { DiContainerInterface } from '../di/types';
/** Optional engine capability with explicit registration and engine-owned cleanup. */
export interface EngineModule {
  register(container: DiContainerInterface): (() => void) | void;
}
