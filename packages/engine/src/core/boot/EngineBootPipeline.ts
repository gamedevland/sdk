import { AbortableOperation } from '../../lifecycle/AbortableOperation';

import type { EngineBootTask } from './EngineBootTask';

export class EngineBootPipeline {
  constructor(private readonly tasks: readonly EngineBootTask[]) {}

  async run(signal?: AbortSignal): Promise<void> {
    for (const task of this.tasks) {
      signal?.throwIfAborted();
      await AbortableOperation.wait(task.run(signal), signal);
    }
  }
}
