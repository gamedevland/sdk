import { BaseCommand } from '@gamedevland/engine/commands';
export class SmokePulseCommand extends BaseCommand { override async run(): Promise<void> { await this.layout.getNode('root.tile').runAction('pulse'); } }
