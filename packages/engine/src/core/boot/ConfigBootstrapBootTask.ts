import type { ConfigBootstrapper } from './ConfigBootstrapper';
import type { EngineBootConfigPlan } from './EngineBootConfigPlan';
import type { EngineBootTask } from './EngineBootTask';

export class ConfigBootstrapBootTask implements EngineBootTask {
  constructor(
    private readonly configBootstrapper: ConfigBootstrapper,
    private readonly plan: EngineBootConfigPlan,
  ) {}

  async run(): Promise<void> {
    await this.configBootstrapper.bootstrapEngineStart(this.plan);
  }
}
