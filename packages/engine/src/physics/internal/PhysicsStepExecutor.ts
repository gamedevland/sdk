import { PhysicsErrors } from '../PhysicsErrors';

import type { PhysicsBodySnapshot } from '../types';
import type { MatterWorldAdapter } from './MatterWorldAdapter';

export class PhysicsStepExecutor {
  executeStep(params: {
    adapter: MatterWorldAdapter;
    dtSeconds: number;
    source: string;
  }): readonly PhysicsBodySnapshot[] {
    if (params.dtSeconds <= 0 || params.dtSeconds > 0.1) {
      throw PhysicsErrors.invalidStep(params.source, params.dtSeconds);
    }
    params.adapter.step(params.dtSeconds);
    return params.adapter.listBodySnapshots();
  }
}
