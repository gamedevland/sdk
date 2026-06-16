import type { EngineBootTask } from './EngineBootTask';

export class EngineBootPipeline {
  constructor(private readonly tasks: readonly EngineBootTask[]) {}

  async run(): Promise<void> {
    for (const task of this.tasks) {
      await task.run();
    }
  }
}
